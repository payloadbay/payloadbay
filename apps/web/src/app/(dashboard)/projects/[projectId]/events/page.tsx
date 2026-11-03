"use client";

import { use } from "react";
import { EventBrowser } from "@components/event-browser";

export default function EventsPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

	return <EventBrowser projectId={projectId} />;
}
