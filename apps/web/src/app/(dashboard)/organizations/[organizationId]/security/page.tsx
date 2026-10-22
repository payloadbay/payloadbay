"use client";

import Link from "next/link";
import { IconKey } from "@tabler/icons-react";
import { use, useEffect, useState } from "react";
import { Button, Card, Switch, Label, Description } from "@heroui/react";
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
			<header>
				<h1 className='text-3xl font-semibold'>Organization security</h1>
			</header>
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
				<Card className='max-w-2xl'>
					<Card.Header className='flex-row items-center gap-3'>
						<IconKey size={22} className='text-accent shrink-0' aria-hidden='true' />
						<Card.Title>Passkeys</Card.Title>
					</Card.Header>
					<Card.Content>
						<Switch className='w-full' isSelected={enabled} onChange={setEnabled} isDisabled={busy}>
							<Switch.Content className='w-full justify-between gap-4'>
								<Label className='text-left'>Require a registered passkey</Label>
								<Switch.Control className='shrink-0'>
									<Switch.Thumb />
								</Switch.Control>
							</Switch.Content>
							<Description className='mt-1 ps-0'>Members need a passkey on their account to access this organization.</Description>
						</Switch>
						<p className='text-muted mt-4 text-sm'>Email-code sign-in stays available. This policy requires enrollment, not an extra sign-in step.</p>
						<Link href='/account' className='button button--secondary button--sm mt-3'>
							Manage your passkeys
						</Link>
					</Card.Content>
					<Card.Footer className='border-border justify-end border-t pt-4'>
						<Button className='w-full sm:w-auto' isPending={busy} isDisabled={busy || enabled === policy.requirePasskey} onPress={() => void save()}>
							Save security policy
						</Button>
					</Card.Footer>
				</Card>
			)}
		</section>
	);
}
