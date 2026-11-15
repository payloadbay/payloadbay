ALTER TABLE payloadbay.platform_job ADD COLUMN attempt_number integer NOT NULL DEFAULT 0;
ALTER TABLE payloadbay.platform_job ADD COLUMN max_attempts integer NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 20);
GRANT USAGE ON SCHEMA auth TO payloadbay_worker;
GRANT SELECT ON auth."user",auth.verification TO payloadbay_worker;
-- Reserve independent delivery classes through supported Graphile flags, never named per-execution queues.
CREATE OR REPLACE FUNCTION payloadbay.enqueue(identifier text,payload json,run_at timestamptz,job_key text,priority smallint)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE job_id bigint;job_flags text[];
BEGIN
 IF identifier NOT IN ('process_event','platform_job') THEN RAISE EXCEPTION 'unsupported job type'; END IF;
 job_flags:=CASE WHEN identifier='platform_job' THEN ARRAY['platform'] WHEN priority<=0 THEN ARRAY['critical'] ELSE ARRAY['bulk'] END;
 SELECT (graphile_worker.add_job(identifier,payload,NULL,run_at,5,job_key,priority,job_flags)).id INTO job_id;
 RETURN job_id;
END $$;

ALTER TABLE payloadbay.draft ADD COLUMN secret_bindings jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(secret_bindings)='object');

ALTER TABLE payloadbay.destination ADD COLUMN is_default boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX destination_one_default ON payloadbay.destination(project_id) WHERE is_default;

ALTER TABLE payloadbay.execution ADD COLUMN max_attempts integer NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 20);

-- Serialize cursor allocation until transaction commit so SSE backfill cannot skip a later-committing earlier cursor.
CREATE FUNCTION payloadbay.append_change(scope_type text,scope_id uuid,kind text,resource_id text,metadata jsonb DEFAULT '{}')
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
CREATE INDEX execution_event_history ON payloadbay.execution(event_id,created_at DESC,id DESC);
CREATE INDEX delivery_execution_history ON payloadbay.delivery_attempt(execution_id,started_at DESC,id DESC);
CREATE INDEX event_global_history ON payloadbay.event(received_at DESC,id DESC);
