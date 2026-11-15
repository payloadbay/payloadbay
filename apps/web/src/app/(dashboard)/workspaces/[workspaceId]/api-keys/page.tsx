"use client";

import { use } from "react";
import { ApiKeyManager } from "@components/api-key-manager";

export default function WorkspaceApiKeysPage({ params }: { params: Promise<{ workspaceId: string }> }) {
	const { workspaceId } = use(params);

	return <ApiKeyManager workspaceId={workspaceId} />;
}
