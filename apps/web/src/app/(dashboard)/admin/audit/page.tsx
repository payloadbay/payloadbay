"use client";

import { AuditLog } from "@components/audit-log";
import { useDashboard } from "@components/dashboard-shell";

export default function InstanceAuditPage() {
	const { me } = useDashboard();

	return <AuditLog scope={{ type: "instance", id: me.instanceId }} />;
}
