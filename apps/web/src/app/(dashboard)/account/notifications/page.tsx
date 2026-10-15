"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Table, Switch, Button } from "@heroui/react";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";

type Preference = {
	id: string;
	projectId: string | null;
	workspaceId: string | null;
	enabled: boolean;
	count: number;
	windowSeconds: number;
	severity: string;
	smtpEnabled: boolean;
};

export default function NotificationPreferencesPage() {
	const { projects, workspaces, me } = useDashboard();

	const [preferences, setPreferences] = useState<Preference[]>([]);
	const [loading, setLoading] = useState(true);
	const [attempt, setAttempt] = useState(0);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState<string | null>(null);

	useFeedbackToast(error, "", { error: "Notification preferences error" });

	useEffect(() => {
		let active = true;
		Promise.all([...projects.filter((project) => project.permissions.includes("notifications.read")).map((project) => api<Preference[]>("/projects/" + project.id + "/notification-subscriptions")), ...workspaces.filter((workspace) => workspace.permissions.includes("notifications.read")).map((workspace) => api<Preference[]>("/workspaces/" + workspace.id + "/notification-subscriptions"))])
			.then(
				(rows) => {
					if (active) setPreferences(rows.flat());
				},
				(cause) => {
					if (active) setError(cause instanceof Error ? cause.message : "Could not load preferences");
				},
			)
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [projects, workspaces, attempt]);

	async function toggle(rule: Preference, enabled: boolean) {
		setBusy(rule.id);
		setError("");
		try {
			await api("/notification-rules/" + rule.id + "/subscription", { method: "PUT", json: { enabled } });
			setPreferences((previous) => previous.map((item) => (item.id === rule.id ? { ...item, smtpEnabled: enabled } : item)));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save preference");
		} finally {
			setBusy(null);
		}
	}

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<h1 className='text-3xl font-semibold'>Your notifications</h1>
				<p className='text-muted mt-2'>Choose which configured failure rules email {me.user.email}. These choices affect only you. Thresholds belong to the project or workspace, and email delivery is off until you opt in.</p>
			</header>
			{loading ? (
				<p role='status'>Loading preferences…</p>
			) : error && preferences.length === 0 ? (
				<div>
					<h2 className='text-xl font-semibold'>Notification preferences unavailable</h2>
					<Button
						variant='secondary'
						onPress={() => {
							setError("");
							setLoading(true);
							setAttempt((value) => value + 1);
						}}
					>
						Retry loading preferences
					</Button>
				</div>
			) : preferences.length ? (
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Your notification preferences'>
							<Table.Header>
								<Table.Column isRowHeader>Rule</Table.Column>
								<Table.Column>Email</Table.Column>
							</Table.Header>
							<Table.Body>
								{preferences.map((rule) => (
									<Table.Row key={rule.id} id={rule.id}>
										<Table.Cell>
											<span className='font-medium'>{rule.workspaceId ? workspaces.find((workspace) => workspace.id === rule.workspaceId)?.name + " workspace" : projects.find((project) => project.id === rule.projectId)?.name}</span>
											<p className='text-muted mt-1 text-xs'>
												{rule.count} failed operations in {rule.windowSeconds}s · {rule.enabled ? rule.severity : "Rule disabled"}
											</p>
										</Table.Cell>
										<Table.Cell>
											<Switch aria-label={"Email alerts for " + (rule.workspaceId ? workspaces.find((workspace) => workspace.id === rule.workspaceId)?.name : projects.find((project) => project.id === rule.projectId)?.name) + ": " + rule.count + (rule.count === 1 ? " failure" : " failures") + " in " + rule.windowSeconds + " seconds"} isSelected={rule.smtpEnabled} isDisabled={busy !== null} onChange={(enabled) => void toggle(rule, enabled)}>
												<Switch.Content>
													<Switch.Control>
														<Switch.Thumb />
													</Switch.Control>
												</Switch.Content>
											</Switch>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			) : (
				<p className='text-muted'>No failure rules are configured for your accessible projects. Your in-app notification inbox remains available.</p>
			)}
			<Link href='/account' className='text-accent'>
				Back to account settings
			</Link>
		</section>
	);
}
