"use client";

import { useLiveSubscription } from "@components/live-subscription";
import { LoadingState } from "@components/loading-state";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Table } from "@heroui/react";
import { IconChevronRight } from "@tabler/icons-react";
import { TrafficChart } from "@components/traffic-chart";
import type { TrafficSnapshot as Overview } from "@types";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";

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

		const unsubscribe = (["event.recorded", "event.accepted", "events.pruned", "execution.changed", "attempt.completed", "resync-required"] as const).map((kind) => subscribe(kind, refresh));

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
					<p className='text-muted mt-2'>Traffic and processing across your accessible projects / last 24 hourly buckets, UTC.</p>
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
							{ label: "Incoming requests", value: overview.totals.ingress, detail: `${overview.totals.accepted} accepted / ${overview.totals.rejected} rejected / ${overview.totals.responded} response only / ${overview.totals.errored} ingress errors` },
							{ label: "Processing executions", value: overview.totals.executions, detail: "Includes manually replayed executions" },
							{ label: "Outgoing attempts", value: overview.totals.deliveries, detail: `${overview.totals.delivered} delivered / ${overview.totals.failed} failed` },
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
					<TrafficChart overview={overview} />
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
											<Table.Column aria-label='Open resource' className='w-12 text-right' />
										</Table.Header>
										<Table.Body>
											{overview.recent.map((item) => (
												<Table.Row key={item.id} id={item.id} href={`/projects/${item.project_id}/routes/${item.endpoint_id}?section=events`}>
													<Table.Cell>
														<span className='flex items-center justify-between gap-3 font-medium'>{item.endpoint_name}</span>
														<span className='text-muted text-xs'>{item.project_name}</span>
													</Table.Cell>
													<Table.Cell>
														<span className={item.state === "failed_terminal" ? "text-danger" : item.state === "succeeded" ? "text-success" : "text-muted"}>{states[item.state] ?? item.state}</span>
														<span className='text-muted block text-xs'>Attempt {item.attempt_number}</span>
													</Table.Cell>
													<Table.Cell className='hidden sm:table-cell'>{new Date(item.created_at).toLocaleString()}</Table.Cell>
													<Table.Cell className='w-12 text-right'>
														<IconChevronRight size={18} aria-hidden='true' className='text-muted ml-auto' />
													</Table.Cell>
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
									<Table.Column aria-label='Open resource' className='w-12 text-right' />
								</Table.Header>
								<Table.Body>
									{projects.slice(0, 5).map((project) => (
										<Table.Row key={project.id} id={project.id} href={"/projects/" + project.id}>
											<Table.Cell>
												<span className='flex items-center justify-between gap-3'>{project.name}</span>
											</Table.Cell>
											<Table.Cell>{workspaces.find((item) => item.id === project.workspace_id)?.name ?? "Project access only"}</Table.Cell>
											<Table.Cell className='w-12 text-right'>
												<IconChevronRight size={18} aria-hidden='true' className='text-muted ml-auto' />
											</Table.Cell>
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
