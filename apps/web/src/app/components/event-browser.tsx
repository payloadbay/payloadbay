"use client";

import { LoadingState } from "@components/loading-state";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Table, Label, Chip, Select, ListBox, Checkbox, Tabs, Modal } from "@heroui/react";
import { EmptyState, NativeSelect } from "@heroui-pro/react";
import { IconInbox, IconEye, IconRefresh, IconPlayerPlay } from "@tabler/icons-react";
import { useFeedbackToast } from "@lib/feedback";
import { useDashboard } from "@components/dashboard-shell";
import { PublicationPicker } from "@components/publication-picker";
import { api } from "@lib/api-client";

type Summary = {
	id: string;
	endpointId: string;
	projectId: string;
	endpointName: string;
	receivedAt: string;
	bodyBytes: number;
	state: string | null;
	deliveryState?: string | null;
	ingressOutcome: string;
	deliveryAttempts: number;
};
type EventPage = { items: Summary[]; nextCursor: string | null };
type Execution = {
	id: string;
	state: string;
	attempt_number: number;
	publication_id: string;
	created_at: string;
};
type Attempt = {
	id: string;
	execution_id: string;
	operation_id: string;
	status_code: number | null;
	network_error: string | null;
	started_at: string;
	duration_ms: number | null;
};
type Detail = {
	id: string;
	endpointId: string;
	projectId: string;
	endpointName: string;
	publicationId: string;
	ingressOutcome: string;
	method: string;
	responseStatus: number | null;
	contentType: string;
	bodyBytes: number;
	executions: Execution[];
	attempts: Attempt[];
};
type AttemptDetail = {
	id: string;
	operationId: string;
	status: number | null;
	networkError: string | null;
	durationMs: number | null;
	responseBody?: string | null;
};
type Payload = { originalBody: string; acceptedBody: string; headers: Record<string, string> };

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

function statusColor(state: string | null | undefined): "danger" | "success" | "warning" | "accent" {
	return ["failed_terminal", "delivery_failed", "error", "reject"].includes(state ?? "") ? "danger" : ["succeeded", "delivered"].includes(state ?? "") ? "success" : state === "retry_wait" ? "warning" : "accent";
}

