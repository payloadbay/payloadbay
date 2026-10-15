"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Button, Form, Checkbox } from "@heroui/react";
import { Sheet, EmptyState } from "@heroui-pro/react";
import { IconUsers, IconPencil } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { api } from "@lib/api-client";
import { permissions, type Permission } from "@contracts/permissions";
import type { ScopeRef } from "@domain/authorization";

type Member = {
	user_id: string;
	name: string;
	email: string;
	role_preset: string;
	permissions: Permission[];
	inherited_permissions: Permission[];
	version: number;
};

const labels: Record<Permission, string> = {
	"metadata.read": "Read resource metadata",
	"payload.read": "Read event payloads",
	"events.replay": "Replay events",
	"endpoints.pause": "Pause ingress route delivery",
	"endpoints.configure": "Configure ingress routes",
	"destinations.configure": "Configure destinations",
	"code.read": "Read scripts",
	"code.edit": "Edit scripts",
	"code.publish": "Publish scripts",
	"code.test": "Test scripts without effects",
	"code.test.effects": "Test scripts with real effects",
	"secrets.manage": "Manage secret versions",
	"secrets.use": "Use secrets in scripts",
	"members.manage": "Manage member permissions",
	"members.admit": "Admit users to the instance",
	"ownership.transfer": "Transfer ownership",
	"audit.read": "Read audit history",
	"settings.manage": "Manage scoped settings",
	"jobs.read": "Read platform jobs",
	"jobs.manage": "Manage platform jobs",
	"workspaces.create": "Create workspaces",
	"projects.create": "Create projects",
	"tokens.manage": "Manage personal API tokens",
	"notifications.read": "Read notifications",
	"notifications.rules.manage": "Manage notification rules",
};

