"use client";

import { useEffect, useState } from "react";
import { Button, Chip, Table } from "@heroui/react";
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
					<p className='text-muted mt-2'>Instance-wide operational snapshot. Refresh to see the latest state.</p>
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
					<section className='flex min-w-0 flex-col gap-3'>
						<h2 className='text-xl font-semibold'>Due delivery backlog</h2>
						<p className='text-muted text-sm'>Queued or retrying executions that are due now, excluding paused routes. Lower priority numbers run first. Age since creation includes time before a retry became due; overdue age starts at its due time.</p>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Due delivery backlog' className='w-full min-w-128'>
									<Table.Header>
										<Table.Column isRowHeader>Priority</Table.Column>
										<Table.Column>Due executions</Table.Column>
										<Table.Column>Oldest age</Table.Column>
										<Table.Column>Oldest overdue</Table.Column>
									</Table.Header>
									<Table.Body renderEmptyState={() => "No executions are waiting for delivery."}>
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
						<p className='text-muted text-sm'>Up to 100 trusted background jobs, active work first, then ordered by due time. Payloads and raw errors are excluded. Delivery work appears in the backlog above and the event log.</p>
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
									<Table.Body renderEmptyState={() => "No platform jobs have been recorded."}>
										{data.items.map((job) => (
											<Table.Row id={job.id} key={job.id}>
												<Table.Cell>
													<span>{job.kind}</span>
													<span className='text-muted block font-mono text-xs'>{job.id}</span>
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
