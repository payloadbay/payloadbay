"use client";

import { use } from "react";
import { AuditLog } from "@components/audit-log";

export default function ScopedAuditPage({ params }: { params: Promise<{ workspaceId: string }> }) {
	const { workspaceId } = use(params);

	return <AuditLog key={workspaceId} scope={{ type: "workspace", id: workspaceId }} />;
}
