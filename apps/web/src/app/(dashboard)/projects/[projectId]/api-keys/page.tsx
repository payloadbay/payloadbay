"use client";

import { use } from "react";
import { ApiKeyManager } from "@components/api-key-manager";

export default function ProjectApiKeysPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

	return <ApiKeyManager projectId={projectId} />;
}
