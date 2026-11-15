"use client";

import { oauthProviderNames, type OAuthProvider, type OAuthClient } from "@contracts/oauth";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { installationPolicySettings, type InstallationPolicy } from "@contracts/installation";
import { useEffect, useState } from "react";
import { Button, Chip, Table, Modal, TextField, Input, Label, Select, ListBox, NumberField, Description, FieldError } from "@heroui/react";
import { IconPlus, IconPencil, IconTrash, IconRefresh } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { LoadingState } from "@components/loading-state";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import type { ConfiguredInstallationSettings as InstallationSettings, InstallationHealth } from "@contracts/installation";

function providerOptions(client?: Partial<OAuthClient>) {
	return {
		domain: client?.domain,
		region: client?.region,
		userPoolId: client?.userPoolId,
		tenantId: client?.tenantId,
		environment: client?.environment,
	};
}

export default function InstallationPage() {
	const { me } = useDashboard();

	const authorized = me.permissions.includes("settings.manage");

	const [policyDraft, setPolicyDraft] = useState<InstallationPolicy | null>(null);
	const [policyVersion, setPolicyVersion] = useState(0);
	const [confirmRetention, setConfirmRetention] = useState(false);
	const [policySaving, setPolicySaving] = useState(false);

	const [provider, setProvider] = useState<OAuthProvider>("google");
	const [clientId, setClientId] = useState("");
	const [clientSecret, setClientSecret] = useState("");
	const [options, setOptions] = useState<Partial<OAuthClient>>({});
	const [editing, setEditing] = useState(false);
	const [removing, setRemoving] = useState<OAuthProvider | null>(null);
	const [saving, setSaving] = useState(false);
	const [actionError, setActionError] = useState("");
	const [notice, setNotice] = useState("");

	useFeedbackToast(actionError, notice, { error: "Installation settings error", success: "Installation settings saved" });

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

	const policyChanged = Boolean(policyDraft && data && Object.entries(policyDraft).some(([key, value]) => value !== data.settings.configuration.settings[key as keyof InstallationPolicy]));

	const { dialog: unsavedDialog } = useUnsavedChanges(policyChanged);

	async function savePolicy() {
		if (!data || !policyDraft) return;
		const valid = installationPolicySettings.safeParse(policyDraft);
		if (!valid.success) {
			setActionError("Enter valid values for each setting.");

			return;
		}

		const previous = data.settings.eventRetentionDays;
		if (!confirmRetention && policyDraft.eventRetentionDays > 0 && (previous === 0 || policyDraft.eventRetentionDays < previous)) {
			setConfirmRetention(true);

			return;
		}

		setPolicySaving(true);
		setActionError("");
		setNotice("");
		try {
			await api("/installation/settings", { method: "PUT", json: { version: policyVersion, settings: valid.data } });
			setPolicyDraft(null);
			setConfirmRetention(false);
			setRevision((value) => value + 1);
			setNotice("Installation settings saved.");
		} catch (cause) {
			setActionError(cause instanceof Error ? cause.message : "Could not save installation settings");
		} finally {
			setPolicySaving(false);
		}
	}

	async function saveProvider(remove = false) {
		if (!data) return;
		setSaving(true);
		setActionError("");
		setNotice("");
		try {
			const oauth: Record<string, OAuthClient> = Object.fromEntries(Object.entries(data.settings.configuration.settings.oauth).map(([name, value]) => [name, { clientId: value!.clientId, ...providerOptions(value) }]));
			if (remove && removing) delete oauth[removing];
			else oauth[provider] = { ...options, clientId, ...(clientSecret ? { clientSecret } : {}) };
			await api("/installation/settings", { method: "PUT", json: { version: data.settings.configuration.version, settings: { oauth } } });
			setEditing(false);
			setRemoving(null);
			setClientSecret("");
			setRevision((value) => value + 1);
			setNotice(remove ? "OAuth provider removed." : "OAuth provider saved.");
		} catch (cause) {
			setActionError(cause instanceof Error ? cause.message : "Could not save OAuth provider");
		} finally {
			setSaving(false);
		}
	}

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
						{unsavedDialog}
						<Modal.Backdrop
							isOpen={policyDraft !== null}
							onOpenChange={(open) => {
								if (!open && !policySaving) {
									setPolicyDraft(null);
									setConfirmRetention(false);
								}
							}}
						>
							<Modal.Container placement='center'>
								<Modal.Dialog aria-label={confirmRetention ? "Delete old event history?" : "Edit installation settings"} className='sm:max-w-2xl'>
									<Modal.CloseTrigger />
									<Modal.Header>
										<Modal.Heading>{confirmRetention ? "Delete old event history?" : "Edit installation settings"}</Modal.Heading>
									</Modal.Header>
									<Modal.Body className='flex flex-col gap-6'>
										{policyDraft &&
											(confirmRetention ? (
												<p>Completed event history older than {policyDraft.eventRetentionDays} days will be permanently deleted by scheduled cleanup. Pending deliveries are preserved. Deleted history cannot be recovered from this instance.</p>
											) : (
												<>
													<Select variant='secondary' aria-label='Registration policy' value={policyDraft.registrationPolicy} onChange={(key) => setPolicyDraft((old) => old && { ...old, registrationPolicy: String(key) as InstallationPolicy["registrationPolicy"] })}>
														<Label>Registration</Label>
														<Select.Trigger>
															<Select.Value />
															<Select.Indicator />
														</Select.Trigger>
														<Select.Popover>
															<ListBox>
																<ListBox.Item id='invite_only' textValue='Invitation only'>
																	Invitation only
																	<ListBox.ItemIndicator />
																</ListBox.Item>
																<ListBox.Item id='organization' textValue='Organization onboarding'>
																	Organization onboarding
																	<ListBox.ItemIndicator />
																</ListBox.Item>
															</ListBox>
														</Select.Popover>
														<Description>Organization onboarding lets new verified users create their own organization.</Description>
													</Select>
													{[
														{
															title: "Requests",
															fields: [
																["bodyLimit", "Incoming body limit (bytes)", 1, 1048576],
																["headerLimit", "Incoming header limit (bytes)", 1, 16384],
															],
														},
														{
															title: "Execution",
															fields: [
																["ingressDeadlineMs", "Ingress deadline (ms)", 100, 10000],
																["processingDeadlineMs", "Processing deadline (ms)", 100, 60000],
																["httpTimeoutMs", "HTTP timeout (ms)", 100, 30000],
																["maxAttempts", "Default delivery attempts", 1, 20],
															],
														},
														{
															title: "Retention and sign-in",
															fields: [
																["eventRetentionDays", "Keep completed events (days)", 0, 36500],
																["otpRequestLimit", "Sign-in code requests per five minutes", 1, 100],
															],
														},
													].map((group) => (
														<section key={group.title} className='flex flex-col gap-3'>
															<h3 className='font-semibold'>{group.title}</h3>
															<div className='grid gap-4 sm:grid-cols-2'>
																{group.fields.map(([key, label, min, max]) => (
																	<NumberField key={key} variant='secondary' isRequired value={Number(policyDraft[key as keyof InstallationPolicy])} minValue={Number(min)} maxValue={Number(max)} step={1} onChange={(value) => setPolicyDraft((old) => old && { ...old, [key]: value })}>
																		<Label>{label}</Label>
																		<NumberField.Group>
																			<NumberField.DecrementButton />
																			<NumberField.Input />
																			<NumberField.IncrementButton />
																		</NumberField.Group>
																		{key === "eventRetentionDays" && <Description>0 keeps history indefinitely.</Description>}
																		{key === "maxAttempts" && <Description>New events only. Replays keep the original limit.</Description>}
																		<FieldError />
																	</NumberField>
																))}
															</div>
														</section>
													))}
												</>
											))}
									</Modal.Body>
									<Modal.Footer>
										<Button
											variant='secondary'
											isDisabled={policySaving}
											onPress={() => {
												if (confirmRetention) setConfirmRetention(false);
												else setPolicyDraft(null);
											}}
										>
											{confirmRetention ? "Back to settings" : "Cancel"}
										</Button>
										<Button variant={confirmRetention ? "danger" : "primary"} isPending={policySaving} isDisabled={policySaving || !policyChanged} onPress={() => void savePolicy()}>
											{confirmRetention ? "Confirm retention and save" : "Save settings"}
										</Button>
									</Modal.Footer>
								</Modal.Dialog>
							</Modal.Container>
						</Modal.Backdrop>

						<h2 className='text-xl font-semibold'>Script execution</h2>
						<dl className='grid gap-4 sm:grid-cols-2'>
							<div>
								<dt className='text-muted'>Configured container runtime</dt>
								<dd>{data.settings.executorMode}</dd>
							</div>
							<div>
								<dt className='text-muted'>Executor reports</dt>
								<dd>
									{data.health.executor.runtime ?? "Unavailable"} / {data.health.executor.configuredMode ?? "Unknown mode"}
								</dd>
							</div>
						</dl>
						<p className='text-muted text-sm'>The executor reports its configuration, not host attestation. Ordinary Docker uses runc; optional gVisor requires host setup and an explicit runsc configuration. The notification inbox carries the runtime advisory.</p>
					</section>

					<section className='flex min-w-0 flex-col gap-3'>
						<header className='flex items-center justify-between gap-3'>
							<h2 className='text-xl font-semibold'>Sign-in providers</h2>
							<Button
								variant='secondary'
								onPress={() => {
									setProvider("google");
									setOptions({});
									setClientId("");
									setClientSecret("");
									setEditing(true);
								}}
							>
								<IconPlus size={16} />
								Add provider
							</Button>
						</header>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='OAuth sign-in providers'>
									<Table.Header>
										<Table.Column isRowHeader>Provider</Table.Column>
										<Table.Column>Client ID</Table.Column>
										<Table.Column className='text-right'>Actions</Table.Column>
									</Table.Header>
									<Table.Body>
										{Object.entries(data.settings.configuration.settings.oauth).map(([name, value]) => (
											<Table.Row key={name} id={name}>
												<Table.Cell>{oauthProviderNames[name as OAuthProvider]}</Table.Cell>
												<Table.Cell className='max-w-64 truncate'>{value?.clientId}</Table.Cell>
												<Table.Cell>
													<div className='flex justify-end gap-2'>
														<Button
															isIconOnly
															variant='ghost'
															aria-label={"Edit " + name}
															onPress={() => {
																setProvider(name as OAuthProvider);
																setOptions(providerOptions(value));
																setClientId(value?.clientId ?? "");
																setClientSecret("");
																setEditing(true);
															}}
														>
															<IconPencil size={16} />
														</Button>
														<Button isIconOnly variant='danger-soft' aria-label={"Remove " + name} onPress={() => setRemoving(name as OAuthProvider)}>
															<IconTrash size={16} />
														</Button>
													</div>
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
						{Object.keys(data.settings.configuration.settings.oauth).length === 0 && <p className='text-muted p-4 text-center'>No OAuth sign-in providers configured.</p>}
						<p className='text-muted text-sm'>Email-code sign-in stays available. SMTP is managed by the deployment environment.</p>
					</section>
					<Modal.Backdrop
						isOpen={editing}
						onOpenChange={(open) => {
							if (!saving) {
								setEditing(open);
								if (!open) setClientSecret("");
							}
						}}
					>
						<Modal.Container placement='center'>
							<Modal.Dialog className='sm:max-w-lg'>
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>OAuth sign-in provider</Modal.Heading>
								</Modal.Header>
								<Modal.Body className='flex flex-col gap-4'>
									<Select
										variant='secondary'
										aria-label='OAuth provider'
										value={provider}
										onChange={(key) => {
											const name = String(key) as OAuthProvider;
											setProvider(name);
											setOptions(providerOptions(data.settings.configuration.settings.oauth[name]));
											setClientId(data.settings.configuration.settings.oauth[name]?.clientId ?? "");
											setClientSecret("");
										}}
									>
										<Label>Provider</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												{Object.entries(oauthProviderNames).map(([id, name]) => (
													<ListBox.Item key={id} id={id} textValue={name}>
														{name}
														<ListBox.ItemIndicator />
													</ListBox.Item>
												))}
											</ListBox>
										</Select.Popover>
									</Select>
									<TextField value={clientId} onChange={setClientId} isRequired>
										<Label>{provider === "tiktok" ? "Client key" : "Client ID"}</Label>
										<Input variant='secondary' />
									</TextField>
									{(provider === "cognito"
										? [
												["domain", "Cognito domain"],
												["region", "AWS region"],
												["userPoolId", "User pool ID"],
											]
										: provider === "microsoft"
											? [["tenantId", "Tenant ID"]]
											: []
									).map(([key, label]) => (
										<TextField key={key} value={String(options[key as keyof OAuthClient] ?? "")} onChange={(value) => setOptions((old) => ({ ...old, [key]: value || undefined }))} isRequired={provider === "cognito"}>
											<Label>{label}</Label>
											<Input variant='secondary' />
										</TextField>
									))}
									{(provider === "paypal" || provider === "salesforce") && (
										<Select variant='secondary' aria-label='Provider environment' value={options.environment ?? (provider === "paypal" ? "sandbox" : "production")} onChange={(key) => setOptions((old) => ({ ...old, environment: String(key) as OAuthClient["environment"] }))}>
											<Label>Environment</Label>
											<Select.Trigger>
												<Select.Value />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													{["sandbox", provider === "paypal" ? "live" : "production"].map((name) => (
														<ListBox.Item key={name} id={name}>
															{name}
															<ListBox.ItemIndicator />
														</ListBox.Item>
													))}
												</ListBox>
											</Select.Popover>
										</Select>
									)}
									<TextField value={clientSecret} onChange={setClientSecret}>
										<Label>Client secret</Label>
										<Input type='password' variant='secondary' autoComplete='new-password' placeholder={data.settings.configuration.settings.oauth[provider]?.secretConfigured ? "Leave blank to keep the saved secret" : "Enter the application secret"} />
									</TextField>
									<div>
										<Label>Callback URL</Label>
										<code className='bg-field block overflow-x-auto rounded-lg p-3'>
											{typeof window === "undefined" ? "" : window.location.origin}/api/auth/callback/{provider}
										</code>
									</div>
								</Modal.Body>
								<Modal.Footer>
									<Button variant='secondary' slot='close' isDisabled={saving}>
										Cancel
									</Button>
									<Button isPending={saving} isDisabled={saving || !clientId.trim()} onPress={() => void saveProvider()}>
										Save provider
									</Button>
								</Modal.Footer>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
					<Modal.Backdrop
						isOpen={removing !== null}
						onOpenChange={(open) => {
							if (!open && !saving) setRemoving(null);
						}}
					>
						<Modal.Container placement='center'>
							<Modal.Dialog>
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>Remove sign-in provider?</Modal.Heading>
								</Modal.Header>
								<Modal.Body>Email-code and passkey sign-in remain available.</Modal.Body>
								<Modal.Footer>
									<Button variant='secondary' slot='close'>
										Cancel
									</Button>
									<Button variant='danger' isPending={saving} onPress={() => void saveProvider(true)}>
										Remove provider
									</Button>
								</Modal.Footer>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
					<section className='flex flex-col gap-3'>
						<header className='flex items-center justify-between gap-3'>
							<h2 className='text-xl font-semibold'>Configuration</h2>
							<Button
								variant='secondary'
								onPress={() => {
									if (data) {
										setPolicyVersion(data.settings.configuration.version);
										setPolicyDraft(installationPolicySettings.parse(Object.fromEntries(Object.keys(installationPolicySettings.shape).map((key) => [key, data.settings.configuration.settings[key as keyof InstallationPolicy]]))));
										setConfirmRetention(false);
									}
								}}
							>
								<IconPencil size={16} />
								Edit settings
							</Button>
						</header>
						<p className='text-muted text-sm'>Settings apply to all workspaces and projects. SMTP is managed by your deployment.</p>
						<dl className='grid gap-4 sm:grid-cols-2'>
							<div>
								<dt className='text-muted'>SMTP</dt>
								<dd>{data.settings.smtpConfigured ? "Configured" : "Not configured"}</dd>
							</div>
							<div>
								<dt className='text-muted'>Event retention</dt>
								<dd>{data.settings.eventRetentionDays === 0 ? "Keep indefinitely (automatic deletion off)" : `${data.settings.eventRetentionDays} days (completed events only)`}</dd>
							</div>
							<div>
								<dt className='text-muted'>Registration</dt>
								<dd>{data.settings.registrationPolicy === "invite_only" ? "Invitation only" : "Organization onboarding"}</dd>
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
							<div>
								<dt className='text-muted'>Default delivery attempts</dt>
								<dd>{data.settings.configuration.settings.maxAttempts}</dd>
							</div>
							<div>
								<dt className='text-muted'>Sign-in code requests per five minutes</dt>
								<dd>{data.settings.configuration.settings.otpRequestLimit}</dd>
							</div>
						</dl>
					</section>
				</>
			)}
		</section>
	);
}
