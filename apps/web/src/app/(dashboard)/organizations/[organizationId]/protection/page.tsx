"use client";

import { use } from "react";
import { RequestProtection } from "@components/request-protection";

export default function ProtectionPage({ params }: { params: Promise<{ organizationId: string }> }) {
	const { organizationId } = use(params);

	return <RequestProtection scope={{ type: "organization", id: organizationId }} />;
}
