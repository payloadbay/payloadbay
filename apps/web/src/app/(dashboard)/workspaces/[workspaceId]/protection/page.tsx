"use client";

import { use } from "react";
import { RequestProtection } from "@components/request-protection";

export default function ProtectionPage({ params }: { params: Promise<{ workspaceId: string }> }) {
	const { workspaceId } = use(params);

	return <RequestProtection scope={{ type: "workspace", id: workspaceId }} />;
}