export function EventBrowser({ projectId, endpointId, embedded = false }: { projectId?: string; endpointId?: string; embedded?: boolean }) {
	const { me, projects, workspaces } = useDashboard();

	const [projectFilter, setProjectFilter] = useState("");
	const [workspaceFilter, setWorkspaceFilter] = useState("");
	const [routeFilter, setRouteFilter] = useState("");
	const [versionFilter, setVersionFilter] = useState("");
	const [states, setStates] = useState<string[]>([]);
	const [routes, setRoutes] = useState<{ id: string; name: string }[]>([]);
	const [page, setPage] = useState<EventPage>({ items: [], nextCursor: null });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [detail, setDetail] = useState<Detail | null>(null);
	const [payload, setPayload] = useState<Payload | null>(null);
	const [tab, setTab] = useState("ingress");
	const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);
	const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
	const response = useRef<HTMLElement>(null);
	const [replayVersion, setReplayVersion] = useState("");
	const [bulkOpen, setBulkOpen] = useState(false);
	const [bulkPolicy, setBulkPolicy] = useState<"original" | "current" | "selected">("original");
	const [bulkVersion, setBulkVersion] = useState("");
	const [busy, setBusy] = useState(false);
	const bulkKey = useRef("");

	const activeProject = projectId ?? projectFilter;
	const activeRoute = endpointId ?? routeFilter;

	useFeedbackToast(error, notice, { error: "Events error", success: "Replay status" });

	const query = useCallback(
		(cursor?: string) => {
			const params = new URLSearchParams();
			if (activeProject) params.set("projectId", activeProject);
			else if (workspaceFilter) params.set("workspaceId", workspaceFilter);
			if (activeRoute) params.set("endpointId", activeRoute);
			if (versionFilter) params.set("publicationId", versionFilter);
			for (const state of states) params.append("state", state);
			if (cursor) params.set("cursor", cursor);

			return params;
		},
		[activeProject, workspaceFilter, activeRoute, versionFilter, states],
	);

	const load = useCallback(
		async (cursor?: string) => {
			try {
				const result = await api<EventPage>((activeProject ? "/projects/" + activeProject + "/events?" : "/events?") + query(cursor));
				setPage((previous) => (cursor ? { ...result, items: [...previous.items, ...result.items] } : result));
				setError("");
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : "Could not load events");
			} finally {
				setLoading(false);
			}
		},
		[query, activeProject],
	);

	useEffect(() => {
		let active = true;
		api<EventPage>((activeProject ? "/projects/" + activeProject + "/events?" : "/events?") + query())
			.then(
				(result) => {
					if (active) {
						setPage(result);
						setError("");
					}
				},
				(cause) => {
					if (active) setError(cause instanceof Error ? cause.message : "Could not load events");
				},
			)
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [query, activeProject]);

	useEffect(() => {
		if (!activeProject || endpointId) return;
		let active = true;
		api<{ id: string; name: string }[]>("/projects/" + activeProject + "/endpoints").then(
			(rows) => {
				if (active) setRoutes(rows);
			},
			(cause) => setError(cause instanceof Error ? cause.message : "Routes unavailable"),
		);

		return () => {
			active = false;
		};
	}, [activeProject, endpointId]);

	useEffect(() => {
		const stream = new EventSource("/api/v1/changes?scopeType=" + (activeProject ? "project" : "accessible") + "&scopeId=" + (activeProject || me.instanceId));
		let timer: ReturnType<typeof setTimeout> | undefined;

		const refresh = () => {
			if (!timer)
				timer = setTimeout(() => {
					timer = undefined;
					void load();
				}, 100);
		};

		let opened = false;
		stream.onopen = () => {
			if (opened) refresh();
			opened = true;
		};

		for (const kind of ["event.recorded", "event.accepted", "execution.changed", "attempt.completed", "resync-required"]) stream.addEventListener(kind, refresh);

		return () => {
			stream.close();
			if (timer) clearTimeout(timer);
		};
	}, [activeProject, me.instanceId, load]);

	useEffect(() => {
		if (!selected) return;
		let active = true;
		api<Detail>("/events/" + selected)
			.then(
				async (next) => {
					const canRead = projects.find((project) => project.id === next.projectId)?.permissions.includes("payload.read");
					const body = canRead ? await api<Payload>("/events/" + selected + "/payload") : null;
					if (active) {
						setDetail(next);
						setPayload(body);
						setReplayVersion(next.publicationId);
					}
				},
				(cause) => {
					if (active) {
						setSelected(null);
						setError(cause instanceof Error ? cause.message : "Could not inspect event");
					}
				},
			)
			.catch((cause) => {
				if (active) {
					setSelected(null);
					setError(cause instanceof Error ? cause.message : "Could not load payload");
				}
			});

		return () => {
			active = false;
		};
	}, [selected, projects]);

	useEffect(() => {
		if (!selectedAttempt) return;
		let active = true;
		api<AttemptDetail>("/delivery-attempts/" + selectedAttempt).then(
			(value) => {
				if (active) setAttempt(value);
			},
			(cause) => {
				if (active) {
					setSelectedAttempt(null);
					setError(cause instanceof Error ? cause.message : "Could not inspect attempt");
				}
			},
		);

		return () => {
			active = false;
		};
	}, [selectedAttempt]);

	useEffect(() => {
		if (attempt) {
			response.current?.scrollIntoView({ block: "nearest" });
			response.current?.focus({ preventScroll: true });
		}
	}, [attempt]);

	function inspect(id: string, section = "ingress") {
		setSelected(id);
		setDetail(null);
		setPayload(null);
		setSelectedAttempt(null);
		setAttempt(null);
		setTab(section);
		setError("");
	}

	function replayable(event: Summary) {
		return event.ingressOutcome === "accept" && Boolean(projects.find((project) => project.id === event.projectId)?.permissions.includes("events.replay"));
	}

	function changeFilters() {
		setSelectedIds([]);
		setVersionFilter("");
	}

	async function selectMatching() {
		setBusy(true);
		setError("");
		try {
			const result = await api<{ ids: string[] }>("/events/replay-selection?" + query());
			setSelectedIds(result.ids);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not select events");
		} finally {
			setBusy(false);
		}
	}

	async function replay(bulk: boolean) {
		if (!bulk && !selected) return;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			if (bulk) {
				const result = await api<{ count: number }>("/events/replay", { method: "POST", idempotencyKey: bulkKey.current, json: { eventIds: selectedIds, publicationPolicy: bulkPolicy, ...(bulkPolicy === "selected" ? { publicationId: bulkVersion } : {}) } });
				setNotice(result.count + " events queued for replay.");
				setBulkOpen(false);
				setSelectedIds([]);
			} else {
				await api("/events/" + selected + "/replay", { method: "POST", idempotencyKey: crypto.randomUUID(), json: { publicationPolicy: "selected", publicationId: replayVersion } });
				setNotice("Replay queued as a new execution.");
				setDetail(await api<Detail>("/events/" + selected));
			}

			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not replay events");
		} finally {
			setBusy(false);
		}
	}

	if (loading) return <LoadingState label='Loading events…' size={embedded ? "panel" : "page"} />;
	if (error && !page.items.length)
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
	const visible = page.items.filter(replayable);
	const canReplay = projects.some((project) => project.permissions.includes("events.replay"));

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<p className='text-muted text-sm'>{projects.find((project) => project.id === activeProject)?.name ?? "All accessible projects"}</p>
					<h1 className='text-3xl font-semibold'>{embedded ? "Route events" : "Events"}</h1>
					<p className='text-muted mt-2'>One received event, with its ingress outcome, processing executions and outgoing attempts. Updates arrive live.</p>
				</div>
				<Button variant='secondary' onPress={() => void load()}>
					<IconRefresh size={18} />
					Refresh events
				</Button>
			</header>
			<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
				{!projectId && (
					<>
						<NativeSelect fullWidth>
							<Label>Workspace</Label>
							<NativeSelect.Trigger
								aria-label='Event workspace'
								value={workspaceFilter}
								onChange={(event) => {
									setWorkspaceFilter(event.target.value);
									setProjectFilter("");
									setRouteFilter("");
									changeFilters();
								}}
							>
								<NativeSelect.Option value=''>All accessible workspaces</NativeSelect.Option>
								{workspaces.map((workspace) => (
									<NativeSelect.Option key={workspace.id} value={workspace.id}>
										{workspace.name}
									</NativeSelect.Option>
								))}
								<NativeSelect.Indicator />
							</NativeSelect.Trigger>
						</NativeSelect>
						<NativeSelect fullWidth>
							<Label>Project</Label>
							<NativeSelect.Trigger
								aria-label='Event project'
								value={projectFilter}
								onChange={(event) => {
									setProjectFilter(event.target.value);
									setRouteFilter("");
									changeFilters();
								}}
							>
								<NativeSelect.Option value=''>All accessible projects</NativeSelect.Option>
								{projects
									.filter((project) => !workspaceFilter || project.workspace_id === workspaceFilter)
									.map((project) => (
										<NativeSelect.Option key={project.id} value={project.id}>
											{project.name}
										</NativeSelect.Option>
									))}
								<NativeSelect.Indicator />
							</NativeSelect.Trigger>
						</NativeSelect>
					</>
				)}
				{!endpointId && activeProject && (
					<NativeSelect fullWidth>
						<Label>Ingress route</Label>
						<NativeSelect.Trigger
							aria-label='Event route'
							value={routeFilter}
							onChange={(event) => {
								setRouteFilter(event.target.value);
								changeFilters();
							}}
						>
							<NativeSelect.Option value=''>All routes</NativeSelect.Option>
							{routes.map((route) => (
								<NativeSelect.Option key={route.id} value={route.id}>
									{route.name}
								</NativeSelect.Option>
							))}
							<NativeSelect.Indicator />
						</NativeSelect.Trigger>
					</NativeSelect>
				)}
				<Select
					aria-label='History status'
					selectionMode='multiple'
					value={states}
					onChange={(keys) => {
						setStates(keys.map(String));
						setSelectedIds([]);
					}}
					placeholder='All statuses'
					fullWidth
				>
					<Label>Status</Label>
					<Select.Trigger>
						<Select.Value />
						<Select.ClearButton />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox selectionMode='multiple'>
							{["queued", "running", "retry_wait", "succeeded", "failed_terminal", "delivered", "delivery_failed", "reject", "respondOnly", "error"].map((state) => (
								<ListBox.Item key={state} id={state} textValue={labels[state]}>
									{labels[state]}
									<ListBox.ItemIndicator />
								</ListBox.Item>
							))}
						</ListBox>
					</Select.Popover>
				</Select>
				{activeRoute && (
					<PublicationPicker
						endpointId={activeRoute}
						value={versionFilter}
						onChange={(id) => {
							setVersionFilter(id);
							setSelectedIds([]);
						}}
						allowAll
						label='Processing version filter'
					/>
				)}
			</div>
			{canReplay && (
				<div className='flex flex-wrap items-center gap-3'>
					<Button variant='secondary' isDisabled={busy} onPress={() => void selectMatching()}>
						Select all matching replayable events
					</Button>
					<span className='text-muted text-sm'>{selectedIds.length} selected</span>
					{selectedIds.length > 0 && (
						<>
							<Button variant='tertiary' onPress={() => setSelectedIds([])}>
								Clear selection
							</Button>
							<Button
								onPress={() => {
									setBulkPolicy("original");
									bulkKey.current = crypto.randomUUID();
									setBulkOpen(true);
								}}
							>
								Replay selected events
							</Button>
						</>
					)}
				</div>
			)}
			{page.items.length ? (
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Stored events'>
							<Table.Header>
								{canReplay && (
									<Table.Column>
										<Checkbox slot={null} aria-label='Select visible replayable events' isSelected={Boolean(visible.length) && visible.every((event) => selectedIds.includes(event.id))} onChange={(checked) => setSelectedIds((previous) => (checked ? [...new Set([...previous, ...visible.map((event) => event.id)])] : previous.filter((id) => !visible.some((event) => event.id === id))))}>
											<Checkbox.Content>
												<Checkbox.Control>
													<Checkbox.Indicator />
												</Checkbox.Control>
											</Checkbox.Content>
										</Checkbox>
									</Table.Column>
								)}
								<Table.Column isRowHeader>Request</Table.Column>
								<Table.Column>Status</Table.Column>
								<Table.Column aria-label='Inspect' />
							</Table.Header>
							<Table.Body>
								{page.items.map((event) => (
									<Table.Row key={event.id} id={event.id} onAction={() => inspect(event.id)} className='cursor-pointer'>
										{canReplay && (
											<Table.Cell>
												<Checkbox slot={null} aria-label={"Select event " + event.id.slice(0, 8)} isSelected={selectedIds.includes(event.id)} isDisabled={!replayable(event)} onChange={(checked) => setSelectedIds((previous) => (checked ? [...new Set([...previous, event.id])] : previous.filter((id) => id !== event.id)))}>
													<Checkbox.Content>
														<Checkbox.Control>
															<Checkbox.Indicator />
														</Checkbox.Control>
													</Checkbox.Content>
												</Checkbox>
											</Table.Cell>
										)}
										<Table.Cell>
											<span className='font-medium'>{event.endpointName}</span>
											<p className='text-muted text-xs'>{projects.find((project) => project.id === event.projectId)?.name}</p>
											<time className='text-muted text-xs' dateTime={event.receivedAt}>
												{new Date(event.receivedAt).toLocaleString()}
											</time>
										</Table.Cell>
										<Table.Cell>
											<Chip size='sm' variant='soft' color={statusColor(event.deliveryState ?? event.state)}>
												{labels[event.deliveryState ?? event.state ?? ""] ?? "Stored"}
											</Chip>
											{event.deliveryState && <p className='text-muted text-xs'>{labels[event.state ?? ""] ?? "Stored"}</p>}
											<p className='text-muted text-xs'>
												{event.deliveryAttempts} HTTP attempts · {event.bodyBytes} bytes
											</p>
										</Table.Cell>
										<Table.Cell>
											<Button isIconOnly size='sm' variant='secondary' aria-label={"Inspect event " + event.id.slice(0, 8)} onPress={() => inspect(event.id)}>
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
				<EmptyState>
					<EmptyState.Header>
						<EmptyState.Media variant='icon'>
							<IconInbox />
						</EmptyState.Media>
						<EmptyState.Title>{states.length || versionFilter ? "No matching entries" : "No events yet"}</EmptyState.Title>
						<EmptyState.Description>Change the filters or send a webhook to a published ingress route.</EmptyState.Description>
					</EmptyState.Header>
				</EmptyState>
			)}
			{page.nextCursor && (
				<Button variant='secondary' onPress={() => void load(page.nextCursor!)}>
					Load more events
				</Button>
			)}
			<Modal
				isOpen={Boolean(selected)}
				onOpenChange={(open) => {
					if (!open && !busy) {
						setSelected(null);
						setSelectedAttempt(null);
					}
				}}
			>
				<Modal.Backdrop>
					<Modal.Container placement='auto' size='lg'>
						<Modal.Dialog className='flex max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-2xl flex-col overflow-hidden'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Event inspection</Modal.Heading>
								<p className='text-muted break-all text-xs'>{selected}</p>
							</Modal.Header>
							<Modal.Body className='min-h-0 flex-1 overflow-y-auto'>
								{!detail ? (
									<LoadingState label='Loading event history…' />
								) : (
									<Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
										<Tabs.ListContainer>
											<Tabs.List aria-label='Event inspection sections'>
												{["ingress", "processing", "outgoing"].map((section) => (
													<Tabs.Tab key={section} id={section}>
														{section === "ingress" ? "Ingress" : section === "processing" ? "Processing" : "Outgoing"}
														<Tabs.Indicator />
													</Tabs.Tab>
												))}
											</Tabs.List>
										</Tabs.ListContainer>
										<Tabs.Panel id='ingress' className='flex flex-col gap-4 pt-4'>
											<h3 className='font-semibold'>{detail.endpointName}</h3>
											<p>
												{detail.method} · {labels[detail.ingressOutcome]} · HTTP {detail.responseStatus ?? "—"}
											</p>
											{payload ? (
												<>
													<h3>Original request body</h3>
													<pre aria-label='Original request body' className='bg-field max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg p-3 text-xs'>
														{decode(payload.originalBody)}
													</pre>
													{detail.ingressOutcome === "accept" && (
														<>
															<h3>Accepted event body</h3>
															<pre aria-label='Accepted event body' className='bg-field max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg p-3 text-xs'>
																{decode(payload.acceptedBody)}
															</pre>
														</>
													)}
													<h3>Request headers</h3>
													<pre aria-label='Request headers' className='bg-field max-h-64 overflow-auto rounded-lg p-3 text-xs'>
														{JSON.stringify(payload.headers, null, 2)}
													</pre>
												</>
											) : (
												<p className='text-muted'>Payload content requires separate payload-reading permission.</p>
											)}
										</Tabs.Panel>
										<Tabs.Panel id='processing' className='flex flex-col gap-4 pt-4'>
											<h3 className='font-semibold'>Processing executions</h3>
											{detail.executions.map((execution) => (
												<div key={execution.id} className='border-border rounded-lg border p-3'>
													<Chip size='sm' color={statusColor(execution.state)}>
														{labels[execution.state]}
													</Chip>
													<p className='text-muted text-xs'>
														{execution.attempt_number} processing attempts · {execution.id.slice(0, 8)}
													</p>
												</div>
											))}
											{!detail.executions.length && <p className='text-muted'>This request has no processing executions.</p>}
										</Tabs.Panel>
										<Tabs.Panel id='outgoing' className='flex flex-col gap-4 pt-4'>
											{selectedAttempt && (
												<section ref={response} tabIndex={-1} aria-label='Selected delivery attempt' className='flex flex-col gap-3'>
													<h3 className='font-semibold'>Destination response</h3>
													{!attempt ? (
														<LoadingState label='Loading attempt…' />
													) : (
														<>
															<p>
																{attempt.operationId} · {attempt.status ? "HTTP " + attempt.status : (attempt.networkError ?? "Pending")} · {attempt.durationMs ?? "—"} ms
															</p>
															{attempt.responseBody !== undefined ? (
																<>
																	<p className='text-muted text-xs'>Captured response body, up to 64 KiB. Response headers are not recorded.</p>
																	<pre aria-label='Delivery response body' className='bg-field max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg p-3 text-xs'>
																		{attempt.responseBody ? decode(attempt.responseBody) : "(empty response body)"}
																	</pre>
																</>
															) : (
																<p className='text-muted'>Response content requires payload-reading permission.</p>
															)}
														</>
													)}
												</section>
											)}
											<h3 className='font-semibold'>Delivery attempts</h3>
											{detail.attempts.length ? (
												<Table>
													<Table.ScrollContainer>
														<Table.Content aria-label='Event delivery attempts'>
															<Table.Header>
																<Table.Column isRowHeader>Operation</Table.Column>
																<Table.Column>Response</Table.Column>
																<Table.Column>Inspect</Table.Column>
															</Table.Header>
															<Table.Body>
																{detail.attempts.map((item) => (
																	<Table.Row
																		key={item.id}
																		id={item.id}
																		onAction={() => {
																			setAttempt(null);
																			setSelectedAttempt(item.id);
																		}}
																		className='cursor-pointer'
																	>
																		<Table.Cell>
																			{item.operation_id}
																			<p className='text-muted text-xs'>{new Date(item.started_at).toLocaleString()}</p>
																		</Table.Cell>
																		<Table.Cell>
																			<Chip size='sm' className='whitespace-nowrap' color={item.status_code && item.status_code >= 200 && item.status_code < 300 ? "success" : "danger"}>
																				{item.status_code ? "HTTP " + item.status_code : (item.network_error ?? "Pending")}
																			</Chip>
																		</Table.Cell>
																		<Table.Cell>
																			<Button
																				size='sm'
																				variant='secondary'
																				aria-label={"Inspect delivery attempt " + item.id.slice(0, 8)}
																				onPress={() => {
																					setAttempt(null);
																					setSelectedAttempt(item.id);
																				}}
																			>
																				Inspect
																			</Button>
																		</Table.Cell>
																	</Table.Row>
																))}
															</Table.Body>
														</Table.Content>
													</Table.ScrollContainer>
												</Table>
											) : (
												<p className='text-muted'>No tracked HTTP attempts yet.</p>
											)}
										</Tabs.Panel>
									</Tabs>
								)}
							</Modal.Body>
							<Modal.Footer className='shrink-0'>
								{detail?.ingressOutcome === "accept" && projects.find((project) => project.id === detail.projectId)?.permissions.includes("events.replay") && (
									<div className='flex w-full flex-col gap-3'>
										<PublicationPicker endpointId={detail.endpointId} originalId={detail.publicationId} value={replayVersion} onChange={setReplayVersion} label='Script version for replay' disabled={busy} />
										<p className='text-muted text-xs'>Active handles new events. Latest is the newest saved publication. Replay creates a new execution and may repeat external effects.</p>
										<Button isDisabled={busy || !replayVersion} onPress={() => void replay(false)}>
											<IconPlayerPlay size={16} />
											Replay event
										</Button>
									</div>
								)}
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
			<Modal
				isOpen={bulkOpen}
				onOpenChange={(open) => {
					if (!busy) setBulkOpen(open);
				}}
			>
				<Modal.Backdrop>
					<Modal.Container>
						<Modal.Dialog aria-label='Replay selected events'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Replay selected events</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='flex flex-col gap-4'>
								<p>{selectedIds.length} selected events will get new processing executions. External effects can repeat. The selection is fixed; newly arriving events are not included.</p>
								<NativeSelect fullWidth>
									<Label>Version policy</Label>
									<NativeSelect.Trigger
										aria-label='Bulk replay version policy'
										value={bulkPolicy}
										onChange={(event) => {
											bulkKey.current = crypto.randomUUID();
											setBulkPolicy(event.target.value as typeof bulkPolicy);
										}}
									>
										<NativeSelect.Option value='original'>Original version for each event</NativeSelect.Option>
										<NativeSelect.Option value='current'>Active version for each route</NativeSelect.Option>
										{activeRoute && <NativeSelect.Option value='selected'>Choose a specific version</NativeSelect.Option>}
										<NativeSelect.Indicator />
									</NativeSelect.Trigger>
								</NativeSelect>
								{activeRoute && bulkPolicy === "selected" && (
									<PublicationPicker
										endpointId={activeRoute}
										value={bulkVersion}
										onChange={(id) => {
											bulkKey.current = crypto.randomUUID();
											setBulkVersion(id);
										}}
										label='Bulk replay script version'
									/>
								)}
								<p className='text-muted text-xs'>Up to 1000 replayable events per operation. Narrow the filters for larger collections.</p>
							</Modal.Body>
							<Modal.Footer>
								<Button slot='close' variant='tertiary' isDisabled={busy}>
									Cancel
								</Button>
								<Button isDisabled={busy || !selectedIds.length || (bulkPolicy === "selected" && !bulkVersion)} onPress={() => void replay(true)}>
									{busy ? "Queuing…" : "Queue replay"}
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}
