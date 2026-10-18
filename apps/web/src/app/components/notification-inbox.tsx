"use client";

import { useLiveSubscription } from "@components/live-subscription";
import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import { useEffect, useState, useCallback, useId } from "react";
import { Button, Popover, Chip } from "@heroui/react";

import { IconBell, IconAlertTriangle, IconAlertOctagon, IconCheck, IconX } from "@tabler/icons-react";
import { api } from "@lib/api-client";

type Scope = { type: "instance" | "organization" | "workspace" | "project"; id: string };
type Notice = {
	id: string;
	subject: string;
	severity: "info" | "warning" | "critical";
	kind: string;
	scopeName?: string;
	data: Record<string, unknown>;
};

export function NotificationInbox({ scope, label = "Notifications" }: { scope?: Scope; label?: string }) {
	const descriptionId = useId();

	const closeControlId = useId();

	const { subscribe } = useLiveSubscription();

	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<Notice[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState<string | null>(null);

	useFeedbackToast(error, "", { error: "Notifications error", success: "Success" });

	const scopeType = scope?.type;
	const scopeId = scope?.id;

	const fetchData = useCallback(() => api<Notice[]>(scopeType && scopeId ? "/notifications?scopeType=" + scopeType + "&scopeId=" + encodeURIComponent(scopeId) : "/notifications?account=true"), [scopeType, scopeId]);

	const receive = useCallback((items: Notice[]) => {
		setItems(items);
		setError("");
		setLoading(false);
	}, []);

	const failed = useCallback((cause: unknown) => {
		setError(cause instanceof Error ? cause.message : "Notifications unavailable");
		setLoading(false);
	}, []);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			receive(await fetchData());
		} catch (cause) {
			failed(cause);
		}
	}, [fetchData, receive, failed]);

	useEffect(() => {
		let active = true;

		const refresh = () =>
			fetchData().then(
				(data) => {
					if (active) receive(data);
				},
				(cause) => {
					if (active) failed(cause);
				},
			);

		void refresh();
		const stopNotification = subscribe("notification.changed", refresh);
		const stopResync = subscribe("resync-required", refresh);

		return () => {
			active = false;
			stopNotification();
			stopResync();
		};
	}, [fetchData, receive, failed, scope?.type, scope?.id, subscribe]);

	async function dismiss(id: string) {
		setBusy(id);
		try {
			await api("/notifications/" + id + "/dismiss", { method: "POST" });
			await load();
			document.getElementById(closeControlId)?.focus({ preventScroll: true });
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not dismiss notification");
		} finally {
			setBusy(null);
		}
	}

	const critical = items.some((item) => item.severity === "critical");
	const warning = items.some((item) => item.severity === "warning");
	const Icon = critical ? IconAlertOctagon : warning ? IconAlertTriangle : IconBell;
	const severity = critical ? "critical" : warning ? "warning" : "info";
	const description = loading ? "Loading notifications." : items.length > 0 ? `${items.length} active notification${items.length === 1 ? "" : "s"}. Highest severity: ${severity}.` : error ? "Notifications unavailable." : "No active notifications.";

	return (
		<Popover isOpen={open} onOpenChange={setOpen}>
			<Button isIconOnly variant='ghost' aria-label={label} aria-describedby={descriptionId} onPress={() => setOpen(true)} className={"relative " + (critical ? "text-danger" : warning ? "text-warning" : "text-accent")}>
				<span id={descriptionId} className='sr-only'>
					{description}
				</span>
				<Icon size={20} aria-hidden='true' />
				{items.length > 0 && (
					<span aria-label='Active notification count' className='bg-accent text-accent-foreground absolute -right-1 -top-1 min-w-4 rounded-full px-1 text-[10px]'>
						{items.length}
					</span>
				)}
			</Button>

			<Popover.Content placement='bottom end' className='w-[calc(100vw-2rem)] max-w-md'>
				<Popover.Dialog aria-label={label} className='flex max-h-[min(36rem,calc(100dvh-8rem))] flex-col'>
					<Button id={closeControlId} isIconOnly variant='ghost' aria-label='Close notifications' className='self-end' onPress={() => setOpen(false)}>
						<IconX size={18} />
					</Button>
					<header className='mb-4'>
						<Popover.Heading>{label}</Popover.Heading>
						<p className='text-muted text-sm'>All notices you can access. Dismissal applies to your account.</p>
					</header>
					<div className='flex min-h-0 flex-col gap-4 overflow-y-auto'>
						{loading ? (
							<LoadingState label='Loading notifications…' />
						) : error ? (
							<div className='flex flex-col items-start gap-3'>
								<p>Notifications unavailable.</p>
								<Button variant='secondary' onPress={() => void load()}>
									Retry loading notifications
								</Button>
							</div>
						) : (
							items.length === 0 && <p className='text-muted'>No active notifications.</p>
						)}
						{items.map((item) => (
							<article key={item.id} className='border-border rounded-lg border p-4'>
								<Button aria-label={item.subject} variant='ghost' className='h-auto w-full justify-start whitespace-normal text-left' onPress={() => setSelected(selected === item.id ? null : item.id)} aria-expanded={selected === item.id}>
									<span className='flex min-w-0 flex-col gap-2'>
										<span>{item.subject}</span>
										<span className='flex flex-wrap items-center gap-2'>
											<Chip size='sm' color={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "accent"}>
												{item.severity}
											</Chip>
											{item.scopeName && <span className='text-muted text-xs'>{item.scopeName}</span>}
										</span>
									</span>
								</Button>
								{selected === item.id && item.kind === "executor.containment-advice" && (
									<>
										<p className='text-muted mt-2 text-sm'>Configured mode: ordinary Docker (runc). Script execution has container and resource limits; additional host isolation is optional.</p>
										<p className='mt-3 text-sm'>{typeof item.data.instructions === "string" ? item.data.instructions : ""}</p>
									</>
								)}
								{selected === item.id && item.kind !== "executor.containment-advice" && <p className='text-muted mt-2 text-sm'>{typeof item.data.observedCount === "number" ? `${item.data.observedCount} failed operations in ${item.data.windowSeconds} seconds. Your configured threshold is ${item.data.threshold}.` : typeof item.data.message === "string" ? item.data.message : "A configured notification condition needs attention."}</p>}
								<Button isIconOnly size='sm' variant='secondary' className='mt-4' isDisabled={busy !== null} aria-label={"Dismiss notification " + item.subject} onPress={() => void dismiss(item.id)}>
									<IconCheck size={16} />
								</Button>
							</article>
						))}
					</div>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
