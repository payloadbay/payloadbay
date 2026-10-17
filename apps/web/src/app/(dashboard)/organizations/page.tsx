"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Form, TextField, Input, Label, FieldError, Table, Modal } from "@heroui/react";

import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";

export default function OrganizationsPage() {
	const { me, organizations, workspaces, reload } = useDashboard();

	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Organization could not be created" });

	const canCreate = me.permissions.includes("organizations.create") && me.permissions.includes("ownership.transfer");

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			await api("/organizations", { method: "POST", json: { parentId: me.instanceId, name, slug } });
			await reload();
			setOpen(false);
			setName("");
			setSlug("");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Organization could not be created");
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<h1 className='text-3xl font-semibold'>Organizations</h1>
				<p className='text-muted mt-2'>Choose an organization to manage its workspaces, members and shared code.</p>
			</header>
			<div className='flex flex-wrap items-end gap-3'>
				<TextField aria-label='Search organizations' value={query} onChange={setQuery} className='min-w-0 flex-1'>
					<Input variant='secondary' placeholder='Search organizations…' />
				</TextField>
				{canCreate && <Button onPress={() => setOpen(true)}>Create organization</Button>}
			</div>
			<Table>
				<Table.ScrollContainer>
					<Table.Content aria-label='Organizations' className='w-full'>
						<Table.Header>
							<Table.Column isRowHeader>Organization</Table.Column>
							<Table.Column>Accessible workspaces</Table.Column>
						</Table.Header>
						<Table.Body>
							{organizations
								.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
								.map((item) => (
									<Table.Row id={item.id} key={item.id}>
										<Table.Cell>
											<Link href={"/organizations/" + item.id} className='font-medium'>
												{item.name}
											</Link>
										</Table.Cell>
										<Table.Cell>{workspaces.filter((workspace) => workspace.organization_id === item.id).length}</Table.Cell>
									</Table.Row>
								))}
						</Table.Body>
					</Table.Content>
				</Table.ScrollContainer>
			</Table>
			{!organizations.length && <p className='text-muted'>No organizations available. Workspace-only or project-only access does not grant organization access.</p>}
			<Modal
				isOpen={open}
				onOpenChange={(next) => {
					if (!busy) setOpen(next);
				}}
			>
				<Modal.Backdrop>
					<Modal.Container placement='auto' size='lg'>
						<Modal.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>New organization</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<Form id='new-organization' onSubmit={create} className='flex flex-col gap-4'>
									<TextField
										isRequired
										value={name}
										onChange={(next) => {
											setName(next);
											setSlug(
												next
													.toLowerCase()
													.replace(/[^a-z0-9]+/g, "-")
													.replace(/^-|-$/g, ""),
											);
										}}
										maxLength={100}
									>
										<Label>Name</Label>
										<Input variant='secondary' />
										<FieldError />
									</TextField>
									<TextField isRequired value={slug} onChange={setSlug} pattern='[a-z0-9][a-z0-9-]*' maxLength={63}>
										<Label>URL name</Label>
										<Input variant='secondary' />
										<FieldError />
									</TextField>
								</Form>
							</Modal.Body>
							<Modal.Footer>
								<Button variant='ghost' isDisabled={busy} onPress={() => setOpen(false)}>
									Cancel
								</Button>
								<Button type='submit' form='new-organization' isPending={busy} isDisabled={busy}>
									Create organization
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}
