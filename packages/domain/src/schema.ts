/** Authoritative domain schema. Development pushes this source; CI generates release migrations. */
import { pgSchema, uuid, text, integer, boolean, timestamp, jsonb, bigint, customType, smallint } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { primaryKey, foreignKey, unique, uniqueIndex, index, check, type AnyPgColumn } from "drizzle-orm/pg-core";

const domain = pgSchema("payloadbay");
const bytes = customType<{
	data: Buffer;
	driverData: Buffer;
}>({ dataType: () => "bytea" });

const id = () => uuid("id").primaryKey().defaultRandom();

const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const installation = domain.table(
	"installation",
	{
		id: id(),
		singleton: boolean("singleton").notNull().default(true),
		bootstrapState: text("bootstrap_state").notNull().default("pending"),
		configVersion: integer("config_version").notNull().default(1),
		deploymentMode: text("deployment_mode").notNull().default("self_hosted"),
		workerSeenAt: time("worker_seen_at"),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [check("installation_deployment_mode", sql`${t.deploymentMode} IN ('self_hosted','hosted')`), unique("installation_singleton").on(t.singleton), check("installation_singleton_true", sql`${t.singleton}`), check("installation_bootstrap_state", sql`${t.bootstrapState} IN ('pending','complete')`)],
);

export const admission = domain.table(
	"admission",
	{
		installationId: uuid("installation_id")
			.notNull()
			.references((): AnyPgColumn => installation.id),
		userId: text("user_id").notNull(),
		active: boolean("active").notNull().default(true),
	},
	(t) => [primaryKey({ columns: [t.installationId, t.userId] })],
);

export const organization = domain.table(
	"organization",
	{
		id: id(),
		installationId: uuid("installation_id")
			.notNull()
			.references((): AnyPgColumn => installation.id),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		ownerUserId: text("owner_user_id").notNull(),
		archivedAt: time("archived_at"),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [
		unique("organization_id_installation").on(t.id, t.installationId),
		foreignKey({ name: "organization_owner_admission", columns: [t.installationId, t.ownerUserId], foreignColumns: [admission.installationId as AnyPgColumn, admission.userId as AnyPgColumn] }),
		uniqueIndex("organization_live_slug")
			.on(t.installationId, t.slug)
			.where(sql`${t.archivedAt} IS NULL`),
	],
);

/** Durable per-lane turns are scheduling state, never a permission or billing grant. */
export const organizationDispatchTurn = domain.table(
	"organization_dispatch_turn",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references((): AnyPgColumn => organization.id),
		lane: text("lane").notNull(),
		lastSelectedAt: time("last_selected_at")
			.notNull()
			.default(sql`'epoch'::timestamptz`),
	},
	(t) => [primaryKey({ columns: [t.organizationId, t.lane] }), check("organization_dispatch_lane", sql`${t.lane} IN ('critical','bulk')`)],
);

export const organizationPolicy = domain.table(
	"organization_policy",
	{
		organizationId: uuid("organization_id")
			.primaryKey()
			.references((): AnyPgColumn => organization.id),
		version: integer("version").notNull().default(1),
		limits: jsonb("limits").notNull(),
		processingConcurrency: integer("processing_concurrency").notNull().default(4),
		updatedBy: text("updated_by").notNull(),
		updatedAt: time("updated_at").notNull().defaultNow(),
	},
	(t) => [check("organization_policy_version", sql`${t.version} > 0`), check("organization_policy_capacity", sql`${t.processingConcurrency} BETWEEN 0 AND 128`)],
);

export const organizationPolicyRevision = domain.table(
	"organization_policy_revision",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references((): AnyPgColumn => organization.id),
		version: integer("version").notNull(),
		snapshot: jsonb("snapshot").notNull(),
		createdBy: text("created_by").notNull(),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.organizationId, t.version] })],
);

