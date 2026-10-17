"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Checkbox, Chip, FieldError, Form, Input, Label, Table, TextField, Modal } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { useDashboard } from "@components/dashboard-shell";
import { LoadingState } from "@components/loading-state";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import type { Permission } from "@contracts/permissions";

type KeyMetadata = {
	id: string;
	name: string;
	permissions: Permission[];
	workspace_ids: string[] | null;
	expires_at: string;
	revoked_at: string | null;
};

/** The same credential workflow serves personal and organization settings. */
export function ApiKeyManager({ organizationId }: { organizationId?: string }) {
	const { me, organizations, workspaces, projects } = useDashboard();

	const options = [
		{
			type: "instance",
			id: me.instanceId,
			name: "Entire instance",
			permissions: me.permissions,
			organizationId: undefined,
		},
		...organizations.map((item) => ({
			type: "organization",
			id: item.id,
			name: `Organization: ${item.name}`,
			permissions: item.permissions,
			organizationId: item.id,
		})),
		...workspaces.map((item) => ({
			type: "workspace",
			id: item.id,
			name: `Workspace: ${item.name}`,
			permissions: item.permissions,
			organizationId: item.organization_id,
		})),
		...projects.map((item) => ({
			type: "project",
			id: item.id,
			name: `Project: ${item.name}`,
			permissions: item.permissions,
			organizationId: item.organization_id,
		})),
	].filter((item) => item.permissions.includes("tokens.manage") && (!organizationId || item.organizationId === organizationId));

	const [selection, setSelection] = useState("");
	const [loaded, setLoaded] = useState<{ key: string; items: (KeyMetadata & { expired: boolean })[] } | null>(null);
	const [failedRequest, setFailedRequest] = useState("");
	const [refresh, setRefresh] = useState(0);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [dialog, setDialog] = useState<"create" | "secret" | null>(null);
	const [name, setName] = useState("");
	const [days, setDays] = useState("30");
	const [selected, setSelected] = useState<Permission[]>([]);
	const [workspaceMode, setWorkspaceMode] = useState("all");
	const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
	const [secret, setSecret] = useState("");
	const [busy, setBusy] = useState(false);
	const [revoking, setRevoking] = useState<KeyMetadata | null>(null);

	const scope = options.find((item) => `${item.type}:${item.id}` === selection) ?? options[0];
	const scopeKey = scope ? `${scope.type}:${scope.id}` : "";
	const requestKey = `${scopeKey}:${refresh}`;
	const keys = loaded?.key === requestKey ? loaded.items : null;
	const availableWorkspaces = workspaces.filter((item) => item.organization_id === scope?.id);

	useFeedbackToast(error, notice, { error: "API key action failed", success: "API keys" });

	useEffect(() => {
		if (!scopeKey) return;
		let active = true;
		const [scopeType, scopeId] = scopeKey.split(":");
		api<KeyMetadata[]>(`/tokens?${new URLSearchParams({ scopeType, scopeId })}`)
			.then((result) => {
				if (active) {
					setLoaded({ key: requestKey, items: result.map((item) => ({ ...item, expired: new Date(item.expires_at).getTime() <= Date.now() })) });
					setError("");
				}
			})
			.catch((cause) => {
				if (active) {
					setError(cause instanceof Error ? cause.message : "API keys are unavailable");
					setFailedRequest(requestKey);
				}
			});

		return () => {
			active = false;
		};
	}, [scopeKey, requestKey]);

	function closeDialog() {
		if (busy) return;
		setDialog(null);
		setSecret("");
	}

	function startCreate() {
		setName("");
		setSelected([]);
		setWorkspaceMode("all");
		setWorkspaceIds([]);
		setSecret("");
		setError("");
		setDialog("create");
	}

	const handleCreate = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!scope) return;
			setBusy(true);
			setError("");
			setNotice("");
			try {
				const result = await api<{ secret: string }>("/tokens", {
					method: "POST",
					json: {
						scope: { type: scope.type, id: scope.id },
						name,
						permissions: selected,
						expiresAt: new Date(Date.now() + Number(days) * 86400000).toISOString(),
						...(scope.type === "organization" && workspaceMode === "selected" ? { workspaceIds } : {}),
					},
				});
				setSecret(result.secret);
				setDialog("secret");
				setRefresh((value) => value + 1);
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : "API key could not be created");
			} finally {
				setBusy(false);
			}
		},
		[scope, name, selected, days, workspaceMode, workspaceIds],
	);

	async function revoke() {
		if (!scope || !revoking) return;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await api("/tokens", { method: "DELETE", json: { scope: { type: scope.type, id: scope.id }, id: revoking.id } });
			setRevoking(null);
			setRefresh((value) => value + 1);
			setNotice("API key revoked.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "API key could not be revoked");
		} finally {
			setBusy(false);
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(secret);
			setNotice("API key copied.");
		} catch {
			setError("Copy was unavailable. Select and copy the key manually.");
		}
	}

	return (
		<section className='flex min-w-0 flex-col gap-6'>
			<header>
				<h1 className='text-3xl font-semibold'>{organizationId ? "Organization API keys" : "Personal API keys"}</h1>
				<p className='text-muted mt-2'>Keys issued by you. Each key stays within its selected scope and your current permissions. Removing your access also removes the key’s access.</p>
			</header>
			{!scope ? (
				<p>No scopes allow you to manage API keys. Ask an administrator for token-management permission.</p>
			) : (
				<>
					<div className='flex flex-wrap items-end gap-3'>
						<NativeSelect className='w-full sm:max-w-sm' variant='secondary'>
							<Label htmlFor='api-key-scope'>Key scope</Label>
							<NativeSelect.Trigger id='api-key-scope' aria-label='Key scope' value={scopeKey} onChange={(event) => setSelection(event.target.value)}>
								{options.map((item) => (
									<NativeSelect.Option key={item.id} value={`${item.type}:${item.id}`}>
										{item.name}
									</NativeSelect.Option>
								))}
								<NativeSelect.Indicator />
							</NativeSelect.Trigger>
						</NativeSelect>
						<Button onPress={startCreate}>Create API key</Button>
					</div>
					{!keys && failedRequest !== requestKey ? (
						<LoadingState label='Loading API keys…' />
					) : !keys ? (
						<div className='flex min-h-32 flex-col items-center justify-center gap-3'>
							<p>API keys are unavailable.</p>
							<Button variant='secondary' onPress={() => setRefresh((value) => value + 1)}>
								Try again
							</Button>
						</div>
					) : (
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='API keys' className='w-full min-w-[34rem]'>
									<Table.Header>
										<Table.Column isRowHeader>Name</Table.Column>
										<Table.Column>Access</Table.Column>
										<Table.Column>Expires</Table.Column>
										<Table.Column>Status</Table.Column>
										<Table.Column>Actions</Table.Column>
									</Table.Header>
									<Table.Body>
										{keys.map((key) => (
											<Table.Row key={key.id} id={key.id}>
												<Table.Cell>{key.name}</Table.Cell>
												<Table.Cell>
													<p className='max-w-64 text-xs'>{key.permissions.join(", ") || "No permissions"}</p>
													{key.workspace_ids && (
														<p className='text-muted text-xs'>
															{key.workspace_ids.length} selected {key.workspace_ids.length === 1 ? "workspace" : "workspaces"}
														</p>
													)}
												</Table.Cell>
												<Table.Cell>{new Date(key.expires_at).toLocaleDateString()}</Table.Cell>
												<Table.Cell>
													<Chip size='sm' color={key.revoked_at || key.expired ? "default" : "success"}>
														{key.revoked_at ? "Revoked" : key.expired ? "Expired" : "Active"}
													</Chip>
												</Table.Cell>
												<Table.Cell>
													<Button size='sm' variant='danger-soft' isDisabled={Boolean(key.revoked_at)} onPress={() => setRevoking(key)}>
														Revoke
													</Button>
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
							{keys.length === 0 && <Table.Footer>No API keys in this scope.</Table.Footer>}
						</Table>
					)}
				</>
			)}
			<Modal
				isOpen={dialog !== null}
				onOpenChange={(open) => {
					if (!open) closeDialog();
				}}
			>
				<Modal.Backdrop>
					<Modal.Container placement='auto' size='lg'>
						<Modal.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-xl'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>{dialog === "secret" ? "Save your API key" : "Create API key"}</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='overflow-y-auto'>
								{dialog === "secret" ? (
									<div className='flex flex-col gap-4'>
										<p>Copy this key now. It will not be shown again. Keep it in your secret manager.</p>
										<TextField isReadOnly value={secret}>
											<Label>New API key</Label>
											<Input variant='secondary' className='font-mono' />
										</TextField>
										<Button variant='secondary' onPress={copy}>
											Copy key
										</Button>
									</div>
								) : (
									<Form id='create-api-key' onSubmit={(event) => void handleCreate(event)} className='flex flex-col gap-5'>
										<TextField isRequired maxLength={100} value={name} onChange={setName}>
											<Label>Key name</Label>
											<Input variant='secondary' />
											<FieldError />
										</TextField>
										<NativeSelect variant='secondary'>
											<Label htmlFor='api-key-expiry'>Expires after</Label>
											<NativeSelect.Trigger id='api-key-expiry' value={days} onChange={(event) => setDays(event.target.value)}>
												{[7, 30, 90, 365].map((day) => (
													<NativeSelect.Option key={day} value={String(day)}>
														{day} days
													</NativeSelect.Option>
												))}
												<NativeSelect.Indicator />
											</NativeSelect.Trigger>
										</NativeSelect>
										{scope?.type === "organization" && (
											<>
												<NativeSelect variant='secondary'>
													<Label htmlFor='api-key-workspace-access'>Workspace access</Label>
													<NativeSelect.Trigger id='api-key-workspace-access' value={workspaceMode} onChange={(event) => setWorkspaceMode(event.target.value)}>
														<NativeSelect.Option value='all'>All workspaces in this organization</NativeSelect.Option>
														<NativeSelect.Option value='selected'>Selected workspaces only</NativeSelect.Option>
														<NativeSelect.Indicator />
													</NativeSelect.Trigger>
												</NativeSelect>
												{workspaceMode === "selected" && (
													<fieldset className='flex flex-col gap-2'>
														<legend className='mb-2 font-medium'>Allowed workspaces</legend>
														{availableWorkspaces.map((workspace) => (
															<Checkbox variant='secondary' key={workspace.id} isSelected={workspaceIds.includes(workspace.id)} onChange={(checked) => setWorkspaceIds((previous) => (checked ? [...previous, workspace.id] : previous.filter((id) => id !== workspace.id)))}>
																<Checkbox.Content>
																	<Checkbox.Control>
																		<Checkbox.Indicator />
																	</Checkbox.Control>
																	{workspace.name}
																</Checkbox.Content>
															</Checkbox>
														))}
														{availableWorkspaces.length === 0 && <p>No accessible workspaces in this organization.</p>}
													</fieldset>
												)}
											</>
										)}
										<fieldset className='flex flex-col gap-2'>
											<legend className='mb-2 font-medium'>Permissions</legend>
											<p className='text-muted mb-2 text-sm'>Choose only the operations this integration needs.</p>
											{scope?.permissions.map((permission) => (
												<Checkbox variant='secondary' key={permission} isSelected={selected.includes(permission)} onChange={(checked) => setSelected((previous) => (checked ? [...previous, permission] : previous.filter((item) => item !== permission)))}>
													<Checkbox.Content>
														<Checkbox.Control>
															<Checkbox.Indicator />
														</Checkbox.Control>
														{permission}
													</Checkbox.Content>
												</Checkbox>
											))}
										</fieldset>
									</Form>
								)}
							</Modal.Body>
							<Modal.Footer>
								{dialog === "secret" ? (
									<Button onPress={closeDialog}>I saved this key</Button>
								) : (
									<>
										<Button variant='ghost' isDisabled={busy} onPress={closeDialog}>
											Cancel
										</Button>
										<Button type='submit' form='create-api-key' isPending={busy} isDisabled={selected.length === 0 || (scope?.type === "organization" && workspaceMode === "selected" && workspaceIds.length === 0)}>
											Create key
										</Button>
									</>
								)}
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
			<Modal
				isOpen={revoking !== null}
				onOpenChange={(open) => {
					if (!open && !busy) setRevoking(null);
				}}
			>
				<Modal.Backdrop>
					<Modal.Container placement='auto' size='lg'>
						<Modal.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-md'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Revoke API key</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p>Revoke {revoking?.name}? Requests using this key will stop working immediately.</p>
							</Modal.Body>
							<Modal.Footer>
								<Button variant='ghost' isDisabled={busy} onPress={() => setRevoking(null)}>
									Cancel
								</Button>
								<Button variant='danger' isPending={busy} onPress={revoke}>
									Revoke key
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}
