-- Database behavior source: Drizzle owns all tables, keys, checks and indexes.
-- Map pre-organization alpha workspaces without changing their IDs or grants.
-- CI defers the new column's NOT NULL until this transactional backfill completes.
DO $$
DECLARE legacy record; operator_id text;
BEGIN
 FOR legacy IN SELECT id,installation_id,name,archived_at FROM payloadbay.workspace WHERE organization_id IS NULL ORDER BY id FOR UPDATE LOOP
  SELECT g.user_id INTO operator_id FROM payloadbay.grant_record g
   JOIN payloadbay.admission a ON a.user_id=g.user_id AND a.installation_id=legacy.installation_id AND a.active
   WHERE g.scope_type='instance' AND g.scope_id=legacy.installation_id AND g.role_preset='owner'
   ORDER BY g.user_id LIMIT 1;
  IF operator_id IS NULL THEN RAISE EXCEPTION 'Organization mapping requires an active instance owner'; END IF;
  INSERT INTO payloadbay.organization(id,installation_id,name,slug,owner_user_id,archived_at)
   VALUES(legacy.id,legacy.installation_id,legacy.name,'migrated-'||legacy.id::text,operator_id,legacy.archived_at);
  UPDATE payloadbay.workspace SET organization_id=legacy.id WHERE id=legacy.id;
 END LOOP;
END $$;

-- Resource ancestry is stable after creation; legacy NULL lineage can be backfilled.
CREATE OR REPLACE FUNCTION payloadbay.reject_resource_parent() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE position integer;
BEGIN
 FOR position IN 0..TG_NARGS-1 LOOP
  IF (to_jsonb(OLD)->>TG_ARGV[position]) IS NOT NULL AND
   (to_jsonb(OLD)->>TG_ARGV[position]) IS DISTINCT FROM (to_jsonb(NEW)->>TG_ARGV[position])
   THEN RAISE EXCEPTION 'immutable resource parent'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS immutable_organization_parent ON payloadbay.organization;
CREATE TRIGGER immutable_organization_parent BEFORE UPDATE OF installation_id ON payloadbay.organization FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_resource_parent('installation_id');
DROP TRIGGER IF EXISTS immutable_workspace_parent ON payloadbay.workspace;
CREATE TRIGGER immutable_workspace_parent BEFORE UPDATE OF installation_id,organization_id ON payloadbay.workspace FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_resource_parent('installation_id','organization_id');
DROP TRIGGER IF EXISTS immutable_project_parent ON payloadbay.project;
CREATE TRIGGER immutable_project_parent BEFORE UPDATE OF workspace_id ON payloadbay.project FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_resource_parent('workspace_id');
DROP TRIGGER IF EXISTS immutable_endpoint_parent ON payloadbay.endpoint;
CREATE TRIGGER immutable_endpoint_parent BEFORE UPDATE OF project_id ON payloadbay.endpoint FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_resource_parent('project_id');

CREATE OR REPLACE FUNCTION payloadbay.reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable history'; END $$;
DROP TRIGGER IF EXISTS immutable_stage ON payloadbay.stage_revision;
CREATE TRIGGER immutable_stage BEFORE UPDATE OR DELETE ON payloadbay.stage_revision FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_shared ON payloadbay.shared_module_revision;
CREATE TRIGGER immutable_shared BEFORE UPDATE OR DELETE ON payloadbay.shared_module_revision FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_publication ON payloadbay.publication;
CREATE TRIGGER immutable_publication BEFORE UPDATE OR DELETE ON payloadbay.publication FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_event ON payloadbay.event;
CREATE TRIGGER immutable_event BEFORE UPDATE OR DELETE ON payloadbay.event FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_receipt ON payloadbay.receipt;
CREATE TRIGGER immutable_receipt BEFORE UPDATE OR DELETE ON payloadbay.receipt FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_policy_revision ON payloadbay.organization_policy_revision;
CREATE TRIGGER immutable_policy_revision BEFORE UPDATE OR DELETE ON payloadbay.organization_policy_revision FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_usage ON payloadbay.usage_fact;
CREATE TRIGGER immutable_usage BEFORE UPDATE OR DELETE ON payloadbay.usage_fact FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
DROP TRIGGER IF EXISTS immutable_audit ON payloadbay.audit;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON payloadbay.audit FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();

