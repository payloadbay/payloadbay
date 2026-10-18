"use client";

import { use, useEffect, useState } from "react";
import { Button, Card, Switch } from "@heroui/react";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { LoadingState } from "@components/loading-state";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { useDashboard } from "@components/dashboard-shell";

export default function OrganizationSecurityPage({ params }: { params: Promise<{ organizationId: string }> }) {
	const { organizationId } = use(params);

	const { reload } = useDashboard();

	const [retry, setRetry] = useState(0);
	const [policy, setPolicy] = useState<{ version: number; requirePasskey: boolean } | null>(null);
	const [enabled, setEnabled] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState(false);

	const { dialog: unsavedDialog } = useUnsavedChanges(Boolean(policy && enabled !== policy.requirePasskey));

	useFeedbackToast(error, notice, { error: "Security settings error", success: "Security settings saved" });

	useEffect(() => {
		let active = true;
		api<{ version: number; requirePasskey: boolean }>("/organizations/" + organizationId + "/security").then(
			(value) => {
				if (active) {
					setPolicy(value);
					setEnabled(value.requirePasskey);
				}
			},
			(cause) => {
				if (active) setError(cause.message);
			},
		);

		return () => {
			active = false;
		};
	}, [organizationId, retry]);

	async function save() {
		if (!policy) return;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const next = await api<{ version: number; requirePasskey: boolean }>("/organizations/" + organizationId + "/security", { method: "PUT", json: { version: policy.version, requirePasskey: enabled } });
			setPolicy(next);
			await reload();
			setNotice("Organization security policy saved.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save policy");
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className='flex flex-col gap-6'>
			{unsavedDialog}
			<h1 className='text-3xl font-semibold'>Organization security</h1>
			{!policy ? (
				error ? (
					<div className='flex flex-col items-start gap-3'>
						<p>Security settings are unavailable.</p>
						<Button
							variant='secondary'
							onPress={() => {
								setError("");
								setRetry((value) => value + 1);
							}}
						>
							Retry security settings
						</Button>
					</div>
				) : (
					<LoadingState label='Loading security policy' />
				)
			) : (
				<Card>
					<Card.Header>
						<Card.Title>Passkey enrollment</Card.Title>
					</Card.Header>
					<Card.Content className='flex flex-col gap-4'>
						<Switch isSelected={enabled} onChange={setEnabled} isDisabled={busy}>
							<Switch.Content className='flex-row items-center gap-3'>
								<Switch.Control>
									<Switch.Thumb />
								</Switch.Control>
								Require a registered passkey
							</Switch.Content>
						</Switch>
						<p className='text-muted'>Members must register a passkey before accessing this organization, its workspaces or projects. Register yours in account settings before enabling this policy.</p>
						<p className='text-muted text-sm'>This requires enrollment. It does not add a second authentication step to email-code sign-in.</p>
						<Button className='self-start' isPending={busy} isDisabled={busy || enabled === policy.requirePasskey} onPress={() => void save()}>
							Save security policy
						</Button>
					</Card.Content>
				</Card>
			)}
		</section>
	);
}
