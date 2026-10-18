"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Form, Input, Label, TextField, Modal } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { useDashboard } from "@components/dashboard-shell";
import { LoadingState } from "@components/loading-state";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { emailBranding, type EmailBranding } from "@contracts/notification-channels";

type Settings = { version: number; channelKey: string; branding: EmailBranding };
type Rendered = { subject: string; html: string; text: string };

export default function EmailSettingsPage() {
	const { me } = useDashboard();

	const [settings, setSettings] = useState<Settings | null>(null);
	const [branding, setBranding] = useState(emailBranding.parse({}));
	const [channelKey, setChannelKey] = useState("smtp");
	const [kind, setKind] = useState("login");
	const [rendered, setRendered] = useState<Rendered | null>(null);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [resetting, setResetting] = useState(false);

	const dirty = Boolean(settings && (settings.channelKey !== channelKey || JSON.stringify(settings.branding) !== JSON.stringify(branding)));

	useUnsavedChanges(dirty);

	useFeedbackToast(error, notice);

	useEffect(() => {
		let active = true;
		api<Settings>("/email-settings")
			.then(
				(data) => {
					if (!active) return;
					setSettings(data);
					setBranding(data.branding);
					setChannelKey(data.channelKey);
				},
				(cause) => {
					if (active) setError(cause.message);
				},
			)
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, []);

	async function act(task: () => Promise<void>) {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await task();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Email settings operation failed");
		} finally {
			setBusy(false);
		}
	}

	async function save(nextBranding = branding, nextChannel = channelKey) {
		await act(async () => {
			const saved = await api<Settings>("/email-settings", { method: "PUT", json: { expectedVersion: settings?.version ?? 0, channelKey: nextChannel, branding: nextBranding } });
			setSettings(saved);
			setBranding(saved.branding);
			setChannelKey(saved.channelKey);
			setResetting(false);
			setNotice("Email settings saved. Already queued messages keep their original branding.");
		});
	}

	if (loading) return <LoadingState label='Loading email settings…' />;
	if (!settings) return <p>Email settings are unavailable for this account.</p>;

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<h1 className='text-3xl font-semibold'>Email settings</h1>
				<p className='text-muted mt-2 max-w-2xl'>One shared branded layout for login codes, invitations and delivery alerts. SMTP host, credentials and sender are configured through deployment secrets.</p>
			</header>
			<Link className='text-accent' href='/admin/notification-channels'>
				Manage notification modules
			</Link>
			<Form
				onSubmit={(event) => {
					event.preventDefault();
					void save();
				}}
				className='flex flex-col gap-6'
			>
				<Card>
					<Card.Header>
						<Card.Title>Shared presentation</Card.Title>
					</Card.Header>
					<Card.Content className='grid gap-4 sm:grid-cols-2'>
						<TextField isRequired value={branding.name} onChange={(name) => setBranding((old) => ({ ...old, name }))} maxLength={80}>
							<Label>Brand name</Label>
							<Input variant='secondary' />
						</TextField>
						<TextField isRequired value={branding.accent} onChange={(accent) => setBranding((old) => ({ ...old, accent }))} pattern='#[0-9a-fA-F]{6}'>
							<Label>Accent color</Label>
							<Input variant='secondary' placeholder='#156FDE' />
						</TextField>
						<TextField value={branding.logoUrl ?? ""} onChange={(logoUrl) => setBranding((old) => ({ ...old, logoUrl: logoUrl || null }))} type='url' className='sm:col-span-2'>
							<Label>Logo URL</Label>
							<Input variant='secondary' placeholder='https://your-instance.example/brand/logo.png' />
						</TextField>
						<TextField value={branding.footer} onChange={(footer) => setBranding((old) => ({ ...old, footer }))} maxLength={500} className='sm:col-span-2'>
							<Label>Footer</Label>
							<Input variant='secondary' />
						</TextField>
					</Card.Content>
				</Card>
				<p className='text-muted text-sm'>Authentication email uses the built-in SMTP handler. Notification modules cannot read sign-in codes or invitation links.</p>
				<div className='flex flex-wrap justify-center gap-3 sm:justify-start'>
					<Button type='submit' isDisabled={busy || !dirty}>
						Save email settings
					</Button>
					<Button variant='secondary' isDisabled={busy} onPress={() => setResetting(true)}>
						Reset to shipped defaults
					</Button>
				</div>
			</Form>
			<Card>
				<Card.Header>
					<Card.Title>Preview and test</Card.Title>
					<Card.Description>Preview the shared wrapper with synthetic content. Test a custom module in its editor.</Card.Description>
				</Card.Header>
				<Card.Content className='flex flex-col gap-4'>
					<div className='flex flex-wrap items-end gap-3'>
						<NativeSelect variant='secondary'>
							<Label>Sample email</Label>
							<NativeSelect.Trigger aria-label='Sample email' value={kind} onChange={(event) => setKind(event.target.value)}>
								<NativeSelect.Option value='login'>Login code</NativeSelect.Option>
								<NativeSelect.Option value='invitation'>Invitation</NativeSelect.Option>
								<NativeSelect.Option value='alert'>Delivery alert</NativeSelect.Option>
								<NativeSelect.Indicator />
							</NativeSelect.Trigger>
						</NativeSelect>
						<Button variant='secondary' isDisabled={busy} onPress={() => void act(async () => setRendered(await api("/email-settings/preview", { method: "POST", json: { branding, kind } })))}>
							Preview email
						</Button>
						<Button
							variant='secondary'
							isDisabled={busy || dirty || !me.permissions.includes("code.test.effects")}
							onPress={() =>
								void act(async () => {
									const result = await api<{ recipient: string }>("/notification-channels/smtp/test", { method: "POST" });
									setNotice("Queued a test email to " + result.recipient + ".");
								})
							}
						>
							Send test to my email
						</Button>
					</div>
					{rendered && (
						<>
							<h3 className='font-medium'>{rendered.subject}</h3>
							<iframe title='Branded email preview' sandbox='' className='h-[620px] w-full rounded-lg border border-border' srcDoc={"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:;\">" + rendered.html} />
							<details>
								<summary>Plain-text alternative</summary>
								<pre className='mt-3 whitespace-pre-wrap text-sm'>{rendered.text}</pre>
							</details>
						</>
					)}
				</Card.Content>
			</Card>
			<Modal isOpen={resetting} onOpenChange={setResetting}>
				<Modal.Backdrop>
					<Modal.Container>
						<Modal.Dialog className='max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Reset email settings?</Modal.Heading>
							</Modal.Header>
							<Modal.Body>New messages will use Payload Bay branding and the shipped email module. Custom modules and their version history will be preserved.</Modal.Body>
							<Modal.Footer>
								<Button variant='secondary' onPress={() => setResetting(false)}>
									Cancel
								</Button>
								<Button isDisabled={busy} onPress={() => void save(emailBranding.parse({ logoUrl: new URL("/brand/payloadbay-email-logo.png", window.location.origin).href }), "smtp")}>
									Reset settings
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}
