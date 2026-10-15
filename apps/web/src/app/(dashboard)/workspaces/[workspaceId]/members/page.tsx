"use client";

import { use } from "react";
import { MemberManager } from "@components/member-manager";
import { useDashboard } from "@components/dashboard-shell";

export default function WorkspaceMembersPage({ params }: { params: Promise<{ workspaceId: string }> }) {
	const { workspaceId } = use(params);

	const { workspaces } = useDashboard();

	const workspace = workspaces.find((item) => item.id === workspaceId);
	if (!workspace?.permissions.includes("members.manage")) return <p>You do not have access to workspace membership settings.</p>;

	return <MemberManager scope={{ type: "workspace", id: workspaceId }} held={workspace.permissions} />;
}
