"use client";

import { use } from "react";
import { NotificationRules } from "@components/notification-rules";

export default function WorkspaceNotificationRulesPage({ params }: { params: Promise<{ workspaceId: string }> }) {
	const { workspaceId } = use(params);

	return <NotificationRules workspaceId={workspaceId} />;
}
