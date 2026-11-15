"use client";

import { use } from "react";
import { MemberManager } from "@components/member-manager";
import { useDashboard } from "@components/dashboard-shell";

export default function OrganizationMembersPage({ params }: { params: Promise<{ organizationId: string }> }) {
	const { organizationId } = use(params);

	const { organizations } = useDashboard();

	const organization = organizations.find((item) => item.id === organizationId);
	if (!organization?.permissions.includes("members.manage")) return <p>You do not have access to organization membership settings.</p>;

	return <MemberManager scope={{ type: "organization", id: organizationId }} held={organization.permissions} />;
}
