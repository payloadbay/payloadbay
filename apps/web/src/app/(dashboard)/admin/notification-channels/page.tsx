"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Table, Chip, Modal, TextField, Label, Input, Form } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { useDashboard } from "@components/dashboard-shell";
import { LoadingState } from "@components/loading-state";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import type { ChannelSummary } from "@domain/notification-channels";

export default function NotificationChannelsPage() {
	const { me } = useDashboard();
	const router = useRouter();

	const [channels, setChannels] = useState<ChannelSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [kind, setKind] = useState("email");

	useFeedbackToast(error);

	useEffect(() => {
		let active = true;
		api<ChannelSummary[]>("/notification-channels")
			.then(
				(rows) => {
					if (active) setChannels(rows);
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

	if (!me.permissions.includes("settings.manage")) return <p>Instance settings permission is required.</p>;

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-3xl font-semibold'>Notification modules</h1>
					<p className='text-muted mt-2 max-w-2xl'>Use the shipped email module, fork it to change the content, or write an HTTP module for your own service. Published versions are immutable; queued messages keep their original version.</p>
				</div>
				{me.permissions.includes("code.publish") && me.permissions.includes("code.edit") && <Button onPress={() => setCreating(true)}>Create module</Button>}
			</header>
			<Link href='/admin/email' className='text-accent'>
				Email branding and transactional delivery
			</Link>
			{loading ? (
				<LoadingState label='Loading notification modules…' />
			) : (
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Notification modules'>
							<Table.Header>
								<Table.Column isRowHeader>Module</Table.Column>
								<Table.Column>Transport</Table.Column>
								<Table.Column>Status</Table.Column>
								<Table.Column>Actions</Table.Column>
							</Table.Header>
							<Table.Body>
								{channels.map((channel) => (
									<Table.Row key={channel.id} id={channel.id}>
										<Table.Cell>
											<span className='font-medium'>{channel.name}</span>
											<p className='text-muted text-xs'>{channel.builtin ? "Shipped · read-only" : `v${channel.activeVersion} · ${channel.originKey ? "Fork" : "Custom"}`}</p>
										</Table.Cell>
										<Table.Cell>{channel.kind === "email" ? "SMTP email" : "Custom HTTP"}</Table.Cell>
										<Table.Cell>
											<Chip size='sm' color={channel.enabled ? "success" : "default"}>
												{channel.enabled ? "Enabled" : "Paused"}
											</Chip>
										</Table.Cell>
										<Table.Cell>
											<Link aria-disabled={!me.permissions.includes("code.read")} className='text-accent' href={"/admin/notification-channels/" + channel.id}>
												{channel.builtin ? "View and fork" : "Edit module"}
											</Link>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			)}
			<Modal isOpen={creating} onOpenChange={setCreating}>
				<Modal.Backdrop>
					<Modal.Container>
						<Modal.Dialog className='max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Create notification module</Modal.Heading>
							</Modal.Header>
							<Form
								onSubmit={(event) => {
									event.preventDefault();
									router.push("/admin/notification-channels/new?kind=" + kind + "&name=" + encodeURIComponent(name));
								}}
							>
								<Modal.Body className='flex flex-col gap-4'>
									<TextField isRequired value={name} onChange={setName} maxLength={100}>
										<Label>Module name</Label>
										<Input variant='secondary' />
									</TextField>
									<NativeSelect variant='secondary'>
										<Label>Transport</Label>
										<NativeSelect.Trigger aria-label='Transport' value={kind} onChange={(event) => setKind(event.target.value)}>
											<NativeSelect.Option value='email'>SMTP email content</NativeSelect.Option>
											<NativeSelect.Option value='webhook'>Custom HTTP delivery</NativeSelect.Option>
											<NativeSelect.Indicator />
										</NativeSelect.Trigger>
									</NativeSelect>
									<p className='text-muted text-sm'>HTTP modules use fetch and instance-owned secret bindings. SMTP credentials remain in the deployment environment.</p>
								</Modal.Body>
								<Modal.Footer>
									<Button variant='secondary' onPress={() => setCreating(false)}>
										Cancel
									</Button>
									<Button type='submit'>Open editor</Button>
								</Modal.Footer>
							</Form>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}
