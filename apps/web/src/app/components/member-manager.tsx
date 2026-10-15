"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Button, Form, Checkbox, Table, TextField, Label, Input, FieldError } from "@heroui/react";
import { Sheet, EmptyState, NativeSelect } from "@heroui-pro/react";
import { IconUsers, IconPencil, IconUserPlus, IconX } from "@tabler/icons-react";
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
	version: number | null;
};

type Invitation = {
	id: string;
	email: string;
	expires_at: string;
	grants: { scope: ScopeRef; role: string; permissions: Permission[] }[];
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
	const { me, projects } = useDashboard();

	const scope = chosen ?? { type: "instance" as const, id: me.instanceId };
	const held = chosenHeld ?? me.permissions;

	const [members, setMembers] = useState<Member[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [editing, setEditing] = useState<Member | null>(null);
	const [role, setRole] = useState("viewer");
	const [selected, setSelected] = useState<Permission[]>([]);
	const [inviting, setInviting] = useState(false);
	const [email, setEmail] = useState("");
	const [invitations, setInvitations] = useState<Invitation[]>([]);
	const [access, setAccess] = useState("scope");
	const [projectIds, setProjectIds] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);

	useFeedbackToast(error, "", { error: "Members error", success: "Success" });

	const url = "/members?scopeType=" + scope.type + "&scopeId=" + scope.id;

	const read = useCallback(async () => {
		const [rows, pending] = await Promise.all([api<Member[]>(url), api<Invitation[]>("/invitations?scopeType=" + scope.type + "&scopeId=" + scope.id)]);

		return { rows, pending };
	}, [url, scope.type, scope.id]);

	const assignable = projects.filter((project) => project.permissions.includes("members.manage") && (scope.type === "instance" || (scope.type === "workspace" && project.workspace_id === scope.id)));

	useEffect(() => {
		let active = true;
		read()
			.then(
				({ rows, pending }) => {
					if (active) {
						setInvitations(pending);
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
			const data = await read();
			setMembers(data.rows);
			setInvitations(data.pending);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Members unavailable");
		} finally {
			setLoading(false);
		}
	}

	function edit(member: Member) {
		setEditing(member);
		setRole(["owner", "admin", "operator", "viewer", "custom"].includes(member.role_preset) ? member.role_preset : "custom");
		setSelected(member.permissions);
		setError("");
	}

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!editing && !inviting) return;
		setBusy(true);
		setError("");
		try {
			if (inviting) {
				const targets: ScopeRef[] = access === "projects" ? projectIds.map((id) => ({ type: "project", id })) : [scope];
				if (!targets.length) throw Error("Choose at least one project");
				await api("/invitations", { method: "POST", json: { scope, email, grants: targets.map((target) => ({ scope: target, role, permissions: selected })) } });
			} else if (editing)
				await api("/members", {
					method: "PUT",
					version: editing.version ?? undefined,
					json: {
						scope,
						userId: editing.user_id,
						role,
						permissions: selected,
					},
				});
			const data = await read();
			setMembers(data.rows);
			setInvitations(data.pending);
			setEditing(null);
			setInviting(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save permissions");
		} finally {
			setBusy(false);
		}
	}

	async function cancel(id: string) {
		setBusy(true);
		setError("");
		try {
			await api("/invitations/" + id, { method: "DELETE" });
			const data = await read();
			setMembers(data.rows);
			setInvitations(data.pending);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not cancel invitation");
		} finally {
			setBusy(false);
		}
	}

	function invite() {
		setEditing(null);
		setInviting(true);
		setEmail("");
		setRole("viewer");
		setSelected(me.roles.viewer ?? []);
		setProjectIds([]);
		setAccess(scope.type === "instance" ? "projects" : "scope");
		setError("");
	}

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<p className='text-muted text-sm'>Access and ownership</p>
					<h1 className='text-3xl font-semibold'>{scope.type === "instance" ? "Instance members" : scope.type === "workspace" ? "Workspace members" : "Project members"}</h1>
					<p className='text-muted mt-2'>Permissions apply to this scope and its children. Inherited access continues to apply.</p>
				</div>
				<Button onPress={invite}>
					<IconUserPlus size={18} aria-hidden='true' />
					Invite someone
				</Button>
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
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Members'>
							<Table.Header>
								<Table.Column isRowHeader>Person</Table.Column>
								<Table.Column>Access</Table.Column>
								<Table.Column>Actions</Table.Column>
							</Table.Header>
							<Table.Body>
								{members.map((member) => (
									<Table.Row key={member.user_id} id={member.user_id}>
										<Table.Cell>
											<span className='font-medium'>{member.name}</span>
											<span className='text-muted mt-1 block break-all text-xs'>{member.email}</span>
										</Table.Cell>
										<Table.Cell>
											<span className='capitalize'>{member.role_preset === "member" ? "Admitted · no instance role" : member.role_preset}</span>
											{member.inherited_permissions.length > 0 && <span className='text-muted mt-1 block text-xs'>Includes inherited permissions</span>}
										</Table.Cell>
										<Table.Cell>
											<Button size='sm' variant='secondary' aria-label={"Edit permissions for " + member.name} onPress={() => edit(member)}>
												<IconPencil size={16} aria-hidden='true' />
												Edit
											</Button>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
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
			{invitations.length > 0 && (
				<section className='flex flex-col gap-3'>
					<h2 className='text-xl font-semibold'>Pending invitations</h2>
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Pending invitations'>
								<Table.Header>
									<Table.Column isRowHeader>Email</Table.Column>
									<Table.Column>Access</Table.Column>
									<Table.Column>Actions</Table.Column>
								</Table.Header>
								<Table.Body>
									{invitations.map((invitation) => (
										<Table.Row key={invitation.id} id={invitation.id}>
											<Table.Cell>
												<span className='break-all'>{invitation.email}</span>
												<span className='text-muted mt-1 block text-xs'>Pending · expires {new Date(invitation.expires_at).toLocaleDateString()}</span>
											</Table.Cell>
											<Table.Cell>
												{invitation.grants.map((grant) => (
													<p key={grant.scope.id} className='text-sm capitalize'>
														{grant.role} · {grant.scope.type === "project" ? (projects.find((project) => project.id === grant.scope.id)?.name ?? "Project") : grant.scope.type}
													</p>
												))}
											</Table.Cell>
											<Table.Cell>
												<Button size='sm' variant='ghost' isDisabled={busy} aria-label={"Cancel invitation for " + invitation.email} onPress={() => void cancel(invitation.id)}>
													<IconX size={16} aria-hidden='true' />
													Cancel
												</Button>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				</section>
			)}
			<Sheet
				isOpen={Boolean(editing) || inviting}
				onOpenChange={(open) => {
					if (!open && !busy) {
						setEditing(null);
						setInviting(false);
					}
				}}
			>
				<Sheet.Backdrop>
					<Sheet.Content>
						<Sheet.Dialog aria-describedby='member-permissions-description'>
							<Sheet.CloseTrigger />
							<Sheet.Header>
								<Sheet.Heading>{inviting ? "Invite someone" : "Permissions for " + editing?.name}</Sheet.Heading>
								<p id='member-permissions-description' className='text-muted text-sm'>
									Start with a role preset, then customize individual permissions. Inviting someone new to this instance requires instance admission rights.
								</p>
							</Sheet.Header>
							<Sheet.Body>
								<Form id='member-permissions' className='flex flex-col gap-5' onSubmit={save}>
									{inviting && (
										<>
											<TextField type='email' isRequired value={email} onChange={setEmail}>
												<Label>Email address</Label>
												<Input variant='secondary' name='email' autoComplete='email' />
												<FieldError />
											</TextField>
											{scope.type !== "project" && (
												<>
													<NativeSelect variant='secondary' fullWidth>
														<Label>Where should they have access?</Label>
														<NativeSelect.Trigger aria-label='Invitation access scope' value={access} onChange={(event) => setAccess(event.target.value)}>
															<NativeSelect.Option value='projects'>Selected projects only</NativeSelect.Option>
															<NativeSelect.Option value='scope'>{scope.type === "instance" ? "Entire instance and all workspaces" : "Entire workspace and its projects"}</NativeSelect.Option>
															<NativeSelect.Indicator />
														</NativeSelect.Trigger>
													</NativeSelect>
													{access === "projects" && (
														<fieldset className='flex flex-col gap-3'>
															<legend className='mb-2 font-medium'>Projects</legend>
															{assignable.map((project) => (
																<Checkbox key={project.id} isSelected={projectIds.includes(project.id)} onChange={(checked) => setProjectIds((previous) => (checked ? [...previous, project.id] : previous.filter((id) => id !== project.id)))}>
																	<Checkbox.Content>
																		<Checkbox.Control>
																			<Checkbox.Indicator />
																		</Checkbox.Control>
																		<span>{project.name}</span>
																	</Checkbox.Content>
																</Checkbox>
															))}
															{!assignable.length && <p className='text-muted text-sm'>No projects you can manage.</p>}
														</fieldset>
													)}
												</>
											)}
										</>
									)}
									<NativeSelect variant='secondary' fullWidth>
										<Label>Role preset</Label>
										<NativeSelect.Trigger
											aria-label='Role preset'

											value={role}
											onChange={(e) => {
												const next = e.target.value;
												setRole(next);
												if (next !== "custom") setSelected(me.roles[next] ?? []);
											}}
										>
											<NativeSelect.Option value='owner'>Owner</NativeSelect.Option>
											<NativeSelect.Option value='admin'>Admin</NativeSelect.Option>
											<NativeSelect.Option value='operator'>Operator</NativeSelect.Option>
											<NativeSelect.Option value='viewer'>Viewer</NativeSelect.Option>
											<NativeSelect.Option value='custom'>Custom</NativeSelect.Option>
											<NativeSelect.Indicator />
										</NativeSelect.Trigger>
									</NativeSelect>
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
								<Button type='submit' form='member-permissions' isDisabled={busy || (inviting && access === "projects" && projectIds.length === 0)}>
									{busy ? "Saving…" : inviting ? "Send invitation" : "Save permissions"}
								</Button>
								<Button
									variant='ghost'
									isDisabled={busy}
									onPress={() => {
										setEditing(null);
										setInviting(false);
									}}
								>
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
