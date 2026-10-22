"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Table, Chip, Modal, TextField, Label, Input, Form, Select, ListBox } from "@heroui/react";

import { useDashboard } from "@components/dashboard-shell";
import { LoadingState } from "@components/loading-state";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { IconInfoCircle, IconPencil } from "@tabler/icons-react";
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
					<p className='text-muted mt-2 max-w-2xl'>Customize alert delivery with versioned email or HTTP modules.</p>
				</div>
				{me.permissions.includes("code.publish") && me.permissions.includes("code.edit") && <Button onPress={() => setCreating(true)}>Create module</Button>}
			</header>
			<Modal>
				<Button variant='ghost' size='sm' className='self-start'>
					<IconInfoCircle size={18} aria-hidden='true' />
					How notification modules work
				</Button>
				<Modal.Backdrop>
					<Modal.Container placement='auto' size='lg'>
						<Modal.Dialog>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Email and HTTP notification modules</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='flex flex-col gap-3'>
								<p>The built-in email module is read-only. Fork it to customize alert content; email still uses the installation’s SMTP transport.</p>
								<p>Choose an HTTP module for a service such as Discord or a custom webhook. Each user explicitly enables the published version they have reviewed. Publishing an update does not automatically change their subscription.</p>
								<p>Sign-in codes and invitations always use trusted built-in email handling. Custom modules never receive those messages.</p>
							</Modal.Body>
							<Modal.Footer>
								<Button slot='close'>Got it</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>

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
								<Table.Column className='text-right'>Actions</Table.Column>
							</Table.Header>
							<Table.Body>
								{channels.map((channel) => (
									<Table.Row key={channel.id} id={channel.id}>
										<Table.Cell>
											<span className='font-medium'>{channel.name}</span>
											<p className='text-muted text-xs'>{channel.builtin ? "Built-in template" : `v${channel.activeVersion} / ${channel.originKey ? "Fork" : "Custom"}`}</p>
										</Table.Cell>
										<Table.Cell>{channel.kind === "email" ? "SMTP email" : "Custom HTTP"}</Table.Cell>
										<Table.Cell>
											<Chip size='sm' color={channel.enabled ? "success" : "default"}>
												{channel.enabled ? "Enabled" : "Paused"}
											</Chip>
										</Table.Cell>
										<Table.Cell className='text-right [&>div]:justify-end'>
											<Link aria-disabled={!me.permissions.includes("code.read")} className='button button--ghost button--icon-only' aria-label={channel.builtin ? "View and fork" : "Edit module"} href={"/admin/notification-channels/" + channel.id}>
												<IconPencil size={18} aria-hidden='true' />
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
									<Select variant='secondary' aria-label='Transport' value={kind} onChange={(key) => setKind(String(key ?? ""))}>
										<Label>Transport</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox>
												<ListBox.Item id='email'>
													SMTP email content
													<ListBox.ItemIndicator />
												</ListBox.Item>
												<ListBox.Item id='webhook'>
													Custom HTTP delivery
													<ListBox.ItemIndicator />
												</ListBox.Item>
											</ListBox>
										</Select.Popover>
									</Select>
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
