"use client";

import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, FieldError } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
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
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Create resource error", success: "Success" });

	const owned = workspaces.filter((w) => w.permissions.includes("projects.create") && w.permissions.includes("ownership.transfer"));
	const canWorkspace = me.permissions.includes("workspaces.create") && me.permissions.includes("ownership.transfer");
	const visible = projects.filter((p) => !filter || p.workspace_id === filter);

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
					<p className='text-muted text-sm'>Organize your delivery infrastructure</p>
					<h1 className='text-3xl font-semibold'>Projects</h1>
					<p className='text-muted mt-2'>Receive events, keep their history, and deliver them when your applications are ready.</p>
				</div>
				<div className='flex gap-2'>
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
			{workspaces.length > 0 && (
				<label className='flex max-w-sm flex-col gap-2 text-sm'>
					Workspace
					<select aria-label='Workspace' className='border-border bg-field rounded-lg border px-3 py-2' value={filter} onChange={(e) => setFilter(e.target.value)}>
						<option value=''>All accessible projects</option>
						{workspaces.map((w) => (
							<option key={w.id} value={w.id}>
								{w.name}
							</option>
						))}
					</select>
				</label>
			)}
			{form && (
				<Card className='max-w-lg'>
					<Card.Header>
						<h2 className='text-xl font-semibold'>New {form}</h2>
					</Card.Header>
					<Card.Content>
						<Form className='flex flex-col gap-4' onSubmit={create}>
							{form === "project" && (
								<label className='flex flex-col gap-2'>
									Workspace
									<select aria-label='Project workspace' required value={workspace} onChange={(e) => setWorkspace(e.target.value)} className='border-border bg-field rounded-lg border p-2'>
										{owned.map((w) => (
											<option key={w.id} value={w.id}>
												{w.name}
											</option>
										))}
									</select>
								</label>
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
					</Card.Content>
				</Card>
			)}
			{visible.length ? (
				<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
					{visible.map((project) => (
						<Card key={project.id}>
							<Card.Header>
								<h2 className='text-lg font-semibold'>
									<Link href={"/projects/" + project.id}>{project.name}</Link>
								</h2>
								<Card.Description>{project.slug}</Card.Description>
							</Card.Header>
							<Card.Footer>
								<Link className='text-accent flex items-center gap-2 text-sm' href={"/projects/" + project.id}>
									Open project
									<IconArrowRight size={16} aria-hidden='true' />
								</Link>
							</Card.Footer>
						</Card>
					))}
				</div>
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
