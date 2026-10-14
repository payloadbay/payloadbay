"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@heroui/react";
import { Sheet } from "@heroui-pro/react";
import { IconBell, IconAlertTriangle, IconAlertOctagon, IconCheck } from "@tabler/icons-react";
import { api } from "@lib/api-client";

type Scope = { type: "instance" | "workspace" | "project"; id: string };
type Notice = {
	id: string;
	subject: string;
	severity: "info" | "warning" | "critical";
	kind: string;
	data: Record<string, unknown>;
};

export function NotificationInbox({ scope, label = "Notifications" }: { scope: Scope; label?: string }) {
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState<Notice[]>([]);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState<string | null>(null);

	useFeedbackToast(error, "", { error: "Notifications error", success: "Success" });

	const fetchData = useCallback(() => api<Notice[]>("/notifications?scopeType=" + scope.type + "&scopeId=" + encodeURIComponent(scope.id)), [scope.type, scope.id]);

	const receive = useCallback((items: Notice[]) => {
		setItems(items);
		setError("");
	}, []);

	const failed = useCallback((cause: unknown) => setError(cause instanceof Error ? cause.message : "Notifications unavailable"), []);

	const load = useCallback(async () => {
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

	return (
		<>
			<Button variant='ghost' aria-label={label} onPress={() => setOpen(true)} className={critical ? "text-danger" : warning ? "text-warning" : "text-accent"}>
				<Icon size={20} />
				{items.length > 0 && <span aria-label='Active notification count'>{items.length}</span>}
			</Button>
			<Sheet isOpen={open} onOpenChange={setOpen}>
				<Sheet.Backdrop>
					<Sheet.Content>
						<Sheet.Dialog>
							<Sheet.CloseTrigger />
							<Sheet.Header>
								<Sheet.Heading>{label}</Sheet.Heading>
								<p className='text-muted text-sm'>Notices for this scope. Dismissal applies to your account.</p>
							</Sheet.Header>
							<Sheet.Body className='flex flex-col gap-4'>
								{items.length === 0 && !error && <p className='text-muted'>No active notifications.</p>}
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
							</Sheet.Body>
						</Sheet.Dialog>
					</Sheet.Content>
				</Sheet.Backdrop>
			</Sheet>
		</>
	);
}
