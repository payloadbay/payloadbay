"use client";

import { use } from "react";
import { AuditLog } from "@components/audit-log";

export default function ScopedAuditPage({ params }: { params: Promise<{ organizationId: string }> }) {
	const { organizationId } = use(params);

	return <AuditLog key={organizationId} scope={{ type: "organization", id: organizationId }} />;
}
