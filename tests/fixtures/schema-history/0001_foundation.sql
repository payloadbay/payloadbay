CREATE SCHEMA IF NOT EXISTS payloadbay;
CREATE TABLE payloadbay.installation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), singleton boolean NOT NULL DEFAULT true UNIQUE CHECK(singleton),
 bootstrap_state text NOT NULL DEFAULT 'pending' CHECK(bootstrap_state IN ('pending','complete')),
 config_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payloadbay.admission (
 installation_id uuid NOT NULL REFERENCES payloadbay.installation(id), user_id text NOT NULL, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(installation_id,user_id)
);
CREATE TABLE payloadbay.workspace (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), installation_id uuid NOT NULL REFERENCES payloadbay.installation(id),
 name text NOT NULL, slug text NOT NULL, owner_user_id text NOT NULL, archived_at timestamptz,
 FOREIGN KEY(installation_id,owner_user_id) REFERENCES payloadbay.admission(installation_id,user_id)
);
CREATE UNIQUE INDEX workspace_live_slug ON payloadbay.workspace(installation_id,slug) WHERE archived_at IS NULL;
CREATE TABLE payloadbay.project (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES payloadbay.workspace(id),
 name text NOT NULL,slug text NOT NULL,owner_user_id text NOT NULL,archived_at timestamptz
);
CREATE UNIQUE INDEX project_live_slug ON payloadbay.project(workspace_id,slug) WHERE archived_at IS NULL;
CREATE TABLE payloadbay.grant_record (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,scope_type text NOT NULL CHECK(scope_type IN ('instance','workspace','project')),
 scope_id uuid NOT NULL, role_preset text NOT NULL CHECK(role_preset IN ('owner','admin','operator','viewer','custom')),
 permissions text[] NOT NULL,version integer NOT NULL DEFAULT 1, UNIQUE(user_id,scope_type,scope_id)
);
CREATE INDEX grants_by_scope ON payloadbay.grant_record(scope_type,scope_id,user_id);
CREATE TABLE payloadbay.api_token (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,scope_type text NOT NULL,scope_id uuid NOT NULL,
 name text NOT NULL,permissions text[] NOT NULL,hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payloadbay.secret_version (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),scope_type text NOT NULL,scope_id uuid NOT NULL,name text NOT NULL,
 version integer NOT NULL,encrypted_value bytea NOT NULL,key_id text NOT NULL,revoked_at timestamptz,UNIQUE(scope_type,scope_id,name,version)
);
CREATE TABLE payloadbay.endpoint (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES payloadbay.project(id),
 name text NOT NULL,slug text NOT NULL,ingress_key text NOT NULL UNIQUE,active_publication_id uuid,paused boolean NOT NULL DEFAULT false,
 priority smallint NOT NULL DEFAULT 0,config_version integer NOT NULL DEFAULT 1,
 UNIQUE(project_id,slug), UNIQUE(id,project_id)
);
CREATE TABLE payloadbay.draft (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),endpoint_id uuid NOT NULL REFERENCES payloadbay.endpoint(id),
 stage text NOT NULL CHECK(stage IN ('ingress','processing')),body text NOT NULL DEFAULT '',shared_bindings jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1,UNIQUE(endpoint_id,stage)
);
CREATE TABLE payloadbay.stage_revision (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL CHECK(stage IN ('ingress','processing','ingress_middleware','processing_middleware')),
 body text NOT NULL,body_digest text NOT NULL,sdk_version text NOT NULL,bundle text NOT NULL,bundle_digest text NOT NULL,source_map jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payloadbay.shared_module_revision (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),scope_type text NOT NULL,scope_id uuid NOT NULL,name text NOT NULL,
 source text NOT NULL,source_digest text NOT NULL,bundle_digest text NOT NULL,origin_revision_id uuid REFERENCES payloadbay.shared_module_revision(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payloadbay.middleware_binding (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),scope_type text NOT NULL,scope_id uuid NOT NULL,
 code_revision_id uuid NOT NULL REFERENCES payloadbay.stage_revision(id),stage text NOT NULL CHECK(stage IN ('ingress','processing')),
 position integer NOT NULL,failure_policy text NOT NULL CHECK(failure_policy IN ('required','optional')),
 override_policy text NOT NULL CHECK(override_policy IN ('allowed','forbidden')),origin_binding_id uuid REFERENCES payloadbay.middleware_binding(id),version integer NOT NULL DEFAULT 1
);
CREATE TABLE payloadbay.publication (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),endpoint_id uuid NOT NULL REFERENCES payloadbay.endpoint(id),
 ingress_revision_id uuid NOT NULL REFERENCES payloadbay.stage_revision(id),processing_revision_id uuid NOT NULL REFERENCES payloadbay.stage_revision(id),
 effective_bindings jsonb NOT NULL DEFAULT '[]',shared_versions jsonb NOT NULL DEFAULT '{}',destination_snapshot jsonb NOT NULL DEFAULT '{}',
 dependency_digest text NOT NULL,created_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,endpoint_id)
);
ALTER TABLE payloadbay.endpoint ADD CONSTRAINT endpoint_active_publication FOREIGN KEY(active_publication_id,id) REFERENCES payloadbay.publication(id,endpoint_id);
CREATE TABLE payloadbay.destination (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES payloadbay.project(id),name text NOT NULL,
 http_config jsonb NOT NULL,secret_refs jsonb NOT NULL DEFAULT '[]',concurrency integer NOT NULL DEFAULT 4 CHECK(concurrency BETWEEN 1 AND 64),
 version integer NOT NULL DEFAULT 1,UNIQUE(project_id,name),UNIQUE(id,project_id)
);
CREATE TABLE payloadbay.event (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),endpoint_id uuid NOT NULL REFERENCES payloadbay.endpoint(id),publication_id uuid NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),original_body bytea NOT NULL,headers jsonb NOT NULL,content_type text NOT NULL,
 accepted_body bytea NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',derived_from_event_id uuid REFERENCES payloadbay.event(id),
 FOREIGN KEY(publication_id,endpoint_id) REFERENCES payloadbay.publication(id,endpoint_id),UNIQUE(id,endpoint_id),UNIQUE(id,publication_id)
);
CREATE INDEX event_endpoint_time ON payloadbay.event(endpoint_id,received_at DESC,id DESC);
CREATE TABLE payloadbay.receipt (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL UNIQUE REFERENCES payloadbay.event(id),ack_response_digest text NOT NULL,accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payloadbay.execution (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL,endpoint_id uuid NOT NULL,publication_id uuid NOT NULL,replay_of_id uuid REFERENCES payloadbay.execution(id),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','succeeded','retry_wait','failed_terminal')),
 attempt_number integer NOT NULL DEFAULT 0,dispatch_generation integer NOT NULL DEFAULT 1 CHECK(dispatch_generation>0),
 due_at timestamptz NOT NULL DEFAULT now(),lease_owner text,lease_expiry timestamptz,final_result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(event_id,endpoint_id) REFERENCES payloadbay.event(id,endpoint_id),FOREIGN KEY(publication_id,endpoint_id) REFERENCES payloadbay.publication(id,endpoint_id),UNIQUE(id,endpoint_id)
);
CREATE INDEX execution_recovery ON payloadbay.execution(state,due_at,lease_expiry);
CREATE TABLE payloadbay.dispatch (
 execution_id uuid NOT NULL,endpoint_id uuid NOT NULL,generation integer NOT NULL CHECK(generation>0),graphile_job_id bigint,
 job_key text NOT NULL UNIQUE,scheduled_at timestamptz NOT NULL DEFAULT now(),claim_deadline_at timestamptz NOT NULL,
 PRIMARY KEY(execution_id,generation),FOREIGN KEY(execution_id,endpoint_id) REFERENCES payloadbay.execution(id,endpoint_id)
);
CREATE TABLE payloadbay.managed_operation (
 execution_id uuid NOT NULL REFERENCES payloadbay.execution(id),operation_id text NOT NULL,input_digest text NOT NULL,destination_snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','sending','succeeded','failed','uncertain')),
 generation integer NOT NULL,successful_attempt_id uuid,result jsonb,PRIMARY KEY(execution_id,operation_id)
);
CREATE TABLE payloadbay.delivery_attempt (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),execution_id uuid NOT NULL,operation_id text NOT NULL,execution_attempt integer NOT NULL,generation integer NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),ended_at timestamptz,status_code integer,network_error text,response_digest text,response_body bytea,duration_ms integer,
 FOREIGN KEY(execution_id,operation_id) REFERENCES payloadbay.managed_operation(execution_id,operation_id)
);
ALTER TABLE payloadbay.managed_operation ADD CONSTRAINT successful_attempt FOREIGN KEY(successful_attempt_id) REFERENCES payloadbay.delivery_attempt(id);
CREATE TABLE payloadbay.platform_job (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL,state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','succeeded','failed','expired')),
 generation integer NOT NULL DEFAULT 1,due_at timestamptz NOT NULL DEFAULT now(),expiry timestamptz,lease_owner text,lease_expiry timestamptz,
 encrypted_payload bytea NOT NULL,job_key text NOT NULL UNIQUE,claim_deadline_at timestamptz NOT NULL DEFAULT now()+interval '30 seconds',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payloadbay.audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor text NOT NULL,scope_type text NOT NULL,scope_id uuid NOT NULL,operation text NOT NULL,resource_id text,
 redacted_diff jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payloadbay.change_record (
 cursor bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,scope_type text NOT NULL,scope_id uuid NOT NULL,kind text NOT NULL,resource_id text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payloadbay.notification_rule (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES payloadbay.project(id),endpoint_id uuid,destination_id uuid,
 enabled boolean NOT NULL DEFAULT false,signal text NOT NULL CHECK(signal IN ('failed_operation','terminal_execution')),
 count integer NOT NULL CHECK(count>0),window_seconds integer NOT NULL CHECK(window_seconds>0),severity text NOT NULL CHECK(severity IN ('info','warning','critical')),
 recovery_policy text NOT NULL DEFAULT 'manual',cooldown_seconds integer NOT NULL DEFAULT 0 CHECK(cooldown_seconds>=0),version integer NOT NULL DEFAULT 1,
 FOREIGN KEY(endpoint_id,project_id) REFERENCES payloadbay.endpoint(id,project_id),FOREIGN KEY(destination_id,project_id) REFERENCES payloadbay.destination(id,project_id)
);
CREATE TABLE payloadbay.notification_incident (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),condition_key text NOT NULL,revision text NOT NULL,generation integer NOT NULL DEFAULT 1,kind text NOT NULL,
 scope_type text NOT NULL,scope_id uuid NOT NULL,subject text NOT NULL,severity text NOT NULL CHECK(severity IN ('info','warning','critical')),
 status text NOT NULL CHECK(status IN ('active','resolved')),first_seen timestamptz NOT NULL DEFAULT now(),last_seen timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz,redacted_data jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX active_notification_condition ON payloadbay.notification_incident(condition_key,revision) WHERE status='active';
CREATE TABLE payloadbay.notification_recipient_state (
 incident_id uuid NOT NULL REFERENCES payloadbay.notification_incident(id),user_id text NOT NULL,read_at timestamptz,dismissed_at timestamptz,PRIMARY KEY(incident_id,user_id)
);
CREATE TABLE payloadbay.notification_dispatch (
 incident_id uuid NOT NULL REFERENCES payloadbay.notification_incident(id),generation integer NOT NULL,user_id text NOT NULL,channel text NOT NULL CHECK(channel IN ('inbox','smtp')),
 state text NOT NULL DEFAULT 'queued',platform_job_id uuid REFERENCES payloadbay.platform_job(id),PRIMARY KEY(incident_id,generation,user_id,channel)
);
CREATE TABLE payloadbay.replay_key (
 actor text NOT NULL,event_id uuid NOT NULL REFERENCES payloadbay.event(id),key text NOT NULL,input_digest text NOT NULL,execution_id uuid NOT NULL REFERENCES payloadbay.execution(id),PRIMARY KEY(actor,event_id,key)
);
CREATE FUNCTION payloadbay.reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable history'; END $$;
CREATE TRIGGER immutable_stage BEFORE UPDATE OR DELETE ON payloadbay.stage_revision FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
CREATE TRIGGER immutable_shared BEFORE UPDATE OR DELETE ON payloadbay.shared_module_revision FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
CREATE TRIGGER immutable_publication BEFORE UPDATE OR DELETE ON payloadbay.publication FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
CREATE TRIGGER immutable_event BEFORE UPDATE OR DELETE ON payloadbay.event FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
CREATE TRIGGER immutable_receipt BEFORE UPDATE OR DELETE ON payloadbay.receipt FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON payloadbay.audit FOR EACH ROW EXECUTE FUNCTION payloadbay.reject_history_mutation();
