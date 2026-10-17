"use client";

import { useLiveSubscription } from "@components/live-subscription";
import { LoadingState } from "@components/loading-state";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Table } from "@heroui/react";
import { LineChart } from "@heroui-pro/react/line-chart";
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
	const { projects, workspaces } = useDashboard();
	const { subscribe } = useLiveSubscription();

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
		let timer: ReturnType<typeof setTimeout> | undefined;

		const refresh = () => {
			if (!timer)
				timer = setTimeout(() => {
					timer = undefined;
					void load();
				}, 150);
		};

		const unsubscribe = (["event.recorded", "event.accepted", "execution.changed", "attempt.completed", "resync-required"] as const).map((kind) => subscribe(kind, refresh));

		return () => {
			for (const stop of unsubscribe) stop();
			if (timer) clearTimeout(timer);
		};
	}, [load, subscribe]);

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
				<div className='flex min-h-[50dvh] items-center justify-center'>
					{error ? (
						<Button variant='secondary' onPress={() => void load()}>
							Retry loading overview
						</Button>
					) : (
						<LoadingState label='Loading traffic…' />
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
							<LineChart data={overview.series.map((point) => ({ ...point, hour: point.hour.slice(11, 16) }))} height={220} role='img' aria-label={`24-hour traffic: ${overview.totals.ingress} incoming requests, ${overview.totals.accepted} accepted, ${overview.totals.rejected} rejected, ${overview.totals.deliveries} outgoing attempts`} className='min-w-0 [&_.recharts-cartesian-axis-tick-value]:text-xs'>
								<LineChart.Grid vertical={false} />
								<LineChart.XAxis dataKey='hour' tickMargin={8} minTickGap={32} interval='preserveStartEnd' />
								<LineChart.YAxis allowDecimals={false} width={32} tickCount={4} tickFormatter={(value: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
								{metrics.map((metric) => (
									<LineChart.Line key={metric.key} dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2} dot={false} type='linear' isAnimationActive={false} />
								))}
								<LineChart.Tooltip content={<LineChart.TooltipContent valueFormatter={(value) => Number(value).toLocaleString()} />} />
							</LineChart>
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
