"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useState, useEffect, useCallback } from "react";
import { Button, Table, Label } from "@heroui/react";
import { EmptyState, Sheet, NativeSelect } from "@heroui-pro/react";
import { IconInbox, IconEye, IconRefresh, IconPlayerPlay } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import type { ProjectSummary } from "@types";

type Summary = {
	eventId?: string;
	id: string;
	endpointId: string;
	projectId: string;
	endpointName: string;
	receivedAt: string;
	bodyBytes: number;
	executionId: string | null;
	state: string | null;
	processingAttempts: number | null;
	deliveryAttempts: number;
};
type Page = { items: Summary[]; nextCursor: string | null };
type Execution = {
	id: string;
	state: string;
	attempt_number: number;
	publication_id: string;
	created_at: string;
};
type Attempt = {
	id: string;
	operation_id: string;
	status_code: number | null;
	network_error: string | null;
	started_at: string;
};
type Detail = {
	ingressOutcome: string;
	method: string;
	responseStatus: number | null;
	id: string;
	projectId: string;
	endpointName: string;
	contentType: string;
	bodyBytes: number;
	executions: Execution[];
	attempts: Attempt[];
};
type Payload = {
	originalBody: string;
	acceptedBody: string;
	headers: Record<string, string>;
	metadata: Record<string, unknown>;
	encoding: string;
};

const labels: Record<string, string> = {
	delivered: "Delivered",
	delivery_failed: "Delivery failed",
	error: "Ingress failed",
	reject: "Rejected",
	respondOnly: "Response only",
	accept: "Accepted",
	queued: "Accepted · queued",
	running: "Processing",
	retry_wait: "Retry scheduled",
	succeeded: "Handler completed",
	failed_terminal: "Needs attention",
};

function decode(value: string) {
	return new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));
}