export function MemberManager({ scope: chosen, held: chosenHeld }: { scope?: ScopeRef; held?: Permission[] }) {
	const { me } = useDashboard();

	const scope = chosen ?? { type: "instance" as const, id: me.instanceId };
	const held = chosenHeld ?? me.permissions;

	const [members, setMembers] = useState<Member[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [editing, setEditing] = useState<Member | null>(null);
	const [role, setRole] = useState("viewer");
	const [selected, setSelected] = useState<Permission[]>([]);
	const [busy, setBusy] = useState(false);

	useFeedbackToast(error, "", { error: "Members error", success: "Success" });

	const url = "/members?scopeType=" + scope.type + "&scopeId=" + scope.id;

	const read = useCallback(() => api<Member[]>(url), [url]);

	useEffect(() => {
		let active = true;
		read()
			.then(
				(rows) => {
					if (active) {
						setMembers(rows);
						setError("");
					}
				},
				(cause) => {
					if (active) setError(cause instanceof Error ? cause.message : "Members unavailable");
				},
			)
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [read]);

	async function retry() {
		setLoading(true);
		setError("");
		try {
			setMembers(await read());
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Members unavailable");
		} finally {
			setLoading(false);
		}
	}

	function edit(member: Member) {
		setEditing(member);
		setRole(member.role_preset);
		setSelected(member.permissions);
		setError("");
	}

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!editing) return;
		setBusy(true);
		setError("");
		try {
			await api("/members", {
				method: "PUT",
				version: editing.version,
				json: {
					scope,
					userId: editing.user_id,
					role,
					permissions: selected,
				},
			});
			setMembers(await read());
			setEditing(null);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save permissions");
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<p className='text-muted text-sm'>Access and ownership</p>
				<h1 className='text-3xl font-semibold'>{scope.type === "instance" ? "Instance members" : "Project members"}</h1>
				<p className='text-muted mt-2'>Permissions apply to this scope and its children. Inherited access continues to apply.</p>
			</header>

			{loading ? (
				<p role='status'>Loading members…</p>
			) : error && members.length === 0 ? (
				<EmptyState>
					<EmptyState.Header>
						<EmptyState.Title>Members unavailable</EmptyState.Title>
						<EmptyState.Description>Membership information could not be loaded.</EmptyState.Description>
					</EmptyState.Header>
					<Button variant='secondary' onPress={() => void retry()}>
						Retry loading members
					</Button>
				</EmptyState>
			) : members.length ? (
				<div className='grid gap-3 md:grid-cols-2'>
					{members.map((member) => (
						<article key={member.user_id} className='border-border bg-surface flex items-center justify-between gap-4 rounded-xl border p-5'>
							<div>
								<h2 className='font-semibold'>{member.name}</h2>
								<p className='text-muted text-sm'>{member.email}</p>
								<p className='text-muted mt-2 text-xs capitalize'>{member.role_preset}</p>
							</div>
							<Button size='sm' variant='secondary' aria-label={"Edit permissions for " + member.name} onPress={() => edit(member)}>
								<IconPencil size={16} aria-hidden='true' />
								Edit
							</Button>
						</article>
					))}
				</div>
			) : (
				<EmptyState>
					<EmptyState.Header>
						<EmptyState.Media variant='icon'>
							<IconUsers aria-hidden='true' />
						</EmptyState.Media>
						<EmptyState.Title>No local members</EmptyState.Title>
						<EmptyState.Description>Users may still have inherited access from a parent scope.</EmptyState.Description>
					</EmptyState.Header>
				</EmptyState>
			)}
			<Sheet
				isOpen={Boolean(editing)}
				onOpenChange={(open) => {
					if (!open && !busy) setEditing(null);
				}}
			>
				<Sheet.Backdrop>
					<Sheet.Content>
						<Sheet.Dialog aria-describedby='member-permissions-description'>
							<Sheet.CloseTrigger />
							<Sheet.Header>
								<Sheet.Heading>Permissions for {editing?.name}</Sheet.Heading>
								<p id='member-permissions-description' className='text-muted text-sm'>
									Start with a role preset, then customize individual permissions.
								</p>
							</Sheet.Header>
							<Sheet.Body>
								<Form id='member-permissions' className='flex flex-col gap-5' onSubmit={save}>
									<label className='flex flex-col gap-2'>
										Role preset
										<select
											aria-label='Role preset'
											className='border-border bg-field rounded-lg border p-2'
											value={role}
											onChange={(e) => {
												const next = e.target.value;
												setRole(next);
												if (next !== "custom") setSelected(me.roles[next] ?? []);
											}}
										>
											<option value='owner'>Owner</option>
											<option value='admin'>Admin</option>
											<option value='operator'>Operator</option>
											<option value='viewer'>Viewer</option>
											<option value='custom'>Custom</option>
										</select>
									</label>
									<p className='text-muted text-sm'>Inherited permissions are checked and locked. Changing this role does not remove them.</p>
									<fieldset className='flex flex-col gap-3'>
										<legend className='mb-3 font-medium'>Permissions</legend>
										{permissions.map((permission) => {
											const inherited = editing?.inherited_permissions.includes(permission) ?? false;

											return (
												<Checkbox
													key={permission}
													isSelected={inherited || selected.includes(permission)}
													isDisabled={inherited || role === "owner" || !held.includes(permission)}
													onChange={(checked) => {
														setRole("custom");
														setSelected((previous) => (checked ? [...new Set([...previous, permission])] : previous.filter((p) => p !== permission)));
													}}
												>
													<Checkbox.Content>
														<Checkbox.Control>
															<Checkbox.Indicator />
														</Checkbox.Control>
														<span>
															{labels[permission]}
															{inherited && <span className='text-muted ml-2 text-xs'>Inherited</span>}
														</span>
													</Checkbox.Content>
												</Checkbox>
											);
										})}
									</fieldset>
								</Form>
							</Sheet.Body>
							<Sheet.Footer>
								<Button type='submit' form='member-permissions' isDisabled={busy}>
									{busy ? "Saving…" : "Save permissions"}
								</Button>
								<Button variant='ghost' isDisabled={busy} onPress={() => setEditing(null)}>
									Cancel
								</Button>
							</Sheet.Footer>
						</Sheet.Dialog>
					</Sheet.Content>
				</Sheet.Backdrop>
			</Sheet>
		</section>
	);
}
