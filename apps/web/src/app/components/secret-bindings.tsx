"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, FieldError, Table, Modal } from "@heroui/react";
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
	projectId?: string;
	scope?: { type: "instance" | "organization" | "workspace" | "project"; id: string };
	bindings: Record<string, string>;
	onChange: (bindings: Record<string, string>) => void;
	canUse: boolean;
	canManage: boolean;
	disabled: boolean;
};

export function SecretBindings({ projectId, scope, bindings, onChange, canUse, canManage, disabled }: SecretBindingsProps) {
	const scopeType = scope?.type ?? "project";
	const scopeId = scope?.id ?? projectId;

	const [versions, setVersions] = useState<Version[]>([]);
	const [binding, setBinding] = useState("");
	const [selected, setSelected] = useState("");
	const [creating, setCreating] = useState(false);
	const [bindingOpen, setBindingOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [name, setName] = useState("");
	const [value, setValue] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	useFeedbackToast(error, notice, { error: "Secret configuration error", success: "Secret status" });

	const fetchData = useCallback(() => api<Version[]>("/secrets?scopeType=" + scopeType + "&scopeId=" + scopeId), [scopeType, scopeId]);

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
		setBindingOpen(false);
		setNotice("");
		setError("");
	}

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setNotice("");
		setError("");
		try {
			const secret = await api<Version>("/secrets", { method: "POST", json: { scope: { type: scopeType, id: scopeId }, name, value } });
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
				<Card.Description>Bind an encrypted value to a script key, then read it with ctx.secrets.YOUR_KEY. Values are injected only during execution.</Card.Description>
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

				<div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
					<TextField aria-label='Search secrets' value={query} onChange={setQuery} className='min-w-0 w-full sm:min-w-48 sm:flex-1'>
						<Input variant='secondary' placeholder='Search secrets…' />
					</TextField>
					{canUse && versions.some((version) => !version.revoked_at) && (
						<Button variant='secondary' isDisabled={disabled || busy} onPress={() => setBindingOpen(true)}>
							Bind secret version
						</Button>
					)}
					{canManage && (
						<Button
							isDisabled={disabled || busy}
							onPress={() => {
								setName("");
								setValue("");
								setCreating(true);
							}}
						>
							Create secret version
						</Button>
					)}
				</div>
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Secret inventory' className='w-full'>
							<Table.Header>
								<Table.Column isRowHeader>Secret</Table.Column>
								<Table.Column>Version / status</Table.Column>
							</Table.Header>
							<Table.Body>
								{versions
									.filter((version) => version.name.toLowerCase().includes(query.toLowerCase()))
									.map((version) => (
										<Table.Row key={version.id} id={version.id}>
											<Table.Cell>
												{version.name}
												<span className='text-muted block text-xs'>Encrypted · value hidden</span>
											</Table.Cell>
											<Table.Cell>
												v{version.version} · {version.revoked_at ? "Revoked" : "Available"}
											</Table.Cell>
										</Table.Row>
									))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
				<Modal isOpen={bindingOpen} onOpenChange={setBindingOpen}>
					<Modal.Backdrop>
						<Modal.Container placement='auto' size='lg'>
							<Modal.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto'>
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>Bind a secret</Modal.Heading>
								</Modal.Header>
								<Modal.Body>
									<Form onSubmit={bind} className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
										<TextField isRequired value={binding} onChange={setBinding} isDisabled={disabled || busy} pattern='[A-Za-z_][A-Za-z0-9_]*'>
											<Label>Script key</Label>
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
								</Modal.Body>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
				</Modal>
				{!versions.some((version) => !version.revoked_at) && <p className='text-muted text-sm'>No secret versions exist yet.{canManage ? " Create one, then bind it to your script." : " Ask a project administrator to create one."}</p>}
				<Modal
					isOpen={creating}
					onOpenChange={(open) => {
						if (!busy) {
							setCreating(open);
							if (!open) setValue("");
						}
					}}
				>
					<Modal.Backdrop>
						<Modal.Container placement='auto' size='lg'>
							<Modal.Dialog className='max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto'>
								<Modal.CloseTrigger />
								<Modal.Header>
									<Modal.Heading>Create secret version</Modal.Heading>
								</Modal.Header>
								<Modal.Body>
									<Form onSubmit={create} autoComplete='off' className='border-border flex flex-col gap-3 border-t pt-4'>
										<TextField isRequired value={name} onChange={setName} isDisabled={busy}>
											<Label>Secret key</Label>
											<Input variant='secondary' autoComplete='off' data-1p-ignore='true' data-lpignore='true' data-bwignore='true' spellCheck={false} />
											<FieldError />
										</TextField>
										<TextField isRequired type='password' value={value} onChange={setValue} isDisabled={busy}>
											<Label>Secret value</Label>
											<Input variant='secondary' autoComplete='off' data-1p-ignore='true' data-lpignore='true' data-bwignore='true' spellCheck={false} />
											<FieldError />
										</TextField>
										<p className='text-muted text-xs'>Stored encrypted in this project. Rotate by creating another version with the same key.</p>
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
								</Modal.Body>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
				</Modal>
			</Card.Content>
		</Card>
	);
}
