"use client";

import { LoadingState } from "@components/loading-state";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Card, Switch, Label, NumberField, FieldError, Modal, Select, ListBox } from "@heroui/react";
import { ResourceEmptyState } from "@components/ui/resource-empty-state";
import { IconBell, IconPlus, IconPencil, IconArrowLeft } from "@tabler/icons-react";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { useDashboard } from "@components/dashboard-shell";

type Rule = {
	id: string;
	enabled: boolean;
	count: number;
	windowSeconds: number;
	endpointId: string | null;
	destinationId: string | null;
	severity: "info" | "warning" | "critical";
	recoveryPolicy: "manual" | "window";
	cooldownSeconds: number;
	version: number;
};
type Target = { id: string; name: string };

export function NotificationRules({ projectId, workspaceId }: { projectId?: string; workspaceId?: string }) {
	const { projects, workspaces } = useDashboard();

	const project = projectId ? projects.find((project) => project.id === projectId) : workspaces.find((workspace) => workspace.id === workspaceId);
	const address = projectId ? "/projects/" + projectId : "/workspaces/" + workspaceId;

	const [rules, setRules] = useState<Rule[]>([]);
	const [routes, setRoutes] = useState<Target[]>([]);
	const [destinations, setDestinations] = useState<Target[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [editing, setEditing] = useState<Rule | null>(null);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [enabled, setEnabled] = useState(false);
	const [count, setCount] = useState("1");
	const [windowSeconds, setWindowSeconds] = useState("60");
	const [endpointId, setEndpointId] = useState("");
	const [destinationId, setDestinationId] = useState("");
	const [severity, setSeverity] = useState<Rule["severity"]>("warning");
	const [recovery, setRecovery] = useState<Rule["recoveryPolicy"]>("window");
	const [cooldown, setCooldown] = useState("0");

	useFeedbackToast(error, notice, { error: "Notification rule error", success: "Notification rule status" });

	const fetchData = useCallback(() => Promise.all([api<Rule[]>(address + "/notification-rules"), projectId ? api<Target[]>(address + "/endpoints") : Promise.resolve([]), projectId ? api<Target[]>(address + "/destinations") : Promise.resolve([])]), [address, projectId]);

	const receive = useCallback(([rules, routes, destinations]: [Rule[], Target[], Target[]]) => {
		setRules(rules);
		setRoutes(routes);
		setDestinations(destinations);
		setLoading(false);
	}, []);

	const failed = useCallback((cause: unknown) => {
		setError(cause instanceof Error ? cause.message : "Notification rules unavailable");
		setLoading(false);
	}, []);

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

	function edit(rule: Rule | null) {
		setEditing(rule);
		setEnabled(rule?.enabled ?? false);
		setCount(String(rule?.count ?? 1));
		setWindowSeconds(String(rule?.windowSeconds ?? 60));
		setEndpointId(rule?.endpointId ?? "");
		setDestinationId(rule?.destinationId ?? "");
		setSeverity(rule?.severity ?? "warning");
		setRecovery(rule?.recoveryPolicy ?? "window");
		setCooldown(String(rule?.cooldownSeconds ?? 0));
		setError("");
		setNotice("");
		setOpen(true);
	}

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const json = {
				enabled,
				count: Number(count),
				windowSeconds: Number(windowSeconds),
				endpointId: endpointId || null,
				destinationId: destinationId || null,
				severity,
				recoveryPolicy: recovery,
				cooldownSeconds: Number(cooldown),
			};
			await api(editing ? "/notification-rules/" + editing.id : address + "/notification-rules", { method: editing ? "PATCH" : "POST", ...(editing ? { version: editing.version } : {}), json });
			setOpen(false);
			receive(await fetchData());
			setNotice("Notification rule saved. Only enabled rules create failure alerts.");
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	if (!project || !project.permissions.includes("notifications.rules.manage")) return <p>You do not have access to these notification settings.</p>;

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<Link className='button button--secondary w-fit' href={address}>
						<IconArrowLeft size={16} />
						Back to {projectId ? "project" : "workspace"}
					</Link>
					<p className='text-muted mt-4 text-sm'>{project.name}</p>
					<h1 className='text-3xl font-semibold'>Failure notification rules</h1>
					<p className='text-muted mt-2'>No default failure alerts. Thresholds count distinct managed operations, not repeated retry attempts. {workspaceId && "Workspace rules count across all projects in this workspace."}</p>
				</div>
				<Button onPress={() => edit(null)}>
					<IconPlus size={18} />
					Create notification rule
				</Button>
			</header>
			{open && (
				<Modal
					isOpen={open}
					onOpenChange={(next) => {
						if (!busy) setOpen(next);
					}}
				>
					<Modal.Backdrop>
						<Modal.Container placement='auto' size='lg'>
							<Modal.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto'>
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>{editing ? "Edit notification rule" : "New notification rule"}</Modal.Heading>
								</Modal.Header>
								<Modal.Body>
									<form onSubmit={save} className='flex flex-col gap-4'>
										<Switch isSelected={enabled} onChange={setEnabled}>
											<Switch.Content>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
												<span>Enable failure notifications</span>
											</Switch.Content>
										</Switch>
										<div className='grid gap-4 sm:grid-cols-2'>
											<NumberField variant='secondary' minValue={1} maxValue={1000000} isRequired value={Number(count)} onChange={(value) => setCount(String(value))}>
												<Label>Failure threshold</Label>
												<NumberField.Group>
													<NumberField.DecrementButton />
													<NumberField.Input aria-label='Failure threshold' className='min-w-0 w-full' />
													<NumberField.IncrementButton />
												</NumberField.Group>
												<FieldError />
											</NumberField>
											<NumberField variant='secondary' minValue={1} maxValue={2678400} isRequired value={Number(windowSeconds)} onChange={(value) => setWindowSeconds(String(value))}>
												<Label>Window in seconds</Label>
												<NumberField.Group>
													<NumberField.DecrementButton />
													<NumberField.Input aria-label='Failure window seconds' className='min-w-0 w-full' />
													<NumberField.IncrementButton />
												</NumberField.Group>
												<FieldError />
											</NumberField>
											{projectId && (
												<>
													<Select variant='secondary' fullWidth aria-label='Rule ingress route' value={endpointId} onChange={(key) => setEndpointId(String(key ?? ""))}>
														<Label>Ingress route</Label>
														<Select.Trigger>
															<Select.Value />
															<Select.Indicator />
														</Select.Trigger>
														<Select.Popover>
															<ListBox>
																<ListBox.Item id=''>
																	Every route in this project
																	<ListBox.ItemIndicator />
																</ListBox.Item>
																{routes.map((route) => (
																	<ListBox.Item key={route.id} id={route.id}>
																		{route.name}
																		<ListBox.ItemIndicator />
																	</ListBox.Item>
																))}
															</ListBox>
														</Select.Popover>
													</Select>
													<Select variant='secondary' fullWidth aria-label='Rule destination' value={destinationId} onChange={(key) => setDestinationId(String(key ?? ""))}>
														<Label>Destination</Label>
														<Select.Trigger>
															<Select.Value />
															<Select.Indicator />
														</Select.Trigger>
														<Select.Popover>
															<ListBox>
																<ListBox.Item id=''>
																	Every managed destination
																	<ListBox.ItemIndicator />
																</ListBox.Item>
																{destinations.map((destination) => (
																	<ListBox.Item key={destination.id} id={destination.id}>
																		{destination.name}
																		<ListBox.ItemIndicator />
																	</ListBox.Item>
																))}
															</ListBox>
														</Select.Popover>
													</Select>
												</>
											)}
											<Select variant='secondary' fullWidth aria-label='Rule severity' value={severity} onChange={(key) => setSeverity(String(key ?? "") as Rule["severity"])}>
												<Label>Severity</Label>
												<Select.Trigger>
													<Select.Value />
													<Select.Indicator />
												</Select.Trigger>
												<Select.Popover>
													<ListBox>
														<ListBox.Item id='info'>
															Information
															<ListBox.ItemIndicator />
														</ListBox.Item>
														<ListBox.Item id='warning'>
															Warning
															<ListBox.ItemIndicator />
														</ListBox.Item>
														<ListBox.Item id='critical'>
															Critical
															<ListBox.ItemIndicator />
														</ListBox.Item>
													</ListBox>
												</Select.Popover>
											</Select>
											<Select variant='secondary' fullWidth aria-label='Rule recovery policy' value={recovery} onChange={(key) => setRecovery(String(key ?? "") as Rule["recoveryPolicy"])}>
												<Label>Recovery</Label>
												<Select.Trigger>
													<Select.Value />
													<Select.Indicator />
												</Select.Trigger>
												<Select.Popover>
													<ListBox>
														<ListBox.Item id='window'>
															Resolve when the threshold clears
															<ListBox.ItemIndicator />
														</ListBox.Item>
														<ListBox.Item id='manual'>
															Keep active until the rule is disabled
															<ListBox.ItemIndicator />
														</ListBox.Item>
													</ListBox>
												</Select.Popover>
											</Select>
											<NumberField className='sm:col-span-2' variant='secondary' minValue={0} maxValue={86400} isRequired value={Number(cooldown)} onChange={(value) => setCooldown(String(value))}>
												<Label>Cooldown in seconds</Label>
												<NumberField.Group>
													<NumberField.DecrementButton />
													<NumberField.Input aria-label='Rule cooldown seconds' className='min-w-0 w-full' />
													<NumberField.IncrementButton />
												</NumberField.Group>
												<FieldError />
											</NumberField>
										</div>
										<div className='flex flex-wrap justify-center gap-3 sm:justify-start'>
											<Button type='submit' isDisabled={busy}>
												Save notification rule
											</Button>
											<Button variant='ghost' isDisabled={busy} onPress={() => setOpen(false)}>
												Cancel
											</Button>
										</div>
									</form>
								</Modal.Body>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
				</Modal>
			)}
			{loading ? (
				<LoadingState label='Loading notification rules…' />
			) : rules.length ? (
				<div className='grid gap-4 md:grid-cols-2'>
					{rules.map((rule) => (
						<Card key={rule.id} role='group' aria-label={"Notification rule " + rule.id}>
							<Card.Header>
								<h2 className='flex items-center gap-2 font-semibold'>
									<IconBell size={18} />
									{rule.count} failed {rule.count === 1 ? "operation" : "operations"} in {rule.windowSeconds} seconds
								</h2>
								<Card.Description>
									{rule.enabled ? "Enabled" : "Disabled"} / {rule.severity} / {rule.endpointId ? (routes.find((route) => route.id === rule.endpointId)?.name ?? "Selected route") : "Every route"} / {rule.destinationId ? (destinations.find((destination) => destination.id === rule.destinationId)?.name ?? "Selected destination") : "Every managed destination"}
								</Card.Description>
							</Card.Header>
							<Card.Footer>
								<Button variant='secondary' size='sm' onPress={() => edit(rule)}>
									<IconPencil size={16} />
									Edit rule
								</Button>
							</Card.Footer>
						</Card>
					))}
				</div>
			) : (
				<ResourceEmptyState
					className='border-border rounded-xl border border-dashed py-12'
					title={<>No failure notification rules</>}
					description={<>Failures stay visible in event history. Enable a threshold only where notifications matter to this project.</>}
					icon={
						<>
							<IconBell />
						</>
					}
				/>
			)}
		</section>
	);
}