export const workspace = domain.table(
	"workspace",
	{
		id: id(),
		installationId: uuid("installation_id")
			.notNull()
			.references((): AnyPgColumn => installation.id),
		organizationId: uuid("organization_id").notNull(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		ownerUserId: text("owner_user_id").notNull(),
		archivedAt: time("archived_at"),
	},
	(t) => [
		unique("workspace_id_organization").on(t.id, t.organizationId),
		foreignKey({ name: "workspace_organization_installation", columns: [t.organizationId, t.installationId], foreignColumns: [organization.id as AnyPgColumn, organization.installationId as AnyPgColumn] }),
		foreignKey({ name: "workspace_owner_admission", columns: [t.installationId, t.ownerUserId], foreignColumns: [admission.installationId as AnyPgColumn, admission.userId as AnyPgColumn] }),
		uniqueIndex("workspace_live_slug")
			.on(t.organizationId, t.slug)
			.where(sql`${t.archivedAt} IS NULL`),
	],
);

export const customerOnboarding = domain.table("customer_onboarding", {
	userId: text("user_id").primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references((): AnyPgColumn => organization.id),
	workspaceId: uuid("workspace_id")
		.notNull()
		.references((): AnyPgColumn => workspace.id),
	createdAt: time("created_at").notNull().defaultNow(),
});

export const project = domain.table(
	"project",
	{
		id: id(),
		workspaceId: uuid("workspace_id")
			.notNull()
			.references((): AnyPgColumn => workspace.id),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		ownerUserId: text("owner_user_id").notNull(),
		archivedAt: time("archived_at"),
	},
	(t) => [
		unique("project_id_workspace").on(t.id, t.workspaceId),
		uniqueIndex("project_live_slug")
			.on(t.workspaceId, t.slug)
			.where(sql`${t.archivedAt} IS NULL`),
	],
);

export const usageFact = domain.table(
	"usage_fact",
	{
		id: id(),
		organizationId: uuid("organization_id")
			.notNull()
			.references((): AnyPgColumn => organization.id),
		workspaceId: uuid("workspace_id"),
		projectId: uuid("project_id"),
		metric: text("metric").notNull(),
		sourceKey: text("source_key").notNull(),
		quantity: bigint("quantity", { mode: "bigint" })
			.notNull()
			.default(sql`1`),
		occurredAt: time("occurred_at")
			.notNull()
			.default(sql`clock_timestamp()`),
	},
	(t) => [
		unique("usage_fact_source").on(t.organizationId, t.metric, t.sourceKey),
		foreignKey({ name: "usage_fact_workspace_organization", columns: [t.workspaceId, t.organizationId], foreignColumns: [workspace.id, workspace.organizationId] }),
		foreignKey({ name: "usage_fact_project_workspace", columns: [t.projectId, t.workspaceId], foreignColumns: [project.id, project.workspaceId] }),
		check("usage_fact_project_parent", sql`${t.projectId} IS NULL OR ${t.workspaceId} IS NOT NULL`),
		check("usage_fact_positive", sql`${t.quantity} > 0`),
		check("usage_fact_key_length", sql`octet_length(${t.sourceKey}) BETWEEN 1 AND 256`),
		index("usage_fact_by_organization_time").on(t.organizationId, t.occurredAt, t.metric),
	],
);

export const usageCounter = domain.table(
	"usage_counter",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references((): AnyPgColumn => organization.id),
		metric: text("metric").notNull(),
		quantity: bigint("quantity", { mode: "bigint" })
			.notNull()
			.default(sql`0`),
	},
	(t) => [primaryKey({ columns: [t.organizationId, t.metric] }), check("usage_counter_nonnegative", sql`${t.quantity} >= 0`)],
);

export const admissionWindowCounter = domain.table(
	"admission_window_counter",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references((): AnyPgColumn => organization.id),
		windowStart: time("window_start").notNull(),
		windowEnd: time("window_end").notNull(),
		quantity: bigint("quantity", { mode: "bigint" })
			.notNull()
			.default(sql`0`),
	},
	(t) => [primaryKey({ columns: [t.organizationId, t.windowStart, t.windowEnd] }), check("admission_window_range", sql`${t.windowStart} < ${t.windowEnd}`), check("admission_window_nonnegative", sql`${t.quantity} >= 0`)],
);

export const usageHour = domain.table(
	"usage_hour",
	{
		organizationId: uuid("organization_id")
			.notNull()
			.references((): AnyPgColumn => organization.id),
		metric: text("metric").notNull(),
		windowStart: time("window_start").notNull(),
		quantity: bigint("quantity", { mode: "bigint" })
			.notNull()
			.default(sql`0`),
	},
	(t) => [primaryKey({ columns: [t.organizationId, t.metric, t.windowStart] }), check("usage_hour_nonnegative", sql`${t.quantity} >= 0`)],
);

