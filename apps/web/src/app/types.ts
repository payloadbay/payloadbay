import type { ReactNode } from "react";
import type { Permission } from "@contracts/permissions";

export type AppLayoutProps = Readonly<{ children: ReactNode }>;

export type MeProfile = {
	user: { id: string; name: string; email: string };
	instanceId: string;
	permissions: Permission[];
	roles: Record<string, Permission[]>;
};

export type WorkspaceSummary = {
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
	permissions: Permission[];
};
