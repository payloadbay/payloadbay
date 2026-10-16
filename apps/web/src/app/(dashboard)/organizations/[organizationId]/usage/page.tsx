"use client";

import { use, useEffect, useState } from "react";
import { Button, Label, Table } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { LoadingState } from "@components/loading-state";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { usageMetrics, type UsageMetric, type UsageReport } from "@contracts/usage";
import type { OrganizationPolicy } from "@contracts/organization-policy";

const metricLabels: Record<UsageMetric, string> = {
	"ingress.recorded": "Incoming requests",
	"ingress.accepted": "Accepted requests",
	"execution.created": "Executions created",
	"execution.replayed": "Replays created",
	"processing.attempt.started": "Processing attempts",
	"delivery.attempt.started": "Managed delivery attempts",
	"execution.succeeded": "Successful executions",
	"execution.failed": "Failed executions",
};

export default function OrganizationUsagePage({ params }: { params: Promise<{ organizationId: string }> }) {
	const { organizationId } = use(params);

	const { organizations } = useDashboard();

	const [hours, setHours] = useState("24");
	const [attempt, setAttempt] = useState(0);
	const [result, setResult] = useState<{ key: string; usage: UsageReport; policy: OrganizationPolicy } | null>(null);
	const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);

	const requestKey = `${organizationId}:${hours}:${attempt}`;
	const error = failure?.key === requestKey ? failure.message : "";
	const data = result?.key === requestKey ? result : null;
	const organization = organizations.find((item) => item.id === organizationId);

	useFeedbackToast(error, "", { error: "Usage could not be loaded" });

	useEffect(() => {
		let active = true;
		const to = new Date();
		const from = new Date(to.getTime() - Number(hours) * 3600000);
		const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
		Promise.all([api<UsageReport>(`/organizations/${organizationId}/usage?${query}`), api<OrganizationPolicy>(`/organizations/${organizationId}/policy`)])
			.then(([usage, policy]) => {
				if (active) setResult({ key: requestKey, usage, policy });
			})
			.catch((cause) => {
				if (active) setFailure({ key: requestKey, message: cause instanceof Error ? cause.message : "Usage is unavailable" });
			});

		return () => {
			active = false;
		};
	}, [organizationId, hours, requestKey]);

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<p className='text-muted text-sm'>{organization?.name ?? "Organization"}</p>
				<h1 className='text-3xl font-semibold'>Usage and limits</h1>
				<p className='text-muted mt-2'>Operational counts for this organization. Retries count as attempts; a replay creates a new execution. Counts are stored locally.</p>
			</header>
			<div className='flex flex-wrap items-end gap-3'>
				<NativeSelect className='w-full sm:w-56' variant='secondary'>
					<Label htmlFor='usage-window'>Usage window</Label>
					<NativeSelect.Trigger id='usage-window' aria-label='Usage window' value={hours} onChange={(event) => setHours(event.target.value)}>
						<NativeSelect.Option value='24'>Last 24 hours</NativeSelect.Option>
						<NativeSelect.Option value='168'>Last 7 days</NativeSelect.Option>
						<NativeSelect.Option value='720'>Last 30 days</NativeSelect.Option>
						<NativeSelect.Indicator />
					</NativeSelect.Trigger>
				</NativeSelect>
				<Button variant='secondary' onPress={() => setAttempt((value) => value + 1)}>
					Refresh
				</Button>
			</div>
			{!data && !error ? (
				<LoadingState label='Loading usage…' size='page' />
			) : !data ? (
				<div className='flex min-h-48 flex-col items-center justify-center gap-3 text-center'>
					<p>Usage is unavailable.</p>
					<Button onPress={() => setAttempt((value) => value + 1)}>Try again</Button>
				</div>
			) : (
				<>
					<p className='text-muted text-sm'>
						UTC window: {new Date(data.usage.from).toLocaleString(undefined, { timeZone: "UTC" })} – {new Date(data.usage.to).toLocaleString(undefined, { timeZone: "UTC" })}. Window end is excluded.
					</p>
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Organization usage' className='w-full min-w-80'>
								<Table.Header>
									<Table.Column isRowHeader>Activity</Table.Column>
									<Table.Column>Selected window</Table.Column>
									<Table.Column>Lifetime</Table.Column>
								</Table.Header>
								<Table.Body>
									{usageMetrics.map((metric) => (
										<Table.Row id={metric} key={metric}>
											<Table.Cell>{metricLabels[metric]}</Table.Cell>
											<Table.Cell>{BigInt(data.usage.metrics[metric].window).toLocaleString()}</Table.Cell>
											<Table.Cell>{BigInt(data.usage.metrics[metric].lifetime).toLocaleString()}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
					<section className='flex flex-col gap-3'>
						<h2 className='text-xl font-semibold'>Current limits</h2>
						<p className='text-muted text-sm'>
							{data.policy.deploymentMode === "self_hosted" ? "Self-hosted instance" : "Hosted instance"} · Policy {data.policy.version === 0 ? "defaults" : `revision ${data.policy.version}`}. Instance operators manage these limits. Already accepted work is retained.
						</p>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Organization limits' className='w-full'>
									<Table.Header>
										<Table.Column isRowHeader>Resource</Table.Column>
										<Table.Column>Limit</Table.Column>
									</Table.Header>
									<Table.Body>
										<Table.Row id='workspaces'>
											<Table.Cell>Workspaces</Table.Cell>
											<Table.Cell>{data.policy.limits.workspaces ?? "Unlimited"}</Table.Cell>
										</Table.Row>
										<Table.Row id='projects'>
											<Table.Cell>Projects</Table.Cell>
											<Table.Cell>{data.policy.limits.projects ?? "Unlimited"}</Table.Cell>
										</Table.Row>
										<Table.Row id='admission'>
											<Table.Cell>Accepted requests</Table.Cell>
											<Table.Cell>{data.policy.limits.admission ? `${data.policy.limits.admission.limit.toLocaleString()} in the configured window` : "Unlimited"}</Table.Cell>
										</Table.Row>
										<Table.Row id='processing'>
											<Table.Cell>Concurrent processing</Table.Cell>
											<Table.Cell>{data.policy.processingConcurrency === 0 ? "Paused" : data.policy.processingConcurrency}</Table.Cell>
										</Table.Row>
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
						{data.policy.limits.admission && (
							<p className='text-muted text-sm'>
								Acceptance window (UTC): {data.policy.limits.admission.from} – {data.policy.limits.admission.to}. This window does not reset automatically.
							</p>
						)}
					</section>
				</>
			)}
		</section>
	);
}
