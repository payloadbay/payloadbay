"use client";

import { use } from "react";
import { MemberManager } from "@components/member-manager";
import { useDashboard } from "@components/dashboard-shell";

export default function ProjectMembersPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

	const { projects } = useDashboard();

	const project = projects.find((project) => project.id === projectId);
	if (!project) return <p role='alert'>Project unavailable.</p>;
	if (!project.permissions.includes("members.manage")) return <p role='alert'>You do not have permission to manage project members.</p>;

	return <MemberManager scope={{ type: "project", id: projectId }} held={project.permissions} />;
}