export const grant = domain.table(
	"grant_record",
	{
		id: id(),
		userId: text("user_id").notNull(),
		scopeType: text("scope_type").notNull(),
		scopeId: uuid("scope_id").notNull(),
		rolePreset: text("role_preset").notNull(),
		permissions: text("permissions").array().notNull(),
		version: integer("version").notNull().default(1),
	},
	(t) => [unique("grant_user_scope").on(t.userId, t.scopeType, t.scopeId), check("grant_scope_type", sql`${t.scopeType} IN ('instance','organization','workspace','project')`), check("grant_role", sql`${t.rolePreset} IN ('owner','admin','operator','viewer','custom')`), index("grants_by_scope").on(t.scopeType, t.scopeId, t.userId)],
);

export const apiToken = domain.table(
	"api_token",
	{
		id: id(),
		userId: text("user_id").notNull(),
		scopeType: text("scope_type").notNull(),
		scopeId: uuid("scope_id").notNull(),
		name: text("name").notNull(),
		permissions: text("permissions").array().notNull(),
		workspaceIds: uuid("workspace_ids").array(),
		personal: boolean("personal").notNull().default(false),
		hash: text("hash").notNull(),
		expiresAt: time("expires_at").notNull(),
		revokedAt: time("revoked_at"),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [unique("api_token_hash").on(t.hash)],
);

export const secretVersion = domain.table(
	"secret_version",
	{
		id: id(),
		scopeType: text("scope_type").notNull(),
		scopeId: uuid("scope_id").notNull(),
		name: text("name").notNull(),
		version: integer("version").notNull(),
		encryptedValue: bytes("encrypted_value").notNull(),
		keyId: text("key_id").notNull(),
		revokedAt: time("revoked_at"),
	},
	(t) => [unique("secret_scope_name_version").on(t.scopeType, t.scopeId, t.name, t.version)],
);

export const endpoint = domain.table(
	"endpoint",
	{
		id: id(),
		projectId: uuid("project_id")
			.notNull()
			.references((): AnyPgColumn => project.id),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		ingressKey: text("ingress_key").notNull(),
		activePublicationId: uuid("active_publication_id"),
		paused: boolean("paused").notNull().default(false),
		priority: smallint("priority").notNull().default(0),
		configVersion: integer("config_version").notNull().default(1),
		deploymentMode: text("deployment_mode").notNull().default("self_hosted"),
	},
	(t) => [unique("endpoint_ingress_key").on(t.ingressKey), unique("endpoint_project_slug").on(t.projectId, t.slug), unique("endpoint_id_project").on(t.id, t.projectId), foreignKey({ name: "endpoint_active_publication", columns: [t.activePublicationId, t.id], foreignColumns: [publication.id as AnyPgColumn, publication.endpointId as AnyPgColumn] })],
);

export const ingressPolicy = domain.table("ingress_policy", {
	endpointId: uuid("endpoint_id")
		.primaryKey()
		.references((): AnyPgColumn => endpoint.id, { onDelete: "cascade" }),
	version: integer("version").notNull(),
	encryptedPolicy: bytes("encrypted_policy").notNull(),
});

export const ingressRateBucket = domain.table("ingress_rate_bucket", {
	endpointId: uuid("endpoint_id")
		.primaryKey()
		.references((): AnyPgColumn => endpoint.id, { onDelete: "cascade" }),
	policyVersion: integer("policy_version").notNull(),
	windowStart: time("window_start").notNull(),
	hits: integer("hits").notNull(),
});

export const draft = domain.table(
	"draft",
	{
		id: id(),
		endpointId: uuid("endpoint_id")
			.notNull()
			.references((): AnyPgColumn => endpoint.id),
		stage: text("stage").notNull(),
		body: text("body").notNull().default(""),
		sharedBindings: jsonb("shared_bindings").notNull().default({}),
		secretBindings: jsonb("secret_bindings").notNull().default({}),
		version: integer("version").notNull().default(1),
	},
	(t) => [unique("draft_endpoint_stage").on(t.endpointId, t.stage), check("draft_stage", sql`${t.stage} IN ('ingress','processing')`), check("draft_secret_bindings_object", sql`jsonb_typeof(${t.secretBindings})='object'`)],
);

export const stageRevision = domain.table(
	"stage_revision",
	{
		id: id(),
		stage: text("stage").notNull(),
		body: text("body").notNull(),
		bodyDigest: text("body_digest").notNull(),
		sdkVersion: text("sdk_version").notNull(),
		bundle: text("bundle").notNull(),
		bundleDigest: text("bundle_digest").notNull(),
		sourceMap: jsonb("source_map").notNull(),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [check("stage_revision_stage", sql`${t.stage} IN ('ingress','processing','ingress_middleware','processing_middleware')`)],
);

export const sharedModuleRevision = domain.table("shared_module_revision", {
	id: id(),
	scopeType: text("scope_type").notNull(),
	scopeId: uuid("scope_id").notNull(),
	name: text("name").notNull(),
	source: text("source").notNull(),
	sourceDigest: text("source_digest").notNull(),
	bundleDigest: text("bundle_digest").notNull(),
	originRevisionId: uuid("origin_revision_id").references((): AnyPgColumn => sharedModuleRevision.id),
	createdAt: time("created_at").notNull().defaultNow(),
});

export const middlewareBinding = domain.table(
	"middleware_binding",
	{
		id: id(),
		scopeType: text("scope_type").notNull(),
		scopeId: uuid("scope_id").notNull(),
		codeRevisionId: uuid("code_revision_id")
			.notNull()
			.references((): AnyPgColumn => stageRevision.id),
		stage: text("stage").notNull(),
		position: integer("position").notNull(),
		failurePolicy: text("failure_policy").notNull(),
		overridePolicy: text("override_policy").notNull(),
		originBindingId: uuid("origin_binding_id").references((): AnyPgColumn => middlewareBinding.id),
		name: text("name").notNull().default("Middleware"),
		requiredAction: text("required_action").notNull().default("retry"),
		enabled: boolean("enabled").notNull().default(true),
		compiledManifest: jsonb("compiled_manifest").notNull().default({}),
		sharedBindings: jsonb("shared_bindings").notNull().default({}),
		secretBindings: jsonb("secret_bindings").notNull().default({}),
		version: integer("version").notNull().default(1),
	},
	(t) => [check("middleware_required_action", sql`${t.requiredAction} IN ('retry','fail')`), check("middleware_stage", sql`${t.stage} IN ('ingress','processing')`), check("middleware_failure_policy", sql`${t.failurePolicy} IN ('required','optional')`), check("middleware_override_policy", sql`${t.overridePolicy} IN ('allowed','forbidden')`)],
);

export const publication = domain.table(
	"publication",
	{
		id: id(),
		endpointId: uuid("endpoint_id")
			.notNull()
			.references((): AnyPgColumn => endpoint.id),
		ingressRevisionId: uuid("ingress_revision_id")
			.notNull()
			.references((): AnyPgColumn => stageRevision.id),
		processingRevisionId: uuid("processing_revision_id")
			.notNull()
			.references((): AnyPgColumn => stageRevision.id),
		effectiveBindings: jsonb("effective_bindings").notNull().default([]),
		sharedVersions: jsonb("shared_versions").notNull().default({}),
		destinationSnapshot: jsonb("destination_snapshot").notNull().default({}),
		dependencyDigest: text("dependency_digest").notNull(),
		createdBy: text("created_by").notNull(),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [unique("publication_id_endpoint").on(t.id, t.endpointId)],
);

// Archive metadata is separate so published code and historical references remain immutable.
export const publicationArchive = domain.table("publication_archive", {
	publicationId: uuid("publication_id")
		.primaryKey()
		.references(() => publication.id),
	archivedBy: text("archived_by").notNull(),
	archivedAt: time("archived_at").notNull().defaultNow(),
});

export const destination = domain.table(
	"destination",
	{
		id: id(),
		projectId: uuid("project_id")
			.notNull()
			.references((): AnyPgColumn => project.id),
		name: text("name").notNull(),
		isDefault: boolean("is_default").notNull().default(false),
		httpConfig: jsonb("http_config").notNull(),
		secretRefs: jsonb("secret_refs").notNull().default([]),
		concurrency: integer("concurrency").notNull().default(4),
		version: integer("version").notNull().default(1),
	},
	(t) => [
		unique("destination_project_name").on(t.projectId, t.name),
		unique("destination_id_project").on(t.id, t.projectId),
		check("destination_concurrency", sql`${t.concurrency} BETWEEN 1 AND 64`),
		uniqueIndex("destination_one_default")
			.on(t.projectId)
			.where(sql`${t.isDefault}`),
	],
);

export const event = domain.table(
	"event",
	{
		id: id(),
		endpointId: uuid("endpoint_id")
			.notNull()
			.references((): AnyPgColumn => endpoint.id),
		publicationId: uuid("publication_id").notNull(),
		receivedAt: time("received_at").notNull().defaultNow(),
		originalBody: bytes("original_body").notNull(),
		ingressOutcome: text("ingress_outcome").notNull().default("accept"),
		requestMethod: text("request_method").notNull().default("POST"),
		responseStatus: integer("response_status"),
		headers: jsonb("headers").notNull(),
		contentType: text("content_type").notNull(),
		acceptedBody: bytes("accepted_body").notNull(),
		metadata: jsonb("metadata").notNull().default({}),
		derivedFromEventId: uuid("derived_from_event_id").references((): AnyPgColumn => event.id),
	},
	(t) => [
		check("event_ingress_outcome", sql`${t.ingressOutcome} IN ('accept','reject','respondOnly','error')`),
		foreignKey({ name: "event_publication_endpoint", columns: [t.publicationId, t.endpointId], foreignColumns: [publication.id as AnyPgColumn, publication.endpointId as AnyPgColumn] }),
		unique("event_id_endpoint").on(t.id, t.endpointId),
		unique("event_id_publication").on(t.id, t.publicationId),
		index("event_endpoint_time").on(t.endpointId, t.receivedAt.desc(), t.id.desc()),
		index("event_global_history").on(t.receivedAt.desc(), t.id.desc()),
		index("event_derived_parent").on(t.derivedFromEventId),
	],
);

export const receipt = domain.table(
	"receipt",
	{
		id: id(),
		eventId: uuid("event_id")
			.notNull()
			.references((): AnyPgColumn => event.id),
		ackResponseDigest: text("ack_response_digest").notNull(),
		acceptedAt: time("accepted_at").notNull().defaultNow(),
	},
	(t) => [unique("receipt_event").on(t.eventId)],
);

export const execution = domain.table(
	"execution",
	{
		id: id(),
		eventId: uuid("event_id").notNull(),
		endpointId: uuid("endpoint_id").notNull(),
		publicationId: uuid("publication_id").notNull(),
		replayOfId: uuid("replay_of_id").references((): AnyPgColumn => execution.id),
		state: text("state").notNull().default("queued"),
		attemptNumber: integer("attempt_number").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(5),
		dispatchGeneration: integer("dispatch_generation").notNull().default(1),
		dueAt: time("due_at").notNull().defaultNow(),
		leaseOwner: text("lease_owner"),
		leaseExpiry: time("lease_expiry"),
		finalResult: jsonb("final_result"),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [
		foreignKey({ name: "execution_event_endpoint", columns: [t.eventId, t.endpointId], foreignColumns: [event.id as AnyPgColumn, event.endpointId as AnyPgColumn] }),
		foreignKey({ name: "execution_publication_endpoint", columns: [t.publicationId, t.endpointId], foreignColumns: [publication.id as AnyPgColumn, publication.endpointId as AnyPgColumn] }),
		unique("execution_id_endpoint").on(t.id, t.endpointId),
		check("execution_state", sql`${t.state} IN ('queued','running','succeeded','retry_wait','failed_terminal')`),
		check("execution_generation", sql`${t.dispatchGeneration}>0`),
		check("execution_max_attempts", sql`${t.maxAttempts} BETWEEN 1 AND 20`),
		index("execution_recovery").on(t.state, t.dueAt, t.leaseExpiry),
		index("execution_event_history").on(t.eventId, t.createdAt.desc(), t.id.desc()),
		index("execution_replay_parent").on(t.replayOfId),
	],
);

export const processingAttempt = domain.table(
	"processing_attempt",
	{
		executionId: uuid("execution_id")
			.notNull()
			.references((): AnyPgColumn => execution.id, { onDelete: "cascade" }),
		attemptNumber: integer("attempt_number").notNull(),
		generation: integer("generation").notNull(),
		state: text("state").notNull().default("running"),
		startedAt: time("started_at").notNull().defaultNow(),
		endedAt: time("ended_at"),
		result: jsonb("result"),
	},
	(t) => [primaryKey({ columns: [t.executionId, t.attemptNumber] }), check("processing_attempt_state", sql`${t.state} IN ('running','succeeded','retry_wait','failed_terminal','interrupted')`)],
);

export const dispatch = domain.table(
	"dispatch",
	{
		executionId: uuid("execution_id").notNull(),
		endpointId: uuid("endpoint_id").notNull(),
		generation: integer("generation").notNull(),
		graphileJobId: bigint("graphile_job_id", { mode: "bigint" }),
		jobKey: text("job_key").notNull(),
		scheduledAt: time("scheduled_at").notNull().defaultNow(),
		claimDeadlineAt: time("claim_deadline_at").notNull(),
	},
	(t) => [primaryKey({ columns: [t.executionId, t.generation] }), foreignKey({ name: "dispatch_execution_endpoint", columns: [t.executionId, t.endpointId], foreignColumns: [execution.id as AnyPgColumn, execution.endpointId as AnyPgColumn] }), unique("dispatch_job_key").on(t.jobKey), check("dispatch_generation", sql`${t.generation}>0`)],
);

export const managedOperation = domain.table(
	"managed_operation",
	{
		executionId: uuid("execution_id")
			.notNull()
			.references((): AnyPgColumn => execution.id),
		operationId: text("operation_id").notNull(),
		inputDigest: text("input_digest").notNull(),
		destinationSnapshot: jsonb("destination_snapshot").notNull(),
		state: text("state").notNull().default("ready"),
		generation: integer("generation").notNull(),
		successfulAttemptId: uuid("successful_attempt_id").references((): AnyPgColumn => deliveryAttempt.id),
		result: jsonb("result"),
	},
	(t) => [primaryKey({ columns: [t.executionId, t.operationId] }), check("managed_operation_state", sql`${t.state} IN ('ready','sending','succeeded','failed','uncertain')`)],
);

export const deliveryAttempt = domain.table(
	"delivery_attempt",
	{
		id: id(),
		executionId: uuid("execution_id").notNull(),
		operationId: text("operation_id").notNull(),
		executionAttempt: integer("execution_attempt").notNull(),
		generation: integer("generation").notNull(),
		capacityKey: text("capacity_key"),
		startedAt: time("started_at").notNull().defaultNow(),
		endedAt: time("ended_at"),
		statusCode: integer("status_code"),
		networkError: text("network_error"),
		responseDigest: text("response_digest"),
		responseBody: bytes("response_body"),
		durationMs: integer("duration_ms"),
	},
	(t) => [
		foreignKey({ name: "delivery_operation", columns: [t.executionId, t.operationId], foreignColumns: [managedOperation.executionId as AnyPgColumn, managedOperation.operationId as AnyPgColumn] }),
		index("delivery_execution_history").on(t.executionId, t.startedAt.desc(), t.id.desc()),
		index("delivery_live_capacity")
			.on(t.capacityKey)
			.where(sql`${t.endedAt} IS NULL`),
	],
);

export const platformJob = domain.table(
	"platform_job",
	{
		id: id(),
		kind: text("kind").notNull(),
		state: text("state").notNull().default("queued"),
		generation: integer("generation").notNull().default(1),
		dueAt: time("due_at").notNull().defaultNow(),
		expiry: time("expiry"),
		leaseOwner: text("lease_owner"),
		leaseExpiry: time("lease_expiry"),
		encryptedPayload: bytes("encrypted_payload").notNull(),
		lastError: text("last_error"),
		jobKey: text("job_key").notNull(),
		claimDeadlineAt: time("claim_deadline_at")
			.notNull()
			.default(sql`now()+interval '30 seconds'`),
		createdAt: time("created_at").notNull().defaultNow(),
		attemptNumber: integer("attempt_number").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(5),
	},
	(t) => [unique("platform_job_key").on(t.jobKey), check("platform_job_state", sql`${t.state} IN ('queued','running','succeeded','failed','expired')`), check("platform_job_max_attempts", sql`${t.maxAttempts} BETWEEN 1 AND 20`)],
);

export const audit = domain.table("audit", {
	id: id(),
	actor: text("actor").notNull(),
	scopeType: text("scope_type").notNull(),
	scopeId: uuid("scope_id").notNull(),
	operation: text("operation").notNull(),
	resourceId: text("resource_id"),
	redactedDiff: jsonb("redacted_diff").notNull().default({}),
	createdAt: time("created_at").notNull().defaultNow(),
});

export const changeRecord = domain.table("change_record", {
	cursor: bigint("cursor", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
	scopeType: text("scope_type").notNull(),
	scopeId: uuid("scope_id").notNull(),
	kind: text("kind").notNull(),
	resourceId: text("resource_id").notNull(),
	metadata: jsonb("metadata").notNull().default({}),
	createdAt: time("created_at").notNull().defaultNow(),
});

export const notificationRule = domain.table(
	"notification_rule",
	{
		id: id(),
		projectId: uuid("project_id").references((): AnyPgColumn => project.id),
		workspaceId: uuid("workspace_id").references((): AnyPgColumn => workspace.id),
		endpointId: uuid("endpoint_id"),
		destinationId: uuid("destination_id"),
		enabled: boolean("enabled").notNull().default(false),
		signal: text("signal").notNull(),
		count: integer("count").notNull(),
		windowSeconds: integer("window_seconds").notNull(),
		severity: text("severity").notNull(),
		recoveryPolicy: text("recovery_policy").notNull().default("manual"),
		cooldownSeconds: integer("cooldown_seconds").notNull().default(0),
		version: integer("version").notNull().default(1),
	},
	(t) => [
		foreignKey({ name: "notification_rule_endpoint", columns: [t.endpointId, t.projectId], foreignColumns: [endpoint.id as AnyPgColumn, endpoint.projectId as AnyPgColumn] }),
		foreignKey({ name: "notification_rule_destination", columns: [t.destinationId, t.projectId], foreignColumns: [destination.id as AnyPgColumn, destination.projectId as AnyPgColumn] }),
		check("notification_rule_scope", sql`num_nonnulls(${t.projectId},${t.workspaceId})=1 AND (${t.workspaceId} IS NULL OR (${t.endpointId} IS NULL AND ${t.destinationId} IS NULL))`),
		check("notification_rule_signal", sql`${t.signal} IN ('failed_operation','terminal_execution')`),
		check("notification_rule_count", sql`${t.count}>0`),
		check("notification_rule_window", sql`${t.windowSeconds}>0`),
		check("notification_rule_severity", sql`${t.severity} IN ('info','warning','critical')`),
		check("notification_rule_cooldown", sql`${t.cooldownSeconds}>=0`),
	],
);

export const notificationIncident = domain.table(
	"notification_incident",
	{
		id: id(),
		conditionKey: text("condition_key").notNull(),
		revision: text("revision").notNull(),
		generation: integer("generation").notNull().default(1),
		kind: text("kind").notNull(),
		scopeType: text("scope_type").notNull(),
		scopeId: uuid("scope_id").notNull(),
		subject: text("subject").notNull(),
		severity: text("severity").notNull(),
		status: text("status").notNull(),
		firstSeen: time("first_seen").notNull().defaultNow(),
		lastSeen: time("last_seen").notNull().defaultNow(),
		resolvedAt: time("resolved_at"),
		redactedData: jsonb("redacted_data").notNull().default({}),
	},
	(t) => [
		check("notification_incident_status", sql`${t.status} IN ('active','resolved')`),
		check("notification_incident_severity", sql`${t.severity} IN ('info','warning','critical')`),
		uniqueIndex("active_notification_condition")
			.on(t.conditionKey, t.revision)
			.where(sql`${t.status}='active'`),
	],
);

export const notificationRecipientState = domain.table(
	"notification_recipient_state",
	{
		incidentId: uuid("incident_id")
			.notNull()
			.references((): AnyPgColumn => notificationIncident.id),
		userId: text("user_id").notNull(),
		readAt: time("read_at"),
		dismissedAt: time("dismissed_at"),
		snoozedUntil: time("snoozed_until"),
	},
	(t) => [primaryKey({ columns: [t.incidentId, t.userId] })],
);

export const notificationDispatch = domain.table(
	"notification_dispatch",
	{
		incidentId: uuid("incident_id")
			.notNull()
			.references((): AnyPgColumn => notificationIncident.id),
		generation: integer("generation").notNull(),
		userId: text("user_id").notNull(),
		channel: text("channel").notNull(),
		state: text("state").notNull().default("queued"),
		platformJobId: uuid("platform_job_id").references((): AnyPgColumn => platformJob.id),
	},
	(t) => [primaryKey({ columns: [t.incidentId, t.generation, t.userId, t.channel] }), check("notification_dispatch_channel", sql`(${t.channel} IN ('inbox','smtp') OR ${t.channel} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')`)],
);

export const notificationSubscription = domain.table(
	"notification_subscription",
	{
		ruleId: uuid("rule_id")
			.notNull()
			.references((): AnyPgColumn => notificationRule.id),
		userId: text("user_id").notNull(),
		channel: text("channel").notNull(),
		channelRevisionId: uuid("channel_revision_id").references(() => notificationChannelRevision.id),
		enabled: boolean("enabled").notNull().default(false),
	},
	(t) => [primaryKey({ columns: [t.ruleId, t.userId, t.channel] }), check("notification_subscription_channel", sql`(${t.channel} IN ('inbox','smtp') OR ${t.channel} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')`)],
);

export const replayKey = domain.table(
	"replay_key",
	{
		actor: text("actor").notNull(),
		eventId: uuid("event_id")
			.notNull()
			.references((): AnyPgColumn => event.id),
		key: text("key").notNull(),
		inputDigest: text("input_digest").notNull(),
		executionId: uuid("execution_id")
			.notNull()
			.references((): AnyPgColumn => execution.id),
	},
	(t) => [primaryKey({ columns: [t.actor, t.eventId, t.key] }), index("replay_key_event").on(t.eventId), index("replay_key_execution").on(t.executionId)],
);

export const authRequestWindow = domain.table("auth_request_window", { key: text("key").primaryKey(), windowStartedAt: time("window_started_at").notNull(), count: integer("count").notNull() }, (t) => [check("auth_request_window_count", sql`${t.count}>=0`)]);

export const invitation = domain.table(
	"invitation",
	{
		id: id(),
		installationId: uuid("installation_id")
			.notNull()
			.references(() => installation.id),
		scopeType: text("scope_type").notNull(),
		scopeId: uuid("scope_id").notNull(),
		email: text("email").notNull(),
		tokenDigest: text("token_digest").notNull().unique(),
		grants: jsonb("grants").notNull(),
		createdBy: text("created_by").notNull(),
		acceptedBy: text("accepted_by"),
		newlyAdmitted: boolean("newly_admitted").notNull().default(false),
		state: text("state").notNull().default("pending"),
		expiresAt: time("expires_at")
			.notNull()
			.default(sql`now() + interval '7 days'`),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [check("invitation_state", sql`${t.state} IN ('pending','accepted','cancelled')`), check("invitation_scope", sql`${t.scopeType} IN ('instance','organization','workspace','project')`), index("invitation_by_scope").on(t.scopeType, t.scopeId, t.state)],
);

export const notificationChannel = domain.table(
	"notification_channel",
	{
		id: id(),
		installationId: uuid("installation_id")
			.notNull()
			.references(() => installation.id),
		name: text("name").notNull(),
		kind: text("kind").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		version: integer("version").notNull().default(1),
		activeRevisionId: uuid("active_revision_id"),
		originKey: text("origin_key"),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [check("notification_channel_kind", sql`${t.kind} IN ('email','webhook')`), check("notification_channel_version", sql`${t.version}>0`), foreignKey({ name: "notification_channel_active_revision", columns: [t.id, t.activeRevisionId], foreignColumns: [notificationChannelRevision.channelId, notificationChannelRevision.id] })],
);

export const notificationChannelRevision = domain.table(
	"notification_channel_revision",
	{
		id: id(),
		channelId: uuid("channel_id")
			.notNull()
			.references((): AnyPgColumn => notificationChannel.id),
		version: integer("version").notNull(),
		source: text("source").notNull(),
		compiled: jsonb("compiled").notNull(),
		sharedBindings: jsonb("shared_bindings").notNull().default({}),
		secretBindings: jsonb("secret_bindings").notNull().default({}),
		createdBy: text("created_by").notNull(),
		createdAt: time("created_at").notNull().defaultNow(),
	},
	(t) => [unique("notification_channel_revision_version").on(t.channelId, t.version), unique("notification_channel_revision_identity").on(t.channelId, t.id), check("notification_channel_revision_positive", sql`${t.version}>0`)],
);

export const emailSettings = domain.table("email_settings", {
	installationId: uuid("installation_id")
		.primaryKey()
		.references(() => installation.id),
	channelId: uuid("channel_id").references(() => notificationChannel.id),
	branding: jsonb("branding").notNull().default({}),
	version: integer("version").notNull().default(1),
	updatedBy: text("updated_by").notNull(),
});

export const installationConfiguration = domain.table("installation_configuration", {
	installationId: uuid("installation_id")
		.primaryKey()
		.references(() => installation.id),
	version: integer("version").notNull().default(1),
	encryptedSettings: bytes("encrypted_settings").notNull(),
	updatedAt: time("updated_at").notNull().defaultNow(),
});

export const savedScriptTest = domain.table("saved_script_test", {
	id: id(),
	endpointId: uuid("endpoint_id")
		.notNull()
		.references(() => endpoint.id),
	name: text("name").notNull(),
	version: integer("version").notNull().default(1),
	encryptedDefinition: bytes("encrypted_definition").notNull(),
	updatedAt: time("updated_at").notNull().defaultNow(),
});

export const organizationSecurity = domain.table("organization_security", {
	organizationId: uuid("organization_id")
		.primaryKey()
		.references(() => organization.id),
	requirePasskey: boolean("require_passkey").notNull().default(false),
	version: integer("version").notNull().default(1),
});
