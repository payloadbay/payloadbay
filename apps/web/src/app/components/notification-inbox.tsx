"use client";

import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import { useEffect, useState, useCallback, useId } from "react";
import { Button, Modal } from "@heroui/react";

import { IconBell, IconAlertTriangle, IconAlertOctagon, IconCheck } from "@tabler/icons-react";
import { api } from "@lib/api-client";

type Scope = { type: "instance" | "organization" | "workspace" | "project"; id: string };
type Notice = {
	id: string;
	subject: string;
	severity: "info" | "warning" | "critical";
	kind: string;
	data: Record<string, unknown>;
};

export function NotificationInbox({ scope, label = "Notifications" }: { scope: Scope; label?: string }) {
	const descriptionId = useId();

	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<Notice[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState<string | null>(null);

	useFeedbackToast(error, "", { error: "Notifications error", success: "Success" });

	const fetchData = useCallback(() => api<Notice[]>("/notifications?scopeType=" + scope.type + "&scopeId=" + encodeURIComponent(scope.id)), [scope.type, scope.id]);

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
		const changes = new EventSource("/api/v1/changes?scopeType=" + scope.type + "&scopeId=" + encodeURIComponent(scope.id));
		changes.addEventListener("notification.changed", refresh);
		changes.addEventListener("resync-required", refresh);

		return () => {
			active = false;
			changes.close();
		};
	}, [fetchData, receive, failed, scope.type, scope.id]);

	async function dismiss(id: string) {
		setBusy(id);
		try {
			await api("/notifications/" + id + "/dismiss", { method: "POST" });
			await load();
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
		<>
			<Button variant='ghost' aria-label={label} aria-describedby={descriptionId} onPress={() => setOpen(true)} className={critical ? "text-danger" : warning ? "text-warning" : "text-accent"}>
				<span id={descriptionId} className='sr-only'>
					{description}
				</span>
				<Icon size={20} aria-hidden='true' />
				{items.length > 0 && <span aria-label='Active notification count'>{items.length}</span>}
			</Button>
			<Modal isOpen={open} onOpenChange={setOpen}>
				<Modal.Backdrop>
					<Modal.Container placement='auto' size='lg'>
						<Modal.Dialog>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>{label}</Modal.Heading>
								<p className='text-muted text-sm'>Notices for this scope. Dismissal applies to your account.</p>
							</Modal.Header>
							<Modal.Body className='flex flex-col gap-4'>
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
										<h3 className='font-semibold'>{item.subject}</h3>
										{item.kind === "executor.containment-advice" && (
											<>
												<p className='text-muted mt-2 text-sm'>Configured mode: ordinary Docker (runc). Script execution has container and resource limits; additional host isolation is optional.</p>
												<p className='mt-3 text-sm'>{typeof item.data.instructions === "string" ? item.data.instructions : ""}</p>
											</>
										)}
										<Button size='sm' variant='secondary' className='mt-4' isDisabled={busy !== null} aria-label={"Dismiss notification " + item.subject} onPress={() => void dismiss(item.id)}>
											<IconCheck size={16} />
											Dismiss
										</Button>
									</article>
								))}
							</Modal.Body>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</>
	);
}
