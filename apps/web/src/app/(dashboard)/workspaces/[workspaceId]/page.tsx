"use client";

import { use, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Table, Form, TextField, Label, Input, FieldError, Modal } from "@heroui/react";

import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { useDashboard } from "@components/dashboard-shell";

export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
	const { workspaceId } = use(params);

	const { workspaces, projects, reload } = useDashboard();
	const router = useRouter();

	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Project could not be created" });

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			const project = await api<{ id: string }>("/projects", { method: "POST", json: { parentId: workspaceId, name, slug } });
			await reload();
			setOpen(false);
			router.push("/projects/" + project.id);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Project could not be created");
		} finally {
			setBusy(false);
		}
	}

	const workspace = workspaces.find((item) => item.id === workspaceId);
	if (!workspace) return <p>Workspace unavailable.</p>;
	const visible = projects.filter((project) => project.workspace_id === workspaceId);

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<p className='text-muted text-sm'>Workspace</p>
				<h1 className='text-3xl font-semibold'>{workspace.name}</h1>
				<p className='text-muted mt-2'>Manage projects, inherited access, shared code and project notification rules from this workspace.</p>
			</header>
			<div className='flex flex-wrap items-center gap-3'>
				{workspace.permissions.includes("projects.create") && workspace.permissions.includes("ownership.transfer") && <Button onPress={() => setOpen(true)}>Create project</Button>}
				{workspace.permissions.includes("members.manage") && (
					<Link href={"/workspaces/" + workspaceId + "/members"} className='text-accent underline'>
						Workspace members
					</Link>
				)}
				{workspace.permissions.includes("code.read") && (
					<Link href={"/code/workspace/" + workspaceId} className='text-accent underline'>
						Shared code and middleware
					</Link>
				)}
			</div>
			{visible.length ? (
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Workspace projects'>
							<Table.Header>
								<Table.Column isRowHeader>Project</Table.Column>
								<Table.Column>Actions</Table.Column>
							</Table.Header>
							<Table.Body>
								{visible.map((project) => (
									<Table.Row key={project.id} id={project.id}>
										<Table.Cell>
											<Link href={"/projects/" + project.id} className='font-medium'>
												{project.name}
											</Link>
										</Table.Cell>
										<Table.Cell>
											<div className='flex flex-wrap gap-2'>
												<Link href={"/projects/" + project.id} className='text-accent text-sm'>
													Open project
												</Link>
												{project.permissions.includes("notifications.rules.manage") && (
													<Link href={"/projects/" + project.id + "/notifications"} className='text-accent text-sm'>
														Notification rules
													</Link>
												)}
											</div>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			) : (
				<p className='text-muted'>No accessible projects in this workspace.</p>
			)}
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
								<Modal.Heading>New project</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<Form id='workspace-project' onSubmit={create} className='flex flex-col gap-4'>
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
										<Label>Project name</Label>
										<Input variant='secondary' autoFocus />
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
								<Button type='submit' form='workspace-project' isPending={busy} isDisabled={busy}>
									Create project
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}
