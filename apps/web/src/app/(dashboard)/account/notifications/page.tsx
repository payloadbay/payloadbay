"use client";

import { LoadingState } from "@components/loading-state";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Table, Switch, Button } from "@heroui/react";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";

type Channel = {
	id: string;
	name: string;
	enabled: boolean;
	kind: string;
	activeRevisionId: string | null;
	activeVersion: number;
};

type Preference = {
	id: string;
	projectId: string | null;
	workspaceId: string | null;
	enabled: boolean;
	count: number;
	windowSeconds: number;
	severity: string;
	smtpEnabled: boolean;
	channels: string[];
	channelVersions: Record<string, number>;
};

export default function NotificationPreferencesPage() {
	const { projects, workspaces, me } = useDashboard();

	const [channels, setChannels] = useState<Channel[]>([]);
	const [preferences, setPreferences] = useState<Preference[]>([]);
	const [loading, setLoading] = useState(true);
	const [attempt, setAttempt] = useState(0);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState<string | null>(null);
	const edits = useRef(0);

	useFeedbackToast(error, "", { error: "Notification preferences error" });

	useEffect(() => {
		let active = true;
		const revision = edits.current;
		Promise.all([api<Channel[]>("/notification-channels"), Promise.all([...projects.filter((project) => project.permissions.includes("notifications.read")).map((project) => api<Preference[]>("/projects/" + project.id + "/notification-subscriptions")), ...workspaces.filter((workspace) => workspace.permissions.includes("notifications.read")).map((workspace) => api<Preference[]>("/workspaces/" + workspace.id + "/notification-subscriptions"))])])
			.then(
				([available, rows]) => {
					if (active && revision === edits.current) {
						setChannels(available);
						setPreferences(rows.flat());
					}
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

	async function toggle(rule: Preference, channel: string, enabled: boolean) {
		edits.current += 1;
		setBusy(rule.id);
		setError("");
		try {
			await api("/notification-rules/" + rule.id + "/subscription", { method: "PUT", json: { enabled, channel, ...(enabled && channel !== "smtp" ? { revisionId: channels.find((item) => item.id === channel)?.activeRevisionId } : {}) } });
			setPreferences((previous) =>
				previous.map((item) =>
					item.id === rule.id
						? {
								...item,
								smtpEnabled: channel === "smtp" ? enabled : item.smtpEnabled,
								channels: enabled ? [...new Set([...item.channels, channel])] : item.channels.filter((id) => id !== channel),
								channelVersions: enabled && channel !== "smtp" ? { ...item.channelVersions, [channel]: channels.find((entry) => entry.id === channel)!.activeVersion } : item.channelVersions,
							}
						: item,
				),
			);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save preference");
		} finally {
			setBusy(null);
		}
	}

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<h1 className='text-3xl font-semibold'>Notification settings</h1>
				<p className='text-muted mt-2'>Choose how failure rules notify you at {me.user.email}. These subscriptions affect only your account.</p>
			</header>
			{loading ? (
				<LoadingState label='Loading preferences…' />
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
								<Table.Column>Channels</Table.Column>
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
											<div className='flex flex-col gap-3'>
												{channels.map((channel) => (
													<Switch
														key={channel.id}
														slot={null}
														aria-label={(channel.id === "smtp" ? "Email" : channel.name) + " alerts for " + (rule.workspaceId ? workspaces.find((workspace) => workspace.id === rule.workspaceId)?.name : projects.find((project) => project.id === rule.projectId)?.name) + ": " + rule.count + (rule.count === 1 ? " failure" : " failures") + " in " + rule.windowSeconds + " seconds"}
														isSelected={rule.channels.includes(channel.id)}
														isDisabled={busy !== null || (!channel.enabled && !rule.channels.includes(channel.id))}
														onChange={(enabled) => void toggle(rule, channel.id, enabled)}
													>
														<Switch.Content>
															<Switch.Control>
																<Switch.Thumb />
															</Switch.Control>
														</Switch.Content>
														<span>
															{channel.name}
															{channel.id !== "smtp" ? ` · v${rule.channels.includes(channel.id) ? (rule.channelVersions[channel.id] ?? channel.activeVersion) : channel.activeVersion}` : ""}
															{!channel.enabled ? " · Paused" : ""}
														</span>
													</Switch>
												))}
											</div>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			) : (
				<section className='flex flex-col gap-4'>
					<div>
						<h2 className='text-xl font-semibold'>Choose what should notify you</h2>
						<p className='text-muted mt-2'>No failure rules are configured yet. Create a threshold on a workspace or project, then choose Email or another available channel here. Alerts remain off until you subscribe; your in-app inbox stays available.</p>
					</div>
					{[...workspaces, ...projects].some((resource) => resource.permissions.includes("notifications.rules.manage")) && (
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Configure notification rules'>
									<Table.Header>
										<Table.Column isRowHeader>Resource</Table.Column>
										<Table.Column>Notification rules</Table.Column>
									</Table.Header>
									<Table.Body>
										{[...workspaces.map((workspace) => ({ ...workspace, href: "/workspaces/" + workspace.id + "/notifications", kind: "Workspace" })), ...projects.map((project) => ({ ...project, href: "/projects/" + project.id + "/notifications", kind: "Project" }))]
											.filter((resource) => resource.permissions.includes("notifications.rules.manage"))
											.map((resource) => (
												<Table.Row key={resource.id} id={resource.id}>
													<Table.Cell>
														<span className='font-medium'>{resource.name}</span>
														<span className='text-muted block text-xs'>{resource.kind}</span>
													</Table.Cell>
													<Table.Cell>
														<Link className='button button--secondary button--sm' href={resource.href} aria-label={"Configure notification rules for " + resource.name}>
															Configure rules
														</Link>
													</Table.Cell>
												</Table.Row>
											))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					)}
				</section>
			)}
			<Link href='/account' className='text-accent'>
				Back to account settings
			</Link>
		</section>
	);
}
