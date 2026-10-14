-- Database behavior source: Drizzle owns all tables, keys, checks and indexes.
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
 IF scope_type NOT IN ('instance','workspace','project') OR kind NOT IN ('event.accepted','execution.changed','attempt.completed','configuration.changed','health.changed','notification.changed') OR octet_length(resource_id)>128 OR jsonb_typeof(metadata)<>'object' OR octet_length(metadata::text)>8192 THEN RAISE EXCEPTION 'invalid change record';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('payloadbay:change-commit-order:v1',0));
 INSERT INTO payloadbay.change_record(scope_type,scope_id,kind,resource_id,metadata) VALUES(scope_type,scope_id,kind,resource_id,metadata) RETURNING cursor INTO assigned;
 PERFORM pg_notify('payloadbay_changes',assigned::text);
 RETURN assigned;
END $$;
REVOKE ALL ON FUNCTION payloadbay.append_change(text,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION payloadbay.append_change(text,uuid,text,text,jsonb) TO payloadbay_app,payloadbay_worker;
REVOKE INSERT ON payloadbay.change_record FROM payloadbay_app,payloadbay_worker;
