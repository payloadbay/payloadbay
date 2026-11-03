"use client";

import { use } from "react";
import { RequestProtection } from "@components/request-protection";

export default function ProtectionPage({ params }: { params: Promise<{ endpointId: string }> }) {
	const { endpointId } = use(params);

	return <RequestProtection scope={{ type: "endpoint", id: endpointId }} />;
}
