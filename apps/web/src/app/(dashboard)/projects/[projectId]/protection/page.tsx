"use client";

import { use } from "react";
import { RequestProtection } from "@components/request-protection";

export default function ProtectionPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

	return <RequestProtection scope={{ type: "project", id: projectId }} />;
}
