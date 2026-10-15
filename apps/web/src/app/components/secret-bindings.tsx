"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, FieldError, Table } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { IconKey, IconX } from "@tabler/icons-react";
import { api } from "@lib/api-client";

type Version = {
	id: string;
	name: string;
	version: number;
	revoked_at: string | null;
};

type SecretBindingsProps = {
	projectId: string;
	bindings: Record<string, string>;
	onChange: (bindings: Record<string, string>) => void;
	canUse: boolean;
	canManage: boolean;
	disabled: boolean;
};

export function SecretBindings({ projectId, bindings, onChange, canUse, canManage, disabled }: SecretBindingsProps) {
	const [versions, setVersions] = useState<Version[]>([]);
	const [binding, setBinding] = useState("SIGNING_SECRET");
	const [selected, setSelected] = useState("");
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("Signing key");
	const [value, setValue] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	useFeedbackToast(error, notice, { error: "Secret configuration error", success: "Secret status" });

	const fetchData = useCallback(() => api<Version[]>("/secrets?scopeType=project&scopeId=" + projectId), [projectId]);

	const receive = useCallback((versions: Version[]) => {
		setVersions(versions);
		setError("");
	}, []);

	const failed = useCallback((cause: unknown) => setError(cause instanceof Error ? cause.message : "Secrets unavailable"), []);

	const load = useCallback(async () => {
		try {
			receive(await fetchData());
		} catch (cause) {
			failed(cause);
		}
	}, [fetchData, receive, failed]);

	useEffect(() => {
		if (!canUse && !canManage) return;
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
	}, [fetchData, receive, failed, canUse, canManage]);

	function bind(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(binding) || !selected) {
			setError("Choose a binding name and secret version.");

			return;
		}

		onChange({ ...bindings, [binding]: selected });
		setNotice("");
		setError("");
	}

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setNotice("");
		setError("");
		try {
			const secret = await api<Version>("/secrets", { method: "POST", json: { scope: { type: "project", id: projectId }, name, value } });
			setValue("");
			setCreating(false);
			await load();
			setSelected(secret.id);
			setNotice("Secret version created. Its value will not be shown again.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not create secret");
		} finally {
			setBusy(false);
		}
	}

	if (!canUse && !canManage) return null;

	return (
		<Card>
			<Card.Header>
				<h3 className='flex items-center gap-2 font-semibold'>
					<IconKey size={18} />
					Secrets for this stage
				</h3>
				<Card.Description>Bind exact versions to names such as SIGNING_SECRET. Secret values are injected only during execution.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-4'>
				{Object.keys(bindings).length ? (
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Secret bindings'>
								<Table.Header>
									<Table.Column isRowHeader>Binding</Table.Column>
									<Table.Column className='hidden sm:table-cell'>Secret version</Table.Column>
									<Table.Column aria-label='Actions' />
								</Table.Header>
								<Table.Body>
									{Object.entries(bindings).map(([key, id]) => {
										const secret = versions.find((item) => item.id === id);

										return (
											<Table.Row key={key} id={key}>
												<Table.Cell>
													<code className='break-all'>{key}</code>
													<span className='text-muted mt-1 block text-xs sm:hidden'>{secret ? `${secret.name} · v${secret.version}${secret.revoked_at ? " · Revoked" : ""}` : "Unavailable version"}</span>
												</Table.Cell>
												<Table.Cell className='hidden sm:table-cell'>{secret ? `${secret.name} · v${secret.version}${secret.revoked_at ? " · Revoked" : ""}` : "Unavailable version"}</Table.Cell>
												<Table.Cell>
													{canUse && (
														<Button
															isIconOnly
															size='sm'
															variant='ghost'
															aria-label={"Remove binding " + key}
															isDisabled={disabled || busy}
															onPress={() => {
																const next = { ...bindings };
																delete next[key];
																onChange(next);
															}}
														>
															<IconX size={16} />
														</Button>
													)}
												</Table.Cell>
											</Table.Row>
										);
									})}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				) : (
					<p className='text-muted text-sm'>No secrets bound. Add one only if your script needs it.</p>
				)}

				{canUse && versions.some((version) => !version.revoked_at) && (
					<Form onSubmit={bind} className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
						<TextField isRequired value={binding} onChange={setBinding} isDisabled={disabled || busy} pattern='[A-Za-z_][A-Za-z0-9_]*'>
							<Label>Binding name</Label>
							<Input variant='secondary' />
							<FieldError />
						</TextField>
						<NativeSelect variant='secondary' className='min-w-0 w-full sm:w-auto'>
							<Label>Secret version</Label>
							<NativeSelect.Trigger aria-label='Secret version' value={selected} onChange={(event) => setSelected(event.target.value)} disabled={disabled || busy} required>
								<NativeSelect.Option value=''>Choose a version</NativeSelect.Option>
								{versions
									.filter((version) => !version.revoked_at)
									.map((version) => (
										<NativeSelect.Option key={version.id} value={version.id}>
											{version.name} · v{version.version}
										</NativeSelect.Option>
									))}
								<NativeSelect.Indicator />
							</NativeSelect.Trigger>
						</NativeSelect>
						<Button type='submit' variant='secondary' isDisabled={disabled || busy || !selected}>
							Bind secret version
						</Button>
					</Form>
				)}
				{!versions.some((version) => !version.revoked_at) && <p className='text-muted text-sm'>No secret versions exist yet.{canManage ? " Create one below, then bind it to your script." : " Ask a project administrator to create one."}</p>}
				{canManage &&
					(creating ? (
						<Form onSubmit={create} className='border-border flex flex-col gap-3 border-t pt-4'>
							<TextField isRequired value={name} onChange={setName} isDisabled={busy}>
								<Label>Secret name</Label>
								<Input variant='secondary' />
								<FieldError />
							</TextField>
							<TextField isRequired type='password' value={value} onChange={setValue} isDisabled={busy}>
								<Label>Secret value</Label>
								<Input variant='secondary' autoComplete='new-password' />
								<FieldError />
							</TextField>
							<p className='text-muted text-xs'>Stored encrypted in this project. Rotate by creating another version with the same name.</p>
							<div className='flex gap-2'>
								<Button type='submit' isDisabled={busy}>
									{busy ? "Creating…" : "Create secret version"}
								</Button>
								<Button
									variant='ghost'
									isDisabled={busy}
									onPress={() => {
										setCreating(false);
										setValue("");
									}}
								>
									Cancel
								</Button>
							</div>
						</Form>
					) : (
						<Button variant='ghost' className='self-start' isDisabled={disabled} onPress={() => setCreating(true)}>
							Create a secret version
						</Button>
					))}
			</Card.Content>
		</Card>
	);
}
