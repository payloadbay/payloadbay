"use client";

import { useFeedbackToast } from "@lib/feedback";
import { use, useState, useEffect, useCallback } from "react";
import { Button, Card } from "@heroui/react";
import { EmptyState, Sheet } from "@heroui-pro/react";
import { IconInbox, IconEye, IconRefresh, IconPlayerPlay } from "@tabler/icons-react";
import { api } from "@lib/api-client";
import type { ProjectSummary } from "@types";

type Summary = {
	id: string;
	endpointId: string;
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
	queued: "Queued",
	running: "Processing",
	retry_wait: "Retry scheduled",
	succeeded: "Handler completed",
	failed_terminal: "Needs attention",
};

function decode(value: string) {
	return new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));
}

export default function EventsPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

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

	const fetchData = useCallback((cursor?: string) => Promise.all([api<ProjectSummary>("/projects/" + projectId), api<Page>("/projects/" + projectId + "/events" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""))]), [projectId]);

	const receive = useCallback(([p, list]: [ProjectSummary, Page], append = false) => {
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
		const updates = new EventSource("/api/v1/changes?scopeType=project&scopeId=" + encodeURIComponent(projectId));
		let refresh: ReturnType<typeof setTimeout> | undefined;

		const changed = () => {
			if (refresh) return;
			refresh = setTimeout(() => {
				refresh = undefined;
				void load();
			}, 100);
		};

		for (const kind of ["event.accepted", "execution.changed", "attempt.completed", "configuration.changed", "resync-required"]) updates.addEventListener(kind, changed);

		return () => {
			updates.close();
			if (refresh) clearTimeout(refresh);
		};
	}, [projectId, load]);

	useEffect(() => {
		if (!selected || !project) return;
		let active = true;
		Promise.all([api<Detail>("/events/" + selected), project.permissions.includes("payload.read") ? api<Payload>("/events/" + selected + "/payload") : Promise.resolve(null)]).then(
			([next, body]) => {
				if (!active) return;
				if (next.projectId !== projectId) {
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
	}, [selected, project, projectId]);

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
					<p className='text-muted text-sm'>{project?.name ?? "Project"}</p>
					<h1 className='text-3xl font-semibold'>Events</h1>
					<p className='text-muted mt-2'>Inspect stored requests and delivery attempts. Handler completion and HTTP delivery outcomes are separate.</p>
				</div>
				<Button variant='secondary' onPress={() => void load()}>
					<IconRefresh size={18} />
					Refresh events
				</Button>
			</header>

			{page.items.length ? (
				<Card>
					<Card.Content className='overflow-auto p-0'>
						<table className='w-full text-left text-sm' aria-label='Stored events'>
							<thead className='border-border border-b text-muted'>
								<tr>
									<th className='p-4'>Received</th>
									<th className='p-4'>Ingress route</th>
									<th className='p-4'>Processing</th>
									<th className='p-4'>HTTP attempts</th>
									<th className='p-4'>Inspect</th>
								</tr>
							</thead>
							<tbody>
								{page.items.map((event) => (
									<tr key={event.id} className='border-border border-b last:border-0'>
										<td className='p-4'>
											<time dateTime={event.receivedAt}>{new Date(event.receivedAt).toLocaleString()}</time>
											<p className='text-muted mt-1 font-mono text-xs'>
												{event.id.slice(0, 8)} · {event.bodyBytes} bytes
											</p>
										</td>
										<td className='p-4'>{event.endpointName}</td>
										<td className={"p-4 " + (event.state === "failed_terminal" ? "text-danger" : event.state === "succeeded" ? "text-success" : "text-muted")}>{labels[event.state ?? ""] ?? "Stored"}</td>
										<td className='p-4'>{event.deliveryAttempts}</td>
										<td className='p-4'>
											<Button size='sm' variant='secondary' aria-label={"Inspect event " + event.id.slice(0, 8)} onPress={() => inspect(event.id)}>
												<IconEye size={16} />
												Inspect
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</Card.Content>
				</Card>
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
						<Sheet.Dialog>
							<Sheet.CloseTrigger />
							<Sheet.Header>
								<Sheet.Heading>Event inspection</Sheet.Heading>
								<p className='text-muted text-sm'>{selected}</p>
							</Sheet.Header>
							<Sheet.Body className='flex flex-col gap-6'>
								{!detail && !detailError ? (
									<p role='status'>Loading event history…</p>
								) : (
									detail && (
										<>
											<div>
												<h3 className='font-semibold'>{detail.endpointName}</h3>
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
													<h3 className='my-3 font-semibold'>Accepted event body</h3>
													<pre aria-label='Accepted event body' className='border-border bg-field max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-4 font-mono text-xs'>
														{decode(payload.acceptedBody)}
													</pre>
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
								{project?.permissions.includes("events.replay") && (
									<div className='flex flex-col gap-3'>
										<p className='text-muted text-xs'>Replay creates new history and may repeat external effects. The stored payload stays unchanged.</p>
										<div className='flex flex-wrap items-center gap-3'>
											<select aria-label='Replay publication' className='border-border bg-field rounded-lg border p-2 text-sm' value={policy} onChange={(event) => setPolicy(event.target.value as "original" | "current")} disabled={busy}>
												<option value='original'>Original publication</option>
												<option value='current'>Current publication (explicit)</option>
											</select>
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