export function EventBrowser({ projectId, endpointId, embedded = false }: { projectId?: string; endpointId?: string; embedded?: boolean }) {
	const { me, projects, workspaces } = useDashboard();

	const [projectFilter, setProjectFilter] = useState("");
	const [workspaceFilter, setWorkspaceFilter] = useState("");
	const [stateFilter, setStateFilter] = useState("");
	const [view, setView] = useState<"requests" | "attempts">("requests");

	const activeProjectId = projectId ?? projectFilter;

	const [project, setProject] = useState<ProjectSummary | null>(null);
	const [page, setPage] = useState<Page>({ items: [], nextCursor: null });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [selected, setSelected] = useState<string | null>(null);
	const [detail, setDetail] = useState<Detail | null>(null);
	const [payload, setPayload] = useState<Payload | null>(null);
	const [detailError, setDetailError] = useState("");
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");
	const [policy, setPolicy] = useState<"original" | "current">("original");

	useFeedbackToast(error, notice, { error: "Events error", success: "Replay status" });

	useFeedbackToast(detailError, "", { error: "Event inspection error" });

	const fetchData = useCallback(
		(cursor?: string) => {
			const query = new URLSearchParams();
			if (cursor) query.set("cursor", cursor);
			if (endpointId) query.set("endpointId", endpointId);
			if (stateFilter && view === "requests") query.set("state", stateFilter);
			query.set("view", view);
			if (!activeProjectId && workspaceFilter) query.set("workspaceId", workspaceFilter);
			const address = activeProjectId ? "/projects/" + activeProjectId + "/events" : "/events";

			return Promise.all([activeProjectId ? api<ProjectSummary>("/projects/" + activeProjectId) : Promise.resolve(null), api<Page>(address + (query.size ? "?" + query.toString() : ""))]);
		},
		[activeProjectId, endpointId, stateFilter, workspaceFilter, view],
	);

	const receive = useCallback(([p, list]: [ProjectSummary | null, Page], append = false) => {
		setProject(p);
		setPage((previous) => (append ? { ...list, items: [...previous.items, ...list.items] } : list));
		setError("");
		setLoading(false);
	}, []);

	const failed = useCallback((cause: unknown) => {
		setError(cause instanceof Error ? cause.message : "Events unavailable");
		setLoading(false);
	}, []);

	const load = useCallback(
		async (cursor?: string, append = false) => {
			try {
				receive(await fetchData(cursor), append);
			} catch (cause) {
				failed(cause);
			}
		},
		[fetchData, receive, failed],
	);

	useEffect(() => {
		let active = true;
		fetchData().then(
			(data) => {
				if (active) receive(data);
			},
			(cause) => {
				if (active) failed(cause);
			},
		);

		return () => {
			active = false;
		};
	}, [fetchData, receive, failed]);

	useEffect(() => {
		const scopes = activeProjectId ? [{ type: "project", id: activeProjectId }] : [{ type: "accessible", id: me.instanceId }];
		const streams = scopes.map((scope) => new EventSource("/api/v1/changes?scopeType=" + scope.type + "&scopeId=" + encodeURIComponent(scope.id)));
		let refresh: ReturnType<typeof setTimeout> | undefined;

		const changed = () => {
			if (refresh) return;
			refresh = setTimeout(() => {
				refresh = undefined;
				void load();
			}, 100);
		};

		for (const updates of streams) {
			let opened = false;
			updates.onopen = () => {
				if (opened) changed();
				opened = true;
			};

			for (const kind of ["event.recorded", "event.accepted", "execution.changed", "attempt.completed", "configuration.changed", "resync-required"]) updates.addEventListener(kind, changed);
		}

		return () => {
			for (const updates of streams) updates.close();
			if (refresh) clearTimeout(refresh);
		};
	}, [activeProjectId, me.instanceId, me.permissions, projects, load]);

	const inspectionProject = projects.find((item) => item.id === page.items.find((event) => (event.eventId ?? event.id) === selected)?.projectId) ?? project;

	useEffect(() => {
		if (!selected || !inspectionProject) return;
		let active = true;
		Promise.all([api<Detail>("/events/" + selected), inspectionProject.permissions.includes("payload.read") ? api<Payload>("/events/" + selected + "/payload") : Promise.resolve(null)]).then(
			([next, body]) => {
				if (!active) return;
				if (activeProjectId && next.projectId !== activeProjectId) {
					setDetailError("Event does not belong to this project");

					return;
				}

				setDetail(next);
				setPayload(body);
			},
			(cause) => {
				if (active) setDetailError(cause instanceof Error ? cause.message : "Event unavailable");
			},
		);

		return () => {
			active = false;
		};
	}, [selected, inspectionProject, activeProjectId, page.items]);

	function inspect(id: string) {
		setSelected(id);
		setDetail(null);
		setPayload(null);
		setDetailError("");
		setNotice("");
		setPolicy("original");
	}

	async function replay() {
		if (!selected) return;
		setBusy(true);
		setNotice("");
		setDetailError("");
		try {
			const result = await api<{ id: string }>("/events/" + selected + "/replay", { method: "POST", json: { publicationPolicy: policy }, idempotencyKey: crypto.randomUUID() });
			setNotice("Replay queued as a new execution " + result.id.slice(0, 8) + ".");
			setDetail(await api<Detail>("/events/" + selected));
			await load();
		} catch (cause) {
			setDetailError(cause instanceof Error ? cause.message : "Could not replay event");
		} finally {
			setBusy(false);
		}
	}

	if (loading) return <p role='status'>Loading events…</p>;
	if (error && !project)
		return (
			<EmptyState>
				<EmptyState.Header>
					<EmptyState.Title>Events unavailable</EmptyState.Title>
					<EmptyState.Description>Your events could not be loaded. Retry to reconnect.</EmptyState.Description>
				</EmptyState.Header>
				<Button variant='secondary' onPress={() => void load()}>
					Retry loading events
				</Button>
			</EmptyState>
		);

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<p className='text-muted text-sm'>{project?.name ?? "All accessible projects"}</p>
					<h1 className='text-3xl font-semibold'>{embedded ? "Route events" : "Events"}</h1>
					<p className='text-muted mt-2'>Inspect stored requests and delivery attempts. Handler completion and HTTP delivery outcomes are separate.</p>
				</div>
				<Button variant='secondary' onPress={() => void load()}>
					<IconRefresh size={18} />
					Refresh events
				</Button>
			</header>

			<div className='flex flex-wrap gap-2' aria-label='History view'>
				<Button variant={view === "requests" ? "primary" : "secondary"} onPress={() => setView("requests")}>
					Incoming requests
				</Button>
				<Button variant={view === "attempts" ? "primary" : "secondary"} onPress={() => setView("attempts")}>
					Delivery attempts
				</Button>
			</div>
			<p className='text-muted text-sm'>{view === "requests" ? "One row per received request, including rejected and response-only outcomes. Updates arrive live." : "One row per outgoing HTTP attempt. Retries appear separately and link back to the original request."}</p>
			<div className='grid gap-3 sm:grid-cols-3'>
				{!projectId && (
					<>
						<NativeSelect fullWidth>
							<Label>Workspace</Label>
							<NativeSelect.Trigger
								aria-label='Event workspace'
								value={workspaceFilter}
								onChange={(e) => {
									setWorkspaceFilter(e.target.value);
									setProjectFilter("");
								}}
							>
								<NativeSelect.Option value=''>All accessible workspaces</NativeSelect.Option>
								{workspaces.map((item) => (
									<NativeSelect.Option key={item.id} value={item.id}>
										{item.name}
									</NativeSelect.Option>
								))}
								<NativeSelect.Indicator />
							</NativeSelect.Trigger>
						</NativeSelect>
						<NativeSelect fullWidth>
							<Label>Project</Label>
							<NativeSelect.Trigger aria-label='Event project' value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
								<NativeSelect.Option value=''>All accessible projects</NativeSelect.Option>
								{projects
									.filter((item) => !workspaceFilter || item.workspace_id === workspaceFilter)
									.map((item) => (
										<NativeSelect.Option key={item.id} value={item.id}>
											{item.name}
										</NativeSelect.Option>
									))}
								<NativeSelect.Indicator />
							</NativeSelect.Trigger>
						</NativeSelect>
					</>
				)}
				<NativeSelect fullWidth>
					<Label>Processing state</Label>
					<NativeSelect.Trigger aria-label='Event processing state' disabled={view === "attempts"} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
						<NativeSelect.Option value=''>All states</NativeSelect.Option>
						{Object.entries(labels).map(([value, name]) => (
							<NativeSelect.Option key={value} value={value}>
								{name}
							</NativeSelect.Option>
						))}
						<NativeSelect.Indicator />
					</NativeSelect.Trigger>
				</NativeSelect>
			</div>

			{page.items.length ? (
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label={view === "requests" ? "Stored events" : "Delivery attempts"}>
							<Table.Header>
								<Table.Column isRowHeader>Request</Table.Column>
								<Table.Column className='hidden sm:table-cell'>Processing</Table.Column>
								<Table.Column aria-label='Inspect' />
							</Table.Header>
							<Table.Body>
								{page.items.map((event) => (
									<Table.Row key={event.id} id={event.id}>
										<Table.Cell>
											<span className='font-medium'>{event.endpointName}</span>
											<p className='text-muted text-xs'>{projects.find((item) => item.id === event.projectId)?.name}</p>
											<time className='text-muted text-xs' dateTime={event.receivedAt}>
												{new Date(event.receivedAt).toLocaleString()}
											</time>
											<p className='text-muted mt-1 text-xs sm:hidden'>
												{labels[event.state ?? ""] ?? "Stored"} · {event.deliveryAttempts} HTTP attempts
											</p>
										</Table.Cell>
										<Table.Cell className='hidden sm:table-cell'>
											<span className={event.state === "failed_terminal" ? "text-danger" : event.state === "succeeded" ? "text-success" : "text-muted"}>{labels[event.state ?? ""] ?? "Stored"}</span>
											<p className='text-muted text-xs'>
												{event.deliveryAttempts} HTTP attempts · {event.bodyBytes} bytes
											</p>
										</Table.Cell>
										<Table.Cell>
											<Button isIconOnly size='sm' variant='secondary' aria-label={"Inspect event " + event.id.slice(0, 8)} onPress={() => inspect(event.eventId ?? event.id)}>
												<IconEye size={16} />
											</Button>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			) : (
				<EmptyState className='border-border rounded-xl border border-dashed py-12'>
					<EmptyState.Header>
						<EmptyState.Media variant='icon'>
							<IconInbox />
						</EmptyState.Media>
						<EmptyState.Title>No events yet</EmptyState.Title>
						<EmptyState.Description>Publish an ingress route and send a webhook to its receiving URL.</EmptyState.Description>
					</EmptyState.Header>
				</EmptyState>
			)}
			{page.nextCursor && (
				<Button variant='secondary' className='self-start' onPress={() => void load(page.nextCursor!, true)}>
					Load more events
				</Button>
			)}
			<Sheet
				isOpen={Boolean(selected)}
				onOpenChange={(open) => {
					if (!open && !busy) setSelected(null);
				}}
			>
				<Sheet.Backdrop>
					<Sheet.Content>
						<Sheet.Dialog className='flex max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-2xl flex-col overflow-hidden'>
							<Sheet.CloseTrigger />
							<Sheet.Header>
								<Sheet.Heading>Event inspection</Sheet.Heading>
								<p className='text-muted break-all text-xs'>{selected}</p>
							</Sheet.Header>
							<Sheet.Body className='flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto'>
								{!detail && !detailError ? (
									<p role='status'>Loading event history…</p>
								) : (
									detail && (
										<>
											<div>
												<h3 className='font-semibold'>{detail.endpointName}</h3>
												<p className='text-muted mt-1 text-sm'>
													{detail.method} · {labels[detail.ingressOutcome] ?? detail.ingressOutcome}
													{detail.responseStatus ? ` · HTTP ${detail.responseStatus}` : ""}
												</p>
												<p className='text-muted text-sm'>
													{detail.contentType} · {detail.bodyBytes} bytes
												</p>
											</div>
											<section>
												<h3 className='mb-3 font-semibold'>Processing executions</h3>
												<ul className='flex flex-col gap-3'>
													{detail.executions.map((execution) => (
														<li key={execution.id} className='border-border rounded-lg border p-3'>
															<p>{labels[execution.state] ?? execution.state}</p>
															<p className='text-muted mt-1 text-xs'>
																{execution.attempt_number} processing attempts · <code>{execution.id.slice(0, 8)}</code>
															</p>
														</li>
													))}
												</ul>
											</section>
											<section>
												<h3 className='mb-3 font-semibold'>Delivery attempts</h3>
												{detail.attempts.length ? (
													<ul className='flex flex-col gap-2'>
														{detail.attempts.map((attempt) => (
															<li key={attempt.id} className='border-border flex justify-between gap-3 rounded-lg border p-3 text-sm'>
																<code>{attempt.operation_id}</code>
																<span className={attempt.status_code && attempt.status_code >= 200 && attempt.status_code < 300 ? "text-success" : "text-danger"}>{attempt.status_code ? "HTTP " + attempt.status_code : (attempt.network_error ?? "Outcome pending")}</span>
															</li>
														))}
													</ul>
												) : (
													<p className='text-muted text-sm'>No tracked HTTP attempts yet.</p>
												)}
											</section>
											{payload ? (
												<section>
													<h3 className='mb-3 font-semibold'>Original request body</h3>
													<pre aria-label='Original request body' className='border-border bg-field max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-4 font-mono text-xs'>
														{decode(payload.originalBody)}
													</pre>
													{detail.ingressOutcome === "accept" && (
														<>
															<h3 className='my-3 font-semibold'>Accepted event body</h3>
															<pre aria-label='Accepted event body' className='border-border bg-field max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-4 font-mono text-xs'>
																{decode(payload.acceptedBody)}
															</pre>
														</>
													)}
													<h3 className='my-3 font-semibold'>Request headers</h3>
													<pre aria-label='Request headers' className='border-border bg-field max-h-64 overflow-auto rounded-lg border p-4 font-mono text-xs'>
														{JSON.stringify(payload.headers, null, 2)}
													</pre>
												</section>
											) : (
												<p className='text-muted text-sm'>Payload content requires separate payload-reading permission.</p>
											)}
										</>
									)
								)}
							</Sheet.Body>
							<Sheet.Footer>
								{inspectionProject?.permissions.includes("events.replay") && detail?.ingressOutcome === "accept" && (
									<div className='flex flex-col gap-3'>
										<p className='text-muted text-xs'>Replay creates new history and may repeat external effects. The stored payload stays unchanged.</p>
										<div className='flex flex-wrap items-center gap-3'>
											<NativeSelect variant='secondary' fullWidth>
												<Label>Script version for replay</Label>
												<NativeSelect.Trigger aria-label='Replay publication' value={policy} onChange={(event) => setPolicy(event.target.value as "original" | "current")} disabled={busy}>
													<NativeSelect.Option value='original'>Version used when received</NativeSelect.Option>
													<NativeSelect.Option value='current'>Currently published version</NativeSelect.Option>
													<NativeSelect.Indicator />
												</NativeSelect.Trigger>
											</NativeSelect>
											<p className='text-muted text-xs'>{policy === "original" ? "Run the saved processing code and dependencies originally used for this request." : "Run today's published processing code and dependencies against the stored accepted payload."}</p>
											<Button onPress={() => void replay()} isDisabled={busy || !detail}>
												<IconPlayerPlay size={16} />
												{busy ? "Queuing…" : "Replay event"}
											</Button>
										</div>
									</div>
								)}
							</Sheet.Footer>
						</Sheet.Dialog>
					</Sheet.Content>
				</Sheet.Backdrop>
			</Sheet>
		</section>
	);
}
