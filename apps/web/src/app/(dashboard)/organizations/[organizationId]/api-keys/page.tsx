"use client";

import { use } from "react";
import { ApiKeyManager } from "@components/api-key-manager";

export default function OrganizationApiKeysPage({ params }: { params: Promise<{ organizationId: string }> }) {
	const { organizationId } = use(params);

	return <ApiKeyManager organizationId={organizationId} />;
}
