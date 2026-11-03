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
CREATE FUNCTION payloadbay.enqueue(identifier text,payload json,run_at timestamptz,job_key text,priority smallint)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE job_id bigint;
BEGIN
 IF identifier NOT IN ('process_event','platform_job') THEN RAISE EXCEPTION 'unsupported job type'; END IF;
 SELECT (graphile_worker.add_job(identifier,payload,NULL,run_at,5,job_key,priority)).id INTO job_id;
 RETURN job_id;
END $$;
REVOKE ALL ON FUNCTION payloadbay.enqueue(text,json,timestamptz,text,smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION payloadbay.enqueue(text,json,timestamptz,text,smallint) TO payloadbay_app,payloadbay_worker;
CREATE TABLE payloadbay.notification_subscription (
 rule_id uuid NOT NULL REFERENCES payloadbay.notification_rule(id),user_id text NOT NULL,channel text NOT NULL CHECK(channel IN ('inbox','smtp')),enabled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(rule_id,user_id,channel)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON payloadbay.notification_subscription TO payloadbay_app,payloadbay_worker;

-- Domain admission/rate policy stays separate from library identity and sessions.
CREATE TABLE payloadbay.auth_request_window (
 key text PRIMARY KEY,window_started_at timestamptz NOT NULL,count integer NOT NULL CHECK(count>=0)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON payloadbay.auth_request_window TO payloadbay_app;
-- Supported Better Auth migration may add the durable rate-limit table before this revision.
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA auth TO payloadbay_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA auth TO payloadbay_app;
