"use client";

import { use } from "react";
import { NotificationRules } from "@components/notification-rules";

export default function NotificationRulesPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

	return <NotificationRules projectId={projectId} />;
}
