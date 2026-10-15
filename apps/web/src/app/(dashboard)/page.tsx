"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Table } from "@heroui/react";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";

type Overview = {
	totals: Record<string, number>;
	series: {
		hour: string;
		ingress: number;
		accepted: number;
		rejected: number;
		deliveries: number;
		executions: number;
	}[];
	recent: {
		id: string;
		state: string;
		attempt_number: number;
		created_at: string;
		endpoint_name: string;
		project_id: string;
		project_name: string;
		endpoint_id: string;
	}[];
};

const metrics = [
	{ key: "ingress", label: "Ingress", color: "var(--accent)" },
	{ key: "accepted", label: "Accepted", color: "var(--success)" },
	{ key: "rejected", label: "Rejected", color: "var(--danger)" },
	{ key: "deliveries", label: "Outgoing attempts", color: "var(--warning)" },
] as const;
const states: Record<string, string> = {
	queued: "Queued",
	running: "Processing",
	retry_wait: "Retry scheduled",
	succeeded: "Completed",
	failed_terminal: "Failed",
};

export default function DashboardPage() {
	const { me, projects, workspaces } = useDashboard();

	const [overview, setOverview] = useState<Overview | null>(null);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Overview unavailable" });

	const load = useCallback(async () => {
		try {
			setOverview(await api<Overview>("/overview"));
			setError("");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Overview unavailable");
		}
	}, []);

	useEffect(() => {
		void api<Overview>("/overview")
			.then(setOverview)
			.catch((cause) => setError(cause instanceof Error ? cause.message : "Overview unavailable"));
		const stream = new EventSource("/api/v1/changes?scopeType=accessible&scopeId=" + encodeURIComponent(me.instanceId));
		let timer: ReturnType<typeof setTimeout> | undefined;

		const refresh = () => {
			if (!timer)
				timer = setTimeout(() => {
					timer = undefined;
					void load();
				}, 150);
		};

		for (const kind of ["event.recorded", "event.accepted", "execution.changed", "attempt.completed", "resync-required"]) stream.addEventListener(kind, refresh);
		stream.onopen = refresh;

		return () => {
			stream.close();
			if (timer) clearTimeout(timer);
		};
	}, [load, me.instanceId]);

	const max = Math.max(1, ...(overview?.series.flatMap((point) => metrics.map((metric) => point[metric.key])) ?? []));

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h1 className='text-3xl font-semibold'>Overview</h1>
					<p className='text-muted mt-2'>Traffic and processing across your accessible projects · last 24 hourly buckets, UTC.</p>
				</div>
				<Link href='/projects' className='button button--secondary'>
					Browse projects
				</Link>
			</header>
			{!overview ? (
				<div role='status'>
					{error ? (
						<Button variant='secondary' onPress={() => void load()}>
							Retry loading overview
						</Button>
					) : (
						"Loading traffic…"
					)}
				</div>
			) : (
				<>
					<div className='grid gap-4 sm:grid-cols-3'>
						{[
							{ label: "Incoming requests", value: overview.totals.ingress, detail: `${overview.totals.accepted} accepted · ${overview.totals.rejected} rejected · ${overview.totals.responded} response only · ${overview.totals.errored} ingress errors` },
							{ label: "Processing executions", value: overview.totals.executions, detail: "Includes manually replayed executions" },
							{ label: "Outgoing attempts", value: overview.totals.deliveries, detail: `${overview.totals.delivered} delivered · ${overview.totals.failed} failed` },
						].map((metric) => (
							<Card key={metric.label}>
								<Card.Header>
									<Card.Description>{metric.label}</Card.Description>
									<Card.Title className='text-3xl tabular-nums'>{metric.value.toLocaleString()}</Card.Title>
								</Card.Header>
								<Card.Content className='text-muted text-sm'>{metric.detail}</Card.Content>
							</Card>
						))}
					</div>
					<Card>
						<Card.Header>
							<Card.Title>Traffic</Card.Title>
							<Card.Description>Live totals, grouped by hour. Outgoing retries are counted individually.</Card.Description>
						</Card.Header>
						<Card.Content>
							<div className='mb-4 flex flex-wrap gap-4 text-xs'>
								{metrics.map((metric) => (
									<span key={metric.key} className='flex items-center gap-2'>
										<span className='size-2 rounded-full' style={{ background: metric.color }} />
										{metric.label}
									</span>
								))}
							</div>
							<svg viewBox='0 0 720 200' role='img' aria-label={`24-hour traffic: ${overview.totals.ingress} incoming requests, ${overview.totals.accepted} accepted, ${overview.totals.rejected} rejected, ${overview.totals.deliveries} outgoing attempts`} className='h-48 w-full overflow-visible'>
								{[0, 1, 2, 3].map((tick) => (
									<g key={tick}>
										<line x1='36' x2='708' y1={16 + tick * 48} y2={16 + tick * 48} stroke='currentColor' opacity='.1' />
										<text x='0' y={20 + tick * 48} fill='currentColor' fontSize='10'>
											{Math.round(max * (1 - tick / 3))}
										</text>
									</g>
								))}
								{metrics.map((metric) => (
									<polyline key={metric.key} points={overview.series.map((point, index) => `${36 + index * (672 / 23)},${160 - (point[metric.key] / max) * 144}`).join(" ")} fill='none' stroke={metric.color} strokeWidth='2' />
								))}
								{[0, 6, 12, 18, 23].map((index) => (
									<text key={index} x={36 + index * (672 / 23)} y='190' textAnchor={index === 23 ? "end" : "start"} fill='currentColor' fontSize='10'>
										{overview.series[index]?.hour.slice(11, 16)}
									</text>
								))}
							</svg>
						</Card.Content>
					</Card>
					<section>
						<h2 className='mb-3 text-xl font-semibold'>Recent executions</h2>
						{overview.recent.length ? (
							<Table>
								<Table.ScrollContainer>
									<Table.Content aria-label='Recent executions' className='w-full'>
										<Table.Header>
											<Table.Column isRowHeader>Route / project</Table.Column>
											<Table.Column>Status</Table.Column>
											<Table.Column className='hidden sm:table-cell'>Started</Table.Column>
										</Table.Header>
										<Table.Body>
											{overview.recent.map((item) => (
												<Table.Row key={item.id} id={item.id} href={`/projects/${item.project_id}/routes/${item.endpoint_id}?section=events`}>
													<Table.Cell>
														<span className='block font-medium'>{item.endpoint_name}</span>
														<span className='text-muted text-xs'>{item.project_name}</span>
													</Table.Cell>
													<Table.Cell>
														<span className={item.state === "failed_terminal" ? "text-danger" : item.state === "succeeded" ? "text-success" : "text-muted"}>{states[item.state] ?? item.state}</span>
														<span className='text-muted block text-xs'>Attempt {item.attempt_number}</span>
													</Table.Cell>
													<Table.Cell className='hidden sm:table-cell'>{new Date(item.created_at).toLocaleString()}</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table.Content>
								</Table.ScrollContainer>
							</Table>
						) : (
							<p className='text-muted'>No processing executions yet. Open a project to publish a route and send a test request.</p>
						)}
					</section>
				</>
			)}
			<section>
				<div className='mb-3 flex items-center justify-between gap-3'>
					<h2 className='text-xl font-semibold'>Your projects</h2>
					<Link href='/projects' className='text-accent text-sm'>
						View all
					</Link>
				</div>
				{projects.length ? (
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Projects' className='w-full'>
								<Table.Header>
									<Table.Column isRowHeader>Project</Table.Column>
									<Table.Column>Workspace</Table.Column>
								</Table.Header>
								<Table.Body>
									{projects.slice(0, 5).map((project) => (
										<Table.Row key={project.id} id={project.id} href={"/projects/" + project.id}>
											<Table.Cell>{project.name}</Table.Cell>
											<Table.Cell>{workspaces.find((item) => item.id === project.workspace_id)?.name ?? "Project access only"}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				) : (
					<p className='text-muted'>
						No projects yet.{" "}
						<Link href='/projects' className='text-accent'>
							Create your first project
						</Link>
						.
					</p>
				)}
			</section>
		</section>
	);
}
