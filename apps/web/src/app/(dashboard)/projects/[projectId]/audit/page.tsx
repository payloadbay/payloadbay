"use client";

import { use } from "react";
import { AuditLog } from "@components/audit-log";

export default function ScopedAuditPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

	return <AuditLog key={projectId} scope={{ type: "project", id: projectId }} />;
}
