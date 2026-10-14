"use client";

import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import { use, useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, FieldError } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { IconInbox, IconRoute, IconPlus, IconArrowRight, IconPlugConnected, IconUsers, IconCode, IconBell } from "@tabler/icons-react";
import { api } from "@lib/api-client";
import { NotificationInbox } from "@components/notification-inbox";
import type { ProjectSummary } from "@types";

type IngressRoute = {
	id: string;
	name: string;
	slug: string;
	active_publication_id: string | null;
	paused: boolean;
};
type Destination = {
	id: string;
	name: string;
	is_default: boolean;
	version: number;
};

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

	const [project, setProject] = useState<ProjectSummary | null>(null);
	const [routes, setRoutes] = useState<IngressRoute[]>([]);
	const [destinations, setDestinations] = useState<Destination[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [form, setForm] = useState<"route" | "destination" | null>(null);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [url, setUrl] = useState("");
	const [busy, setBusy] = useState(false);

	useFeedbackToast(error, "", { error: "Project error", success: "Success" });

	const fetchData = useCallback(() => Promise.all([api<ProjectSummary>("/projects/" + projectId), api<IngressRoute[]>("/projects/" + projectId + "/endpoints"), api<Destination[]>("/projects/" + projectId + "/destinations")]), [projectId]);

	const receive = useCallback(([p, r, d]: [ProjectSummary, IngressRoute[], Destination[]]) => {
		setProject(p);
		setRoutes(r);
		setDestinations(d);
		setError("");
		setLoading(false);
	}, []);

	const failed = useCallback((cause: unknown) => {
		setError(cause instanceof Error ? cause.message : "Project unavailable");
		setLoading(false);
	}, []);

	const load = useCallback(async () => {
		try {
			receive(await fetchData());
		} catch (cause) {
			failed(cause);
		}
	}, [fetchData, receive, failed]);

	useEffect(() => {
		let active = true;
		fetchData().then(
			(data) => {
				if (active) receive(data);
			},
			(cause) => {
				if (active) failed(cause);
			},
		);

		return () => {
			active = false;
		};
	}, [fetchData, receive, failed]);

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			await api("/projects/" + projectId + (form === "route" ? "/endpoints" : "/destinations"), { method: "POST", json: form === "route" ? { name, slug } : { name, url } });
			setForm(null);
			setName("");
			setSlug("");
			setUrl("");
			await load();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not create configuration");
		} finally {
			setBusy(false);
		}
	}

	function open(next: "route" | "destination") {
		setForm(next);
		setName("");
		setSlug("");
		setUrl("");
		setError("");
	}

	if (loading) return <p role='status'>Loading project…</p>;
	if (!project)
		return (
			<section>
				<h1 className='text-2xl font-semibold'>Project unavailable</h1>

				<Button onPress={() => void load()}>Retry</Button>
			</section>
		);

	return (
		<section className='flex flex-col gap-8'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<p className='text-muted text-sm'>Project</p>
					<h1 className='text-3xl font-semibold'>{project.name}</h1>
					<p className='text-muted mt-2'>Set a destination, publish an ingress route, then receive your first event.</p>
				</div>
				<Link className='text-accent flex items-center gap-2' href={"/projects/" + projectId + "/events"}>
					<IconInbox size={18} />
					View events
				</Link>
				{project.permissions.includes("code.read") && (
					<Link className='text-accent flex items-center gap-2' href={"/code/project/" + projectId}>
						<IconCode size={18} />
						Code and middleware
					</Link>
				)}
				{project.permissions.includes("notifications.rules.manage") && (
					<Link className='text-accent flex items-center gap-2' href={"/projects/" + projectId + "/notifications"}>
						<IconBell size={18} />
						Notification rules
					</Link>
				)}
				{project.permissions.includes("notifications.read") && <NotificationInbox scope={{ type: "project", id: projectId }} label='Project notifications' />}
				{project.permissions.includes("members.manage") && (
					<Link className='text-accent flex items-center gap-2' href={"/projects/" + projectId + "/members"}>
						<IconUsers size={18} />
						Project members
					</Link>
				)}
			</header>

			{form && (
				<Card className='max-w-xl'>
					<Card.Header>
						<h2 className='text-xl font-semibold'>{form === "route" ? "New ingress route" : "New destination"}</h2>
						<Card.Description>{form === "route" ? "A receiving address with editable verification and processing code." : "An HTTP target reached from the Payload Bay worker. Private network targets are supported."}</Card.Description>
					</Card.Header>
					<Card.Content>
						<Form onSubmit={create} className='flex flex-col gap-4'>
							<TextField
								isRequired
								name='name'
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
								<Input />
								<FieldError />
							</TextField>
							{form === "route" ? (
								<TextField isRequired value={slug} onChange={setSlug} pattern='[a-z0-9][a-z0-9-]*'>
									<Label>URL name</Label>
									<Input />
									<FieldError />
								</TextField>
							) : (
								<TextField isRequired type='url' value={url} onChange={setUrl}>
									<Label>Destination URL</Label>
									<Input placeholder='https://your-app.example/events' />
									<FieldError />
								</TextField>
							)}
							<div className='flex gap-2'>
								<Button type='submit' isDisabled={busy}>
									{busy ? "Creating…" : form === "route" ? "Create ingress route" : "Create destination"}
								</Button>
								<Button variant='ghost' isDisabled={busy} onPress={() => setForm(null)}>
									Cancel
								</Button>
							</div>
						</Form>
					</Card.Content>
				</Card>
			)}
			<section className='flex flex-col gap-4' aria-labelledby='destinations-heading'>
				<div className='flex items-center justify-between'>
					<h2 id='destinations-heading' className='text-xl font-semibold'>
						Destinations
					</h2>
					{project.permissions.includes("destinations.configure") && (
						<Button variant='secondary' onPress={() => open("destination")}>
							<IconPlus size={18} />
							Add destination
						</Button>
					)}
				</div>
				{destinations.length ? (
					<div className='grid gap-4 md:grid-cols-2'>
						{destinations.map((destination) => (
							<Card key={destination.id}>
								<Card.Header>
									<h3 className='font-semibold'>{destination.name}</h3>
									<Card.Description>{destination.is_default ? "Default delivery target" : "Additional delivery target"}</Card.Description>
								</Card.Header>
							</Card>
						))}
					</div>
				) : (
					<EmptyState className='border-border rounded-xl border border-dashed py-8'>
						<EmptyState.Header>
							<EmptyState.Media variant='icon'>
								<IconPlugConnected />
							</EmptyState.Media>
							<EmptyState.Title>No destinations yet</EmptyState.Title>
							<EmptyState.Description>Add the application that should receive your events.</EmptyState.Description>
						</EmptyState.Header>
					</EmptyState>
				)}
			</section>
			<section className='flex flex-col gap-4' aria-labelledby='ingress-heading'>
				<div className='flex items-center justify-between'>
					<h2 id='ingress-heading' className='text-xl font-semibold'>
						Ingress routes
					</h2>
					{project.permissions.includes("endpoints.configure") && (
						<Button onPress={() => open("route")}>
							<IconPlus size={18} />
							Add ingress route
						</Button>
					)}
				</div>
				{routes.length ? (
					<div className='grid gap-4 md:grid-cols-2'>
						{routes.map((route) => (
							<Card key={route.id}>
								<Card.Header>
									<h3 className='font-semibold'>{route.name}</h3>
									<Card.Description>
										{route.active_publication_id ? "Published" : "Not published"}
										{route.paused ? " · Delivery paused" : ""}
									</Card.Description>
								</Card.Header>
								<Card.Footer>
									<Link className='text-accent flex items-center gap-2' href={"/projects/" + projectId + "/routes/" + route.id}>
										Configure route
										<IconArrowRight size={16} />
									</Link>
								</Card.Footer>
							</Card>
						))}
					</div>
				) : (
					<EmptyState className='border-border rounded-xl border border-dashed py-8'>
						<EmptyState.Header>
							<EmptyState.Media variant='icon'>
								<IconRoute />
							</EmptyState.Media>
							<EmptyState.Title>No ingress routes yet</EmptyState.Title>
							<EmptyState.Description>Create a route for your webhook provider, then configure and publish its scripts.</EmptyState.Description>
						</EmptyState.Header>
					</EmptyState>
				)}
			</section>
		</section>
	);
}
