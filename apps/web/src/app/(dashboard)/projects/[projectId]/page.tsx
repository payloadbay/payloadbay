"use client";

import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import { use, useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Table, Form, TextField, Label, Input, FieldError, Modal, Tooltip, Chip } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { IconRoute, IconPlus, IconPlugConnected, IconPencil, IconChevronRight } from "@tabler/icons-react";
import { api } from "@lib/api-client";
import type { getDestination } from "@domain/destinations";
import type { ProjectSummary } from "@types";

type IngressRoute = {
	id: string;
	name: string;
	slug: string;
	active_publication_id: string | null;
	paused: boolean;
};
type DestinationDetail = Awaited<ReturnType<typeof getDestination>>;

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
	const [editingDestination, setEditingDestination] = useState<DestinationDetail | null>(null);

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

	async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			if (editingDestination) {
				await api("/destinations/" + editingDestination.id, {
					method: "PUT",
					version: editingDestination.version,
					json: {
						name,
						url,
						method: editingDestination.http.method,
						headers: editingDestination.http.headers,
						secretRefs: editingDestination.secretRefs,
						concurrency: editingDestination.concurrency,
						isDefault: editingDestination.isDefault,
					},
				});
			} else await api("/projects/" + projectId + (form === "route" ? "/endpoints" : "/destinations"), { method: "POST", json: form === "route" ? { name, slug } : { name, url } });
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
		setEditingDestination(null);
		setForm(next);
		setName("");
		setSlug("");
		setUrl("");
		setError("");
	}

	async function editDestination(id: string) {
		setBusy(true);
		setError("");
		try {
			const destination = await api<DestinationDetail>("/destinations/" + id);
			setEditingDestination(destination);
			setName(destination.name);
			setUrl(destination.http.url);
			setForm("destination");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Destination unavailable");
		} finally {
			setBusy(false);
		}
	}

	if (loading) return <LoadingState label='Loading project…' size='page' />;
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
				<Modal
					isOpen={Boolean(form)}
					onOpenChange={(open) => {
						if (!open && !busy) setForm(null);
					}}
				>
					<Modal.Backdrop>
						<Modal.Container placement='auto' size='lg'>
							<Modal.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto'>
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>{form === "route" ? "New ingress route" : editingDestination ? "Edit destination" : "New destination"}</Modal.Heading>
									<p>{form === "route" ? "A receiving address with editable verification and processing code." : "An HTTP target reached from the Payload Bay worker. Private network targets are supported."}</p>
								</Modal.Header>
								<Modal.Body>
									<Form onSubmit={saveConfiguration} className='flex flex-col gap-4'>
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
												<Label>Slug</Label>
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
												{busy ? "Saving…" : form === "route" ? "Create ingress route" : editingDestination ? "Save destination" : "Create destination"}
											</Button>
											<Button variant='ghost' isDisabled={busy} onPress={() => setForm(null)}>
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
									<Table.Column>Actions</Table.Column>
								</Table.Header>
								<Table.Body>
									{destinations.map((destination) => (
										<Table.Row key={destination.id} id={destination.id}>
											<Table.Cell>
												{project.permissions.includes("destinations.configure") ? (
													<Button variant='ghost' className='h-auto justify-start px-0 font-medium' isDisabled={busy} onPress={() => void editDestination(destination.id)}>
														{destination.name}
													</Button>
												) : (
													destination.name
												)}
											</Table.Cell>
											<Table.Cell>
												{destination.is_default ? "Default" : "Additional"} · v{destination.version}
											</Table.Cell>
											<Table.Cell>
												{project.permissions.includes("destinations.configure") && (
													<Tooltip delay={0}>
														<Button isIconOnly size='sm' variant='ghost' aria-label={"Edit destination " + destination.name} isDisabled={busy} onPress={() => void editDestination(destination.id)}>
															<IconPencil size={18} aria-hidden='true' />
														</Button>
														<Tooltip.Content>Edit destination</Tooltip.Content>
													</Tooltip>
												)}
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
												<span className='flex items-center justify-between gap-3'>
													{route.name}
													<IconChevronRight size={16} aria-hidden='true' className='text-muted shrink-0' />
												</span>
											</Table.Cell>
											<Table.Cell>
												<div className='flex flex-wrap gap-2'>
													<Chip size='sm' color={route.active_publication_id ? "success" : "default"}>
														{route.active_publication_id ? "Published" : "Draft"}
													</Chip>
													{route.paused && (
														<Chip size='sm' color='warning'>
															Delivery paused
														</Chip>
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
