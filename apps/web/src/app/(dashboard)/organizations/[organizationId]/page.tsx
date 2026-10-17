"use client";

import { use, useState, type FormEvent } from "react";
import { Button, Form, TextField, Input, Label, FieldError, Table, Modal } from "@heroui/react";

import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";

export default function OrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
	const { organizationId } = use(params);

	const { organizations, workspaces, projects, reload } = useDashboard();

	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Workspace could not be created" });

	const organization = organizations.find((item) => item.id === organizationId);
	const canCreate = Boolean(organization?.permissions.includes("workspaces.create") && organization.permissions.includes("ownership.transfer"));

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			await api("/workspaces", { method: "POST", json: { parentId: organizationId, name, slug } });
			await reload();
			setOpen(false);
			setName("");
			setSlug("");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Workspace could not be created");
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<p className='text-muted text-sm'>Organization</p>
				<h1 className='text-3xl font-semibold'>{organization?.name ?? "Organization unavailable"}</h1>
				<p className='text-muted mt-2'>Choose a workspace to manage its projects, members and shared settings.</p>
			</header>
			<div className='flex flex-wrap items-end gap-3'>
				<TextField aria-label='Search workspaces' value={query} onChange={setQuery} className='min-w-0 flex-1'>
					<Input variant='secondary' placeholder='Search workspaces…' />
				</TextField>
				{canCreate && <Button onPress={() => setOpen(true)}>Create workspace</Button>}
			</div>
			<Table>
				<Table.ScrollContainer>
					<Table.Content aria-label='Workspaces' className='w-full'>
						<Table.Header>
							<Table.Column isRowHeader>Workspace</Table.Column>
							<Table.Column>Accessible projects</Table.Column>
						</Table.Header>
						<Table.Body>
							{workspaces
								.filter((item) => item.organization_id === organizationId && item.name.toLowerCase().includes(query.toLowerCase()))
								.map((item) => (
									<Table.Row id={item.id} key={item.id} href={"/workspaces/" + item.id}>
										<Table.Cell>{item.name}</Table.Cell>
										<Table.Cell>{projects.filter((project) => project.workspace_id === item.id).length}</Table.Cell>
									</Table.Row>
								))}
						</Table.Body>
					</Table.Content>
				</Table.ScrollContainer>
			</Table>
			{!workspaces.length && <p className='text-muted'>No workspaces available. Project-only access does not grant workspace access.</p>}
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
								<Modal.Heading>New workspace</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<Form id='new-workspace' onSubmit={create} className='flex flex-col gap-4'>
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
								<Button type='submit' form='new-workspace' isPending={busy} isDisabled={busy}>
									Create workspace
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}
