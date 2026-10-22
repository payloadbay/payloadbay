"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useState, type FormEvent } from "react";
import { Button, Form, TextField, Label, Input, FieldError, Table, Modal, Select, ListBox } from "@heroui/react";
import { ResourceEmptyState } from "@components/ui/resource-empty-state";
import { IconFolderPlus, IconChevronRight } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";

export default function DashboardPage() {
	const { organizations, workspaces, projects, reload } = useDashboard();

	const [organizationId, setOrganizationId] = useState("");
	const [form, setForm] = useState<"workspace" | "project" | null>(null);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [workspace, setWorkspace] = useState("");
	const [filter, setFilter] = useState("");
	const [query, setQuery] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Create resource error", success: "Success" });

	const owned = workspaces.filter((w) => w.permissions.includes("projects.create") && w.permissions.includes("ownership.transfer"));
	const ownedOrganizations = organizations.filter((item) => item.permissions.includes("workspaces.create") && item.permissions.includes("ownership.transfer"));
	const canWorkspace = ownedOrganizations.length > 0;
	const visible = projects.filter((p) => (!filter || p.workspace_id === filter) && p.name.toLowerCase().includes(query.toLowerCase()));

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			await api(form === "workspace" ? "/workspaces" : "/projects", { method: "POST", json: { parentId: form === "workspace" ? organizationId : workspace, name, slug } });
			await reload();
			setForm(null);
			setName("");
			setSlug("");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not create resource");
		} finally {
			setBusy(false);
		}
	}

	function open(next: "workspace" | "project") {
		setOrganizationId(ownedOrganizations[0]?.id ?? "");
		setForm(next);
		setName("");
		setSlug("");
		setWorkspace(owned[0]?.id ?? "");
		setError("");
	}

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-3xl font-semibold'>Projects</h1>
					<p className='text-muted mt-2'>Choose a project to manage its routes and events.</p>
				</div>
				<div className='flex flex-wrap gap-2'>
					{canWorkspace && (
						<Button variant='secondary' onPress={() => open("workspace")}>
							Create workspace
						</Button>
					)}
					{owned.length > 0 && (
						<Button onPress={() => open("project")}>
							<IconFolderPlus size={18} aria-hidden='true' />
							Create project
						</Button>
					)}
				</div>
			</header>
			<TextField aria-label='Search projects' value={query} onChange={setQuery} className='max-w-sm'>
				<Input variant='secondary' placeholder='Search projects…' />
			</TextField>
			{workspaces.length > 0 && (
				<Select variant='secondary' className='max-w-sm' fullWidth id='workspace-filter' aria-label='Workspace' value={filter} onChange={(key) => setFilter(String(key ?? ""))}>
					<Label htmlFor='workspace-filter'>Workspace</Label>
					<Select.Trigger>
						<Select.Value />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							<ListBox.Item id=''>
								All accessible projects
								<ListBox.ItemIndicator />
							</ListBox.Item>
							{workspaces.map((w) => (
								<ListBox.Item key={w.id} id={w.id}>
									{w.name}
									<ListBox.ItemIndicator />
								</ListBox.Item>
							))}
						</ListBox>
					</Select.Popover>
				</Select>
			)}
			{form && (
				<Modal
					isOpen={Boolean(form)}
					onOpenChange={(open) => {
						if (!open && !busy) setForm(null);
					}}
				>
					<Modal.Backdrop>
						<Modal.Container placement='auto' size='lg'>
							<Modal.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-lg'>
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>New {form}</Modal.Heading>
								</Modal.Header>
								<Modal.Body>
									<Form className='flex flex-col gap-4' onSubmit={create}>
										{form === "workspace" && (
											<Select variant='secondary' fullWidth id='project-organization' isRequired value={organizationId} onChange={(key) => setOrganizationId(String(key ?? ""))}>
												<Label htmlFor='project-organization'>Organization</Label>
												<Select.Trigger>
													<Select.Value />
													<Select.Indicator />
												</Select.Trigger>
												<Select.Popover>
													<ListBox>
														{ownedOrganizations.map((item) => (
															<ListBox.Item key={item.id} id={item.id}>
																{item.name}
																<ListBox.ItemIndicator />
															</ListBox.Item>
														))}
													</ListBox>
												</Select.Popover>
											</Select>
										)}
										{form === "project" && (
											<Select variant='secondary' fullWidth id='project-workspace' aria-label='Project workspace' isRequired value={workspace} onChange={(key) => setWorkspace(String(key ?? ""))}>
												<Label htmlFor='project-workspace'>Workspace</Label>
												<Select.Trigger>
													<Select.Value />
													<Select.Indicator />
												</Select.Trigger>
												<Select.Popover>
													<ListBox>
														{owned.map((w) => (
															<ListBox.Item key={w.id} id={w.id}>
																{w.name}
																<ListBox.ItemIndicator />
															</ListBox.Item>
														))}
													</ListBox>
												</Select.Popover>
											</Select>
										)}
										<TextField
											isRequired
											name='name'
											maxLength={100}
											value={name}
											onChange={(value) => {
												setName(value);
												setSlug(
													value
														.toLowerCase()
														.replace(/[^a-z0-9]+/g, "-")
														.replace(/^-|-$/g, ""),
												);
											}}
										>
											<Label>Name</Label>
											<Input variant='secondary' />
											<FieldError />
										</TextField>
										<TextField isRequired name='slug' maxLength={63} value={slug} onChange={setSlug} pattern='[a-z0-9][a-z0-9-]*'>
											<Label>Slug</Label>
											<Input variant='secondary' />
											<FieldError />
										</TextField>
										<div className='flex gap-2'>
											<Button type='submit' isDisabled={busy}>
												{busy ? "Creating…" : "Create " + form}
											</Button>
											<Button variant='ghost' onPress={() => setForm(null)} isDisabled={busy}>
												Cancel
											</Button>
										</div>
									</Form>
								</Modal.Body>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
				</Modal>
			)}
			{visible.length ? (
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Projects' className='w-full table-fixed'>
							<Table.Header>
								<Table.Column isRowHeader>Project</Table.Column>
								<Table.Column className='hidden sm:table-cell'>Workspace</Table.Column>
								<Table.Column aria-label='Open project' className='w-12' />
							</Table.Header>
							<Table.Body items={visible}>
								{(project) => (
									<Table.Row id={project.id} href={"/projects/" + project.id}>
										<Table.Cell>
											<span className='block break-all font-medium'>{project.name}</span>
											<span className='text-muted mt-1 block text-xs sm:hidden'>{workspaces.find((workspace) => workspace.id === project.workspace_id)?.name ?? "Workspace"}</span>
											<span className='text-muted mt-1 hidden text-xs sm:block'>{project.slug}</span>
										</Table.Cell>
										<Table.Cell className='hidden sm:table-cell'>{workspaces.find((workspace) => workspace.id === project.workspace_id)?.name ?? "Workspace"}</Table.Cell>
										<Table.Cell>
											<IconChevronRight size={18} aria-hidden='true' />
										</Table.Cell>
									</Table.Row>
								)}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			) : (
				<ResourceEmptyState
					className='border-border rounded-xl border border-dashed py-12'
					title={<>No projects here yet</>}
					description={<>{owned.length ? "Create a project to configure your first ingress route." : "Ask your administrator to give you access to a project."}</>}
					icon={
						<>
							<IconFolderPlus aria-hidden='true' />
						</>
					}
				/>
			)}
		</section>
	);
}
