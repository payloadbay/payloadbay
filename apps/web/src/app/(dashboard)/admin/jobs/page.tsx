"use client";

import { useEffect, useState } from "react";
import { Button, Card, Chip, Table } from "@heroui/react";
import { LineChart } from "@heroui-pro/react/line-chart";
import { IconRefresh } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { LoadingState } from "@components/loading-state";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import type { JobAdministration } from "@contracts/jobs";

const states = {
	queued: { label: "Queued", color: "default" },
	running: { label: "Running", color: "accent" },
	succeeded: { label: "Succeeded", color: "success" },
	failed: { label: "Failed", color: "danger" },
	expired: { label: "Expired", color: "warning" },
} as const;

export default function JobsPage() {
	const { me } = useDashboard();

	const authorized = me.permissions.includes("jobs.read");

	const [revision, setRevision] = useState(0);
	const [result, setResult] = useState<{ revision: number; data: JobAdministration } | null>(null);
	const [failure, setFailure] = useState<{ revision: number; message: string } | null>(null);

	const data = authorized && result?.revision === revision ? result.data : null;
	const error = failure?.revision === revision ? failure.message : "";

	useFeedbackToast(error, "", { error: "Jobs could not be loaded" });

	useEffect(() => {
		if (!authorized) return;
		let active = true;
		api<JobAdministration>("/jobs")
			.then((data) => {
				if (active) setResult({ revision, data });
			})
			.catch((cause) => {
				if (active) setFailure({ revision, message: cause instanceof Error ? cause.message : "Jobs are unavailable" });
			});

		return () => {
			active = false;
		};
	}, [authorized, revision]);

	if (!authorized)
		return (
			<section>
				<h1 className='text-2xl font-semibold'>Job administration is restricted</h1>
				<p className='text-muted mt-2'>Instance-level job access is required. Project access does not grant instance administration.</p>
			</section>
		);

	return (
		<section className='flex min-w-0 flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-3xl font-semibold'>Jobs and queues</h1>
					<p className='text-muted mt-2'>Operational health across the installation. Customer content stays in its own scope.</p>
				</div>
				<Button variant='secondary' onPress={() => setRevision((value) => value + 1)}>
					<IconRefresh aria-hidden='true' size={18} />
					Refresh
				</Button>
			</header>
			{error ? (
				<div>
					<p>Job status is unavailable.</p>
					<Button className='mt-3' variant='secondary' onPress={() => setRevision((value) => value + 1)}>
						Retry
					</Button>
				</div>
			) : !data ? (
				<LoadingState label='Loading jobs and queues' />
			) : (
				<>
					<div className='grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4'>
						{[
							{ label: "Due deliveries", value: data.backlog.reduce((sum, lane) => sum + lane.dueCount, 0) },
							{ label: "Oldest overdue", value: Math.max(0, ...data.backlog.map((lane) => lane.oldestDueSeconds)) + "s" },
							{ label: "Successful attempts / 24h", value: data.series.reduce((sum, point) => sum + point.succeeded, 0) },
							{ label: "Failed attempts / 24h", value: data.series.reduce((sum, point) => sum + point.failed, 0) },
						].map((metric) => (
							<Card key={metric.label}>
								<Card.Header>
									<Card.Description>{metric.label}</Card.Description>
								</Card.Header>
								<Card.Content>
									<p className='text-2xl font-semibold tabular-nums'>{typeof metric.value === "number" ? metric.value.toLocaleString() : metric.value}</p>
								</Card.Content>
							</Card>
						))}
					</div>
					<Card className='min-w-0'>
						<Card.Header>
							<Card.Title>Delivery activity</Card.Title>
							<Card.Description>Completed HTTP attempts over the last 24 hours, including retries.</Card.Description>
						</Card.Header>
						<Card.Content className='min-w-0'>
							<LineChart data={data.series.map((point) => ({ ...point, hour: point.hour.slice(11, 16) }))} height={220} role='img' aria-label='Aggregate delivery outcomes over 24 hours' className='min-w-0'>
								<LineChart.Grid vertical={false} />
								<LineChart.XAxis dataKey='hour' minTickGap={32} interval='preserveStartEnd' />
								<LineChart.YAxis allowDecimals={false} width={32} />
								<LineChart.Line dataKey='succeeded' name='Successful' stroke='var(--color-success)' dot={false} isAnimationActive={false} />
								<LineChart.Line dataKey='failed' name='Failed' stroke='var(--color-danger)' dot={false} isAnimationActive={false} />
								<LineChart.Tooltip content={<LineChart.TooltipContent valueFormatter={(value) => Number(value).toLocaleString()} />} />
							</LineChart>
						</Card.Content>
					</Card>
					<section className='flex min-w-0 flex-col gap-3'>
						<h2 className='text-xl font-semibold'>Due delivery backlog</h2>
						<p className='text-muted text-sm'>Deliveries ready to run, grouped by priority. Paused routes are excluded.</p>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Due delivery backlog' className='w-full min-w-128'>
									<Table.Header>
										<Table.Column isRowHeader>Priority</Table.Column>
										<Table.Column>Due executions</Table.Column>
										<Table.Column>Oldest age</Table.Column>
										<Table.Column>Oldest overdue</Table.Column>
									</Table.Header>
									<Table.Body renderEmptyState={() => <div className='px-4 py-8 text-center text-muted'>No executions are waiting for delivery.</div>}>
										{data.backlog.map((lane) => (
											<Table.Row id={String(lane.priority)} key={lane.priority}>
												<Table.Cell>{lane.priority}</Table.Cell>
												<Table.Cell>{lane.dueCount.toLocaleString()}</Table.Cell>
												<Table.Cell>{lane.oldestQueuedSeconds.toLocaleString()}s</Table.Cell>
												<Table.Cell>{lane.oldestDueSeconds.toLocaleString()}s</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
						<p className='text-muted text-sm'>Provider acknowledgement latency is not measured.</p>
					</section>
					<section className='flex min-w-0 flex-col gap-3'>
						<h2 className='text-xl font-semibold'>Platform jobs</h2>
						<p className='text-muted text-sm'>Recent background jobs, with active work first. Customer payloads, secrets and error contents are never shown here.</p>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Platform jobs' className='w-full min-w-160'>
									<Table.Header>
										<Table.Column isRowHeader>Job</Table.Column>
										<Table.Column>Status</Table.Column>
										<Table.Column>Attempts</Table.Column>
										<Table.Column>Created</Table.Column>
										<Table.Column>Due</Table.Column>
									</Table.Header>
									<Table.Body renderEmptyState={() => <div className='px-4 py-8 text-center text-muted'>No platform jobs have been recorded.</div>}>
										{data.items.map((job) => (
											<Table.Row id={job.id} key={job.id}>
												<Table.Cell>
													<span>{job.kind}</span>
													<span className='text-muted hidden font-mono text-xs sm:block'>{job.id}</span>
												</Table.Cell>
												<Table.Cell>
													<Chip size='sm' variant='soft' color={states[job.state].color}>
														{states[job.state].label}
													</Chip>
												</Table.Cell>
												<Table.Cell>
													{job.attemptNumber} / {job.maxAttempts}
												</Table.Cell>
												<Table.Cell>{new Date(job.createdAt).toLocaleString()}</Table.Cell>
												<Table.Cell>{new Date(job.dueAt).toLocaleString()}</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					</section>
				</>
			)}
		</section>
	);
}
