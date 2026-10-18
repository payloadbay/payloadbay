import type { ReactNode } from "react";
import type { Permission } from "@contracts/permissions";

export type AppLayoutProps = Readonly<{ children: ReactNode }>;

export type MeProfile = {
	user: { id: string; name: string; email: string };
	instanceId: string;
	permissions: Permission[];
	roles: Record<string, Permission[]>;
};

export type OrganizationSummary = {
	id: string;
	name: string;
	slug: string;
	installation_id: string;
	permissions: Permission[];
};

export type WorkspaceSummary = {
	organization_id: string;
	id: string;
	name: string;
	slug: string;
	installation_id: string;
	permissions: Permission[];
};

export type ProjectSummary = {
	id: string;
	name: string;
	slug: string;
	workspace_id: string;
	organization_id: string;
	permissions: Permission[];
};

export type TrafficSnapshot = {
	totals: Record<string, number>;
	series: {
		hour: string;
		ingress: number;
		accepted: number;
		rejected: number;
		deliveries: number;
		executions: number;
	}[];
	recent: {
		id: string;
		state: string;
		attempt_number: number;
		created_at: string;
		endpoint_name: string;
		project_id: string;
		project_name: string;
		endpoint_id: string;
	}[];
};