-- Auth and queue schema are created through their supported migration APIs first.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='payloadbay_app') THEN CREATE ROLE payloadbay_app NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='payloadbay_worker') THEN CREATE ROLE payloadbay_worker NOLOGIN; END IF;
END $$;
REVOKE ALL ON SCHEMA payloadbay FROM PUBLIC;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON SCHEMA graphile_worker FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA payloadbay,auth,graphile_worker FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA payloadbay,graphile_worker FROM PUBLIC;
GRANT USAGE ON SCHEMA payloadbay,auth TO payloadbay_app;
GRANT USAGE ON SCHEMA payloadbay,graphile_worker TO payloadbay_worker;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA payloadbay TO payloadbay_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA payloadbay TO payloadbay_worker;
REVOKE ALL ON payloadbay.schema_migration FROM payloadbay_app,payloadbay_worker;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA payloadbay TO payloadbay_app,payloadbay_worker;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA auth TO payloadbay_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA auth TO payloadbay_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA graphile_worker TO payloadbay_worker;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA graphile_worker TO payloadbay_worker;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA graphile_worker TO payloadbay_worker;
CREATE OR REPLACE FUNCTION payloadbay.enqueue(identifier text,payload json,run_at timestamptz,job_key text,priority smallint)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE job_id bigint;
BEGIN
 IF identifier NOT IN ('process_event','platform_job') THEN RAISE EXCEPTION 'unsupported job type'; END IF;
 SELECT (graphile_worker.add_job(identifier,payload,NULL,run_at,5,job_key,priority)).id INTO job_id;
 RETURN job_id;
END $$;
REVOKE ALL ON FUNCTION payloadbay.enqueue(text,json,timestamptz,text,smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION payloadbay.enqueue(text,json,timestamptz,text,smallint) TO payloadbay_app,payloadbay_worker;

GRANT SELECT,INSERT,UPDATE,DELETE ON payloadbay.notification_subscription TO payloadbay_app,payloadbay_worker;

CREATE OR REPLACE FUNCTION payloadbay.enqueue(identifier text,payload json,run_at timestamptz,job_key text,priority smallint)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE job_id bigint;job_flags text[];
BEGIN
 IF identifier NOT IN ('process_event','platform_job') THEN RAISE EXCEPTION 'unsupported job type'; END IF;
 job_flags:=CASE WHEN identifier='platform_job' THEN ARRAY['platform'] WHEN priority<=0 THEN ARRAY['critical'] ELSE ARRAY['bulk'] END;
 SELECT (graphile_worker.add_job(identifier,payload,NULL,run_at,5,job_key,priority,job_flags)).id INTO job_id;
 RETURN job_id;
END $$;

GRANT USAGE ON SCHEMA auth TO payloadbay_worker;
GRANT SELECT ON auth."user",auth.verification TO payloadbay_worker;
-- Serialize cursor allocation until transaction commit so SSE backfill cannot skip a later-committing earlier cursor.
CREATE OR REPLACE FUNCTION payloadbay.append_change(scope_type text,scope_id uuid,kind text,resource_id text,metadata jsonb DEFAULT '{}')
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE assigned bigint;
BEGIN
 IF scope_type NOT IN ('instance','organization','workspace','project') OR kind NOT IN ('event.recorded','event.accepted','execution.changed','attempt.completed','configuration.changed','health.changed','notification.changed') OR octet_length(resource_id)>128 OR jsonb_typeof(metadata)<>'object' OR octet_length(metadata::text)>8192 THEN RAISE EXCEPTION 'invalid change record';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payloadbay:change-commit-order:v1',0));
 INSERT INTO payloadbay.change_record(scope_type,scope_id,kind,resource_id,metadata) VALUES(scope_type,scope_id,kind,resource_id,metadata) RETURNING cursor INTO assigned;
 PERFORM pg_notify('payloadbay_changes',assigned::text);
 RETURN assigned;
END $$;
REVOKE ALL ON FUNCTION payloadbay.append_change(text,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION payloadbay.append_change(text,uuid,text,text,jsonb) TO payloadbay_app,payloadbay_worker;
REVOKE INSERT ON payloadbay.change_record FROM payloadbay_app,payloadbay_worker;

DROP TRIGGER IF EXISTS immutable_notification_channel_revision ON payloadbay.notification_channel_revision;
CREATE TRIGGER immutable_notification_channel_revision BEFORE UPDATE OR DELETE ON payloadbay.notification_channel_revision FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
