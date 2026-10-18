"use client";

import { useEffect, useState } from "react";
import { Button, Chip, Table } from "@heroui/react";
import { IconRefresh } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { LoadingState } from "@components/loading-state";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import type { InstallationSettings, InstallationHealth } from "@contracts/installation";

export default function InstallationPage() {
	const { me } = useDashboard();

	const authorized = me.permissions.includes("settings.manage");

	const [revision, setRevision] = useState(0);
	const [result, setResult] = useState<{ revision: number; settings: InstallationSettings; health: InstallationHealth } | null>(null);
	const [failure, setFailure] = useState<{ revision: number; message: string } | null>(null);

	const data = authorized && result?.revision === revision ? result : null;
	const error = failure?.revision === revision ? failure.message : "";

	useFeedbackToast(error, "", { error: "Installation could not be loaded" });

	useEffect(() => {
		if (!authorized) return;
		let active = true;
		Promise.all([api<InstallationSettings>("/installation/settings"), api<InstallationHealth>("/health")])
			.then(([settings, health]) => {
				if (active) setResult({ revision, settings, health });
			})
			.catch((cause) => {
				if (active) setFailure({ revision, message: cause instanceof Error ? cause.message : "Installation is unavailable" });
			});

		return () => {
			active = false;
		};
	}, [authorized, revision]);

	if (!authorized)
		return (
			<section>
				<h1 className='text-2xl font-semibold'>Installation access is restricted</h1>
				<p className='text-muted mt-2'>Instance-level settings access is required.</p>
			</section>
		);

	const services = data
		? [
				{
					id: "database",
					name: "Database and schema",
					label: "Available",
					color: "success" as const,
				},
				{
					id: "executor",
					name: "Script executor",
					label: data.health.executor.state === "ready" ? "Ready" : data.health.executor.state === "not_ready" ? "Not ready" : "Unavailable",
					color: data.health.executor.state === "ready" ? ("success" as const) : ("warning" as const),
				},
				{
					id: "worker",
					name: "Delivery workers",
					label: data.health.worker === "recent" ? "Heartbeat within 60s" : "No recent heartbeat",
					color: data.health.worker === "recent" ? ("success" as const) : ("warning" as const),
				},
				{
					id: "smtp",
					name: "Email delivery",
					label: data.health.smtp === "ready" ? "SMTP connection verified" : "SMTP unavailable",
					color: data.health.smtp === "ready" ? ("success" as const) : ("warning" as const),
				},
			]
		: [];

	return (
		<section className='flex min-w-0 flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-3xl font-semibold'>Installation</h1>
					<p className='text-muted mt-2'>Instance configuration and service checks. Credentials stay private.</p>
				</div>
				<Button variant='secondary' onPress={() => setRevision((value) => value + 1)}>
					<IconRefresh aria-hidden='true' size={18} />
					Refresh
				</Button>
			</header>
			{error ? (
				<div>
					<p>Installation status is unavailable.</p>
					<Button className='mt-3' variant='secondary' onPress={() => setRevision((value) => value + 1)}>
						Retry
					</Button>
				</div>
			) : !data ? (
				<LoadingState label='Loading installation' />
			) : (
				<>
					<section className='flex min-w-0 flex-col gap-3'>
						<h2 className='text-xl font-semibold'>Service health</h2>
						<p className='text-muted text-sm'>Checked {new Date(data.health.checkedAt).toLocaleString()}. These checks do not confirm end-to-end delivery.</p>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Service health' className='w-full min-w-80'>
									<Table.Header>
										<Table.Column isRowHeader>Service</Table.Column>
										<Table.Column>Status</Table.Column>
									</Table.Header>
									<Table.Body>
										{services.map((service) => (
											<Table.Row id={service.id} key={service.id}>
												<Table.Cell>{service.name}</Table.Cell>
												<Table.Cell>
													<Chip color={service.color} size='sm' variant='soft'>
														{service.label}
													</Chip>
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
						<p className='text-muted text-sm'>Worker heartbeats confirm recent runtime activity. SMTP checks verify connection and authentication; an actual email flow verifies mailbox delivery.</p>
					</section>
					<section className='flex flex-col gap-3'>
						<h2 className='text-xl font-semibold'>Script execution</h2>
						<dl className='grid gap-4 sm:grid-cols-2'>
							<div>
								<dt className='text-muted'>Configured container runtime</dt>
								<dd>{data.settings.executorMode}</dd>
							</div>
							<div>
								<dt className='text-muted'>Executor reports</dt>
								<dd>
									{data.health.executor.runtime ?? "Unavailable"} · {data.health.executor.configuredMode ?? "Unknown mode"}
								</dd>
							</div>
						</dl>
						<p className='text-muted text-sm'>The executor reports its configuration, not host attestation. Ordinary Docker uses runc; optional gVisor requires host setup and an explicit runsc configuration. The notification inbox carries the runtime advisory.</p>
					</section>
					<section className='flex flex-col gap-3'>
						<h2 className='text-xl font-semibold'>Configuration</h2>
						<p className='text-muted text-sm'>Infrastructure configuration is supplied by the operator at deployment.</p>
						<dl className='grid gap-4 sm:grid-cols-2'>
							<div>
								<dt className='text-muted'>SMTP</dt>
								<dd>{data.settings.smtpConfigured ? "Configured · delivery not tested" : "Not configured"}</dd>
							</div>
							<div>
								<dt className='text-muted'>Event retention</dt>
								<dd>{data.settings.eventRetentionDays === 0 ? "Disabled · event history is retained" : `${data.settings.eventRetentionDays} days · completed events only`}</dd>
							</div>
							<div>
								<dt className='text-muted'>Registration</dt>
								<dd>{data.settings.registrationPolicy === "invite_only" ? "Invitation only" : "Organization onboarding"}</dd>
							</div>
							<div>
								<dt className='text-muted'>OAuth providers</dt>
								<dd>{data.settings.oauthProviders.join(", ") || "None configured"}</dd>
							</div>
							<div>
								<dt className='text-muted'>Incoming body limit</dt>
								<dd>{data.settings.limits.body.toLocaleString()} bytes</dd>
							</div>
							<div>
								<dt className='text-muted'>Incoming header limit</dt>
								<dd>{data.settings.limits.headers.toLocaleString()} bytes</dd>
							</div>
							<div>
								<dt className='text-muted'>Ingress deadline</dt>
								<dd>{data.settings.deadlines.ingressMs.toLocaleString()} ms</dd>
							</div>
							<div>
								<dt className='text-muted'>Processing deadline</dt>
								<dd>{data.settings.deadlines.processingMs.toLocaleString()} ms</dd>
							</div>
							<div>
								<dt className='text-muted'>HTTP timeout</dt>
								<dd>{data.settings.deadlines.httpMs.toLocaleString()} ms</dd>
							</div>
						</dl>
					</section>
				</>
			)}
		</section>
	);
}
