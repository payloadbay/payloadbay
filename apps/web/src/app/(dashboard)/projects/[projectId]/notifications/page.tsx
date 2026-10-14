"use client";

import { use, useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Card, Checkbox } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
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

export default function NotificationRulesPage({ params }: { params: Promise<{ projectId: string }> }) {
	const { projectId } = use(params);

	const { projects } = useDashboard();

	const project = projects.find((project) => project.id === projectId);

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

	const fetchData = useCallback(() => Promise.all([api<Rule[]>("/projects/" + projectId + "/notification-rules"), api<Target[]>("/projects/" + projectId + "/endpoints"), api<Target[]>("/projects/" + projectId + "/destinations")]), [projectId]);

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
			await api(editing ? "/notification-rules/" + editing.id : "/projects/" + projectId + "/notification-rules", { method: editing ? "PATCH" : "POST", ...(editing ? { version: editing.version } : {}), json });
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
					<Link className='text-accent flex items-center gap-2' href={"/projects/" + projectId}>
						<IconArrowLeft size={16} />
						Back to project
					</Link>
					<p className='text-muted mt-4 text-sm'>{project.name}</p>
					<h1 className='text-3xl font-semibold'>Failure notification rules</h1>
					<p className='text-muted mt-2'>No default failure alerts. Thresholds count distinct managed operations, not repeated retry attempts.</p>
				</div>
				<Button onPress={() => edit(null)}>
					<IconPlus size={18} />
					Create notification rule
				</Button>
			</header>
			{open && (
				<Card>
					<Card.Header>
						<h2 className='font-semibold'>{editing ? "Edit notification rule" : "New notification rule"}</h2>
					</Card.Header>
					<Card.Content>
						<form onSubmit={save} className='flex flex-col gap-4'>
							<Checkbox isSelected={enabled} onChange={setEnabled}>
								<Checkbox.Content>
									<Checkbox.Control>
										<Checkbox.Indicator />
									</Checkbox.Control>
									<span>Enable failure notifications</span>
								</Checkbox.Content>
							</Checkbox>
							<div className='grid gap-4 sm:grid-cols-2'>
								<label className='flex flex-col gap-2 text-sm'>
									Failure threshold
									<input aria-label='Failure threshold' type='number' min={1} max={1000000} required value={count} onChange={(event) => setCount(event.target.value)} className='border-border bg-field rounded-lg border p-3' />
								</label>
								<label className='flex flex-col gap-2 text-sm'>
									Window in seconds
									<input aria-label='Failure window seconds' type='number' min={1} max={2678400} required value={windowSeconds} onChange={(event) => setWindowSeconds(event.target.value)} className='border-border bg-field rounded-lg border p-3' />
								</label>
								<label className='flex flex-col gap-2 text-sm'>
									Ingress route
									<select aria-label='Rule ingress route' value={endpointId} onChange={(event) => setEndpointId(event.target.value)} className='border-border bg-field rounded-lg border p-3'>
										<option value=''>Every route in this project</option>
										{routes.map((route) => (
											<option key={route.id} value={route.id}>
												{route.name}
											</option>
										))}
									</select>
								</label>
								<label className='flex flex-col gap-2 text-sm'>
									Destination
									<select aria-label='Rule destination' value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className='border-border bg-field rounded-lg border p-3'>
										<option value=''>Every managed destination</option>
										{destinations.map((destination) => (
											<option key={destination.id} value={destination.id}>
												{destination.name}
											</option>
										))}
									</select>
								</label>
								<label className='flex flex-col gap-2 text-sm'>
									Severity
									<select aria-label='Rule severity' value={severity} onChange={(event) => setSeverity(event.target.value as Rule["severity"])} className='border-border bg-field rounded-lg border p-3'>
										<option value='info'>Information</option>
										<option value='warning'>Warning</option>
										<option value='critical'>Critical</option>
									</select>
								</label>
								<label className='flex flex-col gap-2 text-sm'>
									Recovery
									<select aria-label='Rule recovery policy' value={recovery} onChange={(event) => setRecovery(event.target.value as Rule["recoveryPolicy"])} className='border-border bg-field rounded-lg border p-3'>
										<option value='window'>Resolve when the threshold clears</option>
										<option value='manual'>Keep active until the rule is disabled</option>
									</select>
								</label>
								<label className='flex flex-col gap-2 text-sm'>
									Cooldown in seconds
									<input aria-label='Rule cooldown seconds' type='number' min={0} max={86400} value={cooldown} onChange={(event) => setCooldown(event.target.value)} className='border-border bg-field rounded-lg border p-3' />
								</label>
							</div>
							<div className='flex gap-3'>
								<Button type='submit' isDisabled={busy}>
									Save notification rule
								</Button>
								<Button variant='ghost' isDisabled={busy} onPress={() => setOpen(false)}>
									Cancel
								</Button>
							</div>
						</form>
					</Card.Content>
				</Card>
			)}
			{loading ? (
				<p role='status'>Loading notification rules…</p>
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
									{rule.enabled ? "Enabled" : "Disabled"} · {rule.severity} · {rule.endpointId ? (routes.find((route) => route.id === rule.endpointId)?.name ?? "Selected route") : "Every route"} · {rule.destinationId ? (destinations.find((destination) => destination.id === rule.destinationId)?.name ?? "Selected destination") : "Every managed destination"}
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
				<EmptyState className='border-border rounded-xl border border-dashed py-12'>
					<EmptyState.Header>
						<EmptyState.Media variant='icon'>
							<IconBell />
						</EmptyState.Media>
						<EmptyState.Title>No failure notification rules</EmptyState.Title>
						<EmptyState.Description>Failures stay visible in event history. Enable a threshold only where notifications matter to this project.</EmptyState.Description>
					</EmptyState.Header>
				</EmptyState>
			)}
		</section>
	);
}
