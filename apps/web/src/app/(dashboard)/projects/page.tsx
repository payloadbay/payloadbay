"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useState, type FormEvent } from "react";
import { Button, Form, TextField, Label, Input, FieldError, Table } from "@heroui/react";
import { EmptyState, NativeSelect, Sheet } from "@heroui-pro/react";
import { IconFolderPlus, IconArrowRight } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";

export default function DashboardPage() {
	const { me, workspaces, projects, reload } = useDashboard();

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
	const canWorkspace = me.permissions.includes("workspaces.create") && me.permissions.includes("ownership.transfer");
	const visible = projects.filter((p) => (!filter || p.workspace_id === filter) && p.name.toLowerCase().includes(query.toLowerCase()));

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			await api(form === "workspace" ? "/workspaces" : "/projects", { method: "POST", json: { parentId: form === "workspace" ? me.instanceId : workspace, name, slug } });
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
				<NativeSelect className='max-w-sm' fullWidth>
					<Label htmlFor='workspace-filter'>Workspace</Label>
					<NativeSelect.Trigger id='workspace-filter' aria-label='Workspace' value={filter} onChange={(e) => setFilter(e.target.value)}>
						<NativeSelect.Option value=''>All accessible projects</NativeSelect.Option>
						{workspaces.map((w) => (
							<NativeSelect.Option key={w.id} value={w.id}>
								{w.name}
							</NativeSelect.Option>
						))}
						<NativeSelect.Indicator />
					</NativeSelect.Trigger>
				</NativeSelect>
			)}
			{form && (
				<Sheet
					isOpen={Boolean(form)}
					onOpenChange={(open) => {
						if (!open && !busy) setForm(null);
					}}
				>
					<Sheet.Backdrop>
						<Sheet.Content>
							<Sheet.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-lg'>
								<Sheet.CloseTrigger />
								<Sheet.Header>
									<Sheet.Heading>New {form}</Sheet.Heading>
								</Sheet.Header>
								<Sheet.Body>
									<Form className='flex flex-col gap-4' onSubmit={create}>
										{form === "project" && (
											<NativeSelect variant='secondary' fullWidth>
												<Label htmlFor='project-workspace'>Workspace</Label>
												<NativeSelect.Trigger id='project-workspace' aria-label='Project workspace' required value={workspace} onChange={(e) => setWorkspace(e.target.value)}>
													{owned.map((w) => (
														<NativeSelect.Option key={w.id} value={w.id}>
															{w.name}
														</NativeSelect.Option>
													))}
													<NativeSelect.Indicator />
												</NativeSelect.Trigger>
											</NativeSelect>
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
											<Label>URL name</Label>
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
								</Sheet.Body>
							</Sheet.Dialog>
						</Sheet.Content>
					</Sheet.Backdrop>
				</Sheet>
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
											<IconArrowRight size={18} aria-hidden='true' />
										</Table.Cell>
									</Table.Row>
								)}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			) : (
				<EmptyState className='border-border rounded-xl border border-dashed py-12'>
					<EmptyState.Header>
						<EmptyState.Media variant='icon'>
							<IconFolderPlus aria-hidden='true' />
						</EmptyState.Media>
						<EmptyState.Title>No projects here yet</EmptyState.Title>
						<EmptyState.Description>{owned.length ? "Create a project to configure your first ingress route." : "Ask your administrator to give you access to a project."}</EmptyState.Description>
					</EmptyState.Header>
				</EmptyState>
			)}
		</section>
	);
}
