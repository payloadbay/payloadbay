import type { Pool } from "pg";
import type { RunnerOptions, Task } from "graphile-worker";
import { nextOrganizationFlags } from "@payloadbay/domain/organization-scheduling";

export function workerLanes(pool: Pool, tasks: { process_event: Task; platform_job: Task }): Pick<RunnerOptions, "taskList" | "forbiddenFlags" | "concurrency">[] {
	return [
		{ taskList: { process_event: tasks.process_event }, forbiddenFlags: () => nextOrganizationFlags(pool, "critical"), concurrency: 2 },
		{ taskList: { process_event: tasks.process_event }, forbiddenFlags: () => nextOrganizationFlags(pool, "bulk"), concurrency: 1 },
		{ taskList: { platform_job: tasks.platform_job }, forbiddenFlags: ["critical", "bulk", "maintenance"], concurrency: 1 },
		{ taskList: { platform_job: tasks.platform_job }, forbiddenFlags: ["critical", "bulk", "platform"], concurrency: 1 },
	];
}
