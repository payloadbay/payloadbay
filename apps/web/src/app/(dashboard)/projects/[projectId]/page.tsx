"use client";

import { useFeedbackToast } from "@lib/feedback";
import { use, useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Table, Form, TextField, Label, Input, FieldError } from "@heroui/react";
import { EmptyState, Sheet } from "@heroui-pro/react";
import { IconRoute, IconPlus, IconPlugConnected } from "@tabler/icons-react";
import { api } from "@lib/api-client";
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
			</header>

			{form && (
				<Sheet
					isOpen={Boolean(form)}
					onOpenChange={(open) => {
						if (!open && !busy) setForm(null);
					}}
				>
					<Sheet.Backdrop>
						<Sheet.Content>
							<Sheet.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto'>
								<Sheet.CloseTrigger />
								<Sheet.Header>
									<Sheet.Heading>{form === "route" ? "New ingress route" : "New destination"}</Sheet.Heading>
									<p>{form === "route" ? "A receiving address with editable verification and processing code." : "An HTTP target reached from the Payload Bay worker. Private network targets are supported."}</p>
								</Sheet.Header>
								<Sheet.Body>
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
											<Input variant='secondary' />
											<FieldError />
										</TextField>
										{form === "route" ? (
											<TextField isRequired value={slug} onChange={setSlug} pattern='[a-z0-9][a-z0-9-]*'>
												<Label>URL name</Label>
												<Input variant='secondary' />
												<FieldError />
											</TextField>
										) : (
											<TextField isRequired type='url' value={url} onChange={setUrl}>
												<Label>Destination URL</Label>
												<Input variant='secondary' placeholder='https://your-app.example/events' />
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
								</Sheet.Body>
							</Sheet.Dialog>
						</Sheet.Content>
					</Sheet.Backdrop>
				</Sheet>
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
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Destinations' className='w-full'>
								<Table.Header>
									<Table.Column isRowHeader>Destination</Table.Column>
									<Table.Column>Delivery target</Table.Column>
								</Table.Header>
								<Table.Body>
									{destinations.map((destination) => (
										<Table.Row key={destination.id} id={destination.id}>
											<Table.Cell>{destination.name}</Table.Cell>
											<Table.Cell>
												{destination.is_default ? "Default" : "Additional"} · v{destination.version}
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
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
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Ingress routes' className='w-full'>
								<Table.Header>
									<Table.Column isRowHeader>Route</Table.Column>
									<Table.Column>Status</Table.Column>
								</Table.Header>
								<Table.Body>
									{routes.map((route) => (
										<Table.Row key={route.id} id={route.id} href={"/projects/" + projectId + "/routes/" + route.id}>
											<Table.Cell>
												{route.name}
												<span className='text-muted block text-xs'>Configure route</span>
											</Table.Cell>
											<Table.Cell>
												{route.active_publication_id ? "Published" : "Draft"}
												{route.paused ? " · Delivery paused" : ""}
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
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
