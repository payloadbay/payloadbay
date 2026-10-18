"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, FieldError, Table, Modal, Checkbox, TextArea, Tooltip, Select, ListBox } from "@heroui/react";

import { IconKey, IconX, IconLink, IconFileImport } from "@tabler/icons-react";
import { api } from "@lib/api-client";

type Version = {
	id: string;
	name: string;
	version: number;
	revoked_at: string | null;
};

type StageBindings = Record<"ingress" | "processing", Record<string, string>>;

type SecretBindingsProps = {
	availability?: { bindings: StageBindings; onChange: (bindings: StageBindings) => void };
	projectId?: string;
	scope?: { type: "instance" | "organization" | "workspace" | "project"; id: string };
	bindings: Record<string, string>;
	onChange: (bindings: Record<string, string>) => void;
	canUse: boolean;
	canManage: boolean;
	disabled: boolean;
};

export function SecretBindings({ availability, projectId, scope, bindings, onChange, canUse, canManage, disabled }: SecretBindingsProps) {
	const scopeType = scope?.type ?? "project";
	const scopeId = scope?.id ?? projectId;

	const [selectedStages, setSelectedStages] = useState({ ingress: true, processing: true });
	const [importing, setImporting] = useState(false);
	const [environmentText, setEnvironmentText] = useState("");

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

	function assign(keys: Record<string, string>) {
		if (!availability) return;
		availability.onChange({
			ingress: { ...availability.bindings.ingress, ...(selectedStages.ingress ? keys : {}) },
			processing: { ...availability.bindings.processing, ...(selectedStages.processing ? keys : {}) },
		});
	}

	function changeAvailability(stage: "ingress" | "processing", secret: Version, enabled: boolean) {
		if (!availability) return;
		const next = { ...availability.bindings, [stage]: { ...availability.bindings[stage] } };
		if (!enabled) {
			for (const [key, id] of Object.entries(next[stage])) if (id === secret.id) delete next[stage][key];
		} else {
			const existing = Object.entries({ ...next.ingress, ...next.processing }).find(([, id]) => id === secret.id)?.[0];
			const key = existing ?? secret.name;
			if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(key)) {
				setBinding("");
				setSelected(secret.id);
				setSelectedStages({ ingress: stage === "ingress", processing: stage === "processing" });
				setBindingOpen(true);

				return;
			}

			next[stage][key] = secret.id;
		}

		availability.onChange(next);
	}

	async function importEnvironment(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			const imported = await api<Version[]>("/secrets/import", { method: "POST", json: { scope: { type: scopeType, id: scopeId }, source: environmentText } });
			assign(Object.fromEntries(imported.map((secret) => [secret.name, secret.id])));
			setEnvironmentText("");
			setImporting(false);
			await load();
			setNotice("Imported " + imported.length + " encrypted secret versions. Save the draft to keep stage bindings.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not import secrets");
		} finally {
			setBusy(false);
		}
	}

	function bind(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(binding) || !selected) {
			setError("Choose a binding name and secret version.");

			return;
		}

		if (availability) assign({ [binding]: selected });
		else onChange({ ...bindings, [binding]: selected });
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
			if (availability && canUse) assign({ [name]: secret.id });
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
					{availability ? "Secrets" : "Secrets for this stage"}
				</h3>
				<Card.Description>Access a secret in your script with ctx.secrets.YOUR_KEY. Choose which stages can use each value.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-4'>
				{!availability &&
					(Object.keys(bindings).length ? (
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
														<span className='text-muted mt-1 block text-xs sm:hidden'>{secret ? `${secret.name} / v${secret.version}${secret.revoked_at ? " / Revoked" : ""}` : "Unavailable version"}</span>
													</Table.Cell>
													<Table.Cell className='hidden sm:table-cell'>{secret ? `${secret.name} / v${secret.version}${secret.revoked_at ? " / Revoked" : ""}` : "Unavailable version"}</Table.Cell>
													<Table.Cell className='text-right [&>div]:justify-end'>
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
					))}

				<div className='flex flex-col gap-3'>
					<div className='flex items-center justify-between gap-3'>
						{canManage && (
							<Button
								aria-label='Create secret version'
								isDisabled={disabled || busy}
								onPress={() => {
									setName("");
									setSelectedStages({ ingress: true, processing: true });
									setValue("");
									setCreating(true);
								}}
							>
								Create secret
							</Button>
						)}
						<div className='ml-auto flex shrink-0 gap-2'>
							{canUse && versions.some((version) => !version.revoked_at) && (
								<Tooltip delay={0}>
									<Button variant='secondary' isIconOnly aria-label='Bind secret version' isDisabled={disabled || busy} onPress={() => setBindingOpen(true)}>
										<IconLink size={18} aria-hidden='true' />
									</Button>
									<Tooltip.Content>Bind secret version</Tooltip.Content>
								</Tooltip>
							)}
							{availability && canManage && (
								<Tooltip delay={0}>
									<Button
										variant='secondary'
										isIconOnly
										aria-label='Import .env'
										isDisabled={disabled || busy}
										onPress={() => {
											setSelectedStages({ ingress: true, processing: true });
											setImporting(true);
										}}
									>
										<IconFileImport size={18} aria-hidden='true' />
									</Button>
									<Tooltip.Content>Import .env</Tooltip.Content>
								</Tooltip>
							)}
						</div>
					</div>
					<TextField aria-label='Search secrets' value={query} onChange={setQuery} className='w-full min-w-0'>
						<Input variant='secondary' placeholder='Search secrets…' />
					</TextField>
				</div>
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Secret inventory' className='w-full'>
							<Table.Header>
								<Table.Column isRowHeader>Secret</Table.Column>
								<Table.Column>Version / status</Table.Column>
								{availability && (
									<>
										<Table.Column>Ingress</Table.Column>
										<Table.Column>Processing</Table.Column>
									</>
								)}
							</Table.Header>
							<Table.Body>
								{versions
									.filter((version) => version.name.toLowerCase().includes(query.toLowerCase()))
									.map((version) => (
										<Table.Row key={version.id} id={version.id}>
											<Table.Cell>
												{version.name}
												<span className='text-muted block text-xs'>Encrypted / value hidden</span>
											</Table.Cell>
											<Table.Cell>
												v{version.version} / {version.revoked_at ? "Revoked" : "Available"}
											</Table.Cell>
											{availability &&
												(["ingress", "processing"] as const).map((stage) => (
													<Table.Cell key={stage}>
														<Checkbox variant='secondary' aria-label={version.name + " v" + version.version + " available in " + stage} isSelected={Object.values(availability.bindings[stage]).includes(version.id)} isDisabled={!canUse || disabled || busy || Boolean(version.revoked_at)} onChange={(enabled) => changeAvailability(stage, version, enabled)}>
															<Checkbox.Content>
																<Checkbox.Control>
																	<Checkbox.Indicator />
																</Checkbox.Control>
															</Checkbox.Content>
														</Checkbox>
													</Table.Cell>
												))}
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
										<Select variant='secondary' className='min-w-0 w-full sm:w-auto' aria-label='Secret version' value={selected} onChange={(key) => setSelected(String(key ?? ""))} isDisabled={disabled || busy} isRequired>
											<Label>Secret version</Label>
											<Select.Trigger>
												<Select.Value />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													<ListBox.Item id=''>
														Choose a version
														<ListBox.ItemIndicator />
													</ListBox.Item>
													{versions
														.filter((version) => !version.revoked_at)
														.map((version) => (
															<ListBox.Item key={version.id} id={version.id}>
																{version.name} / v{version.version}
																<ListBox.ItemIndicator />
															</ListBox.Item>
														))}
												</ListBox>
											</Select.Popover>
										</Select>
										{availability && (
											<fieldset className='flex flex-wrap gap-4'>
												<legend className='mb-2 text-sm'>Available in</legend>
												{(["ingress", "processing"] as const).map((stage) => (
													<Checkbox key={stage} variant='secondary' isSelected={selectedStages[stage]} isDisabled={busy || !canUse} onChange={(enabled) => setSelectedStages((previous) => ({ ...previous, [stage]: enabled }))}>
														<Checkbox.Content>
															<Checkbox.Control>
																<Checkbox.Indicator />
															</Checkbox.Control>
															<span>{stage === "ingress" ? "Ingress" : "Processing"}</span>
														</Checkbox.Content>
													</Checkbox>
												))}
											</fieldset>
										)}
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
										<TextField isRequired value={name} onChange={setName} isDisabled={busy} pattern={availability ? "[A-Za-z_][A-Za-z0-9_]*" : undefined}>
											<Label>Secret key</Label>
											<Input variant='secondary' autoComplete='off' data-1p-ignore='true' data-lpignore='true' data-bwignore='true' spellCheck={false} />
											<FieldError />
										</TextField>
										<TextField isRequired type='password' value={value} onChange={setValue} isDisabled={busy}>
											<Label>Secret value</Label>
											<Input variant='secondary' autoComplete='off' data-1p-ignore='true' data-lpignore='true' data-bwignore='true' spellCheck={false} />
											<FieldError />
										</TextField>
										{availability && (
											<fieldset className='flex flex-wrap gap-4'>
												<legend className='mb-2 text-sm'>Available in</legend>
												{(["ingress", "processing"] as const).map((stage) => (
													<Checkbox key={stage} variant='secondary' isSelected={selectedStages[stage]} isDisabled={busy || !canUse} onChange={(enabled) => setSelectedStages((previous) => ({ ...previous, [stage]: enabled }))}>
														<Checkbox.Content>
															<Checkbox.Control>
																<Checkbox.Indicator />
															</Checkbox.Control>
															<span>{stage === "ingress" ? "Ingress" : "Processing"}</span>
														</Checkbox.Content>
													</Checkbox>
												))}
											</fieldset>
										)}
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
				{availability && (
					<Modal
						isOpen={importing}
						onOpenChange={(open) => {
							if (!busy) {
								setImporting(open);
								if (!open) setEnvironmentText("");
							}
						}}
					>
						<Modal.Backdrop>
							<Modal.Container placement='auto' size='lg'>
								<Modal.Dialog className='max-h-[calc(100dvh-2rem)] overflow-y-auto'>
									<Modal.CloseTrigger />
									<Modal.Header>
										<Modal.Heading>Import environment secrets</Modal.Heading>
									</Modal.Header>
									<Modal.Body>
										<Form onSubmit={importEnvironment} autoComplete='off' className='flex flex-col gap-4'>
											<Label htmlFor='environment-secret-import'>Environment text</Label>
											<TextArea id='environment-secret-import' aria-label='Environment text' variant='secondary' value={environmentText} onChange={(event) => setEnvironmentText(event.target.value)} autoComplete='off' data-1p-ignore='true' data-lpignore='true' data-bwignore='true' spellCheck={false} className='min-h-48 font-mono' />
											<p className='text-muted text-sm'>Paste up to 32 KEY=value entries. Quoted values and comments are supported. Existing keys receive new immutable versions; stored values cannot be read back.</p>
											{availability && (
												<fieldset className='flex flex-wrap gap-4'>
													<legend className='mb-2 text-sm'>Available in</legend>
													{(["ingress", "processing"] as const).map((stage) => (
														<Checkbox key={stage} variant='secondary' isSelected={selectedStages[stage]} isDisabled={busy || !canUse} onChange={(enabled) => setSelectedStages((previous) => ({ ...previous, [stage]: enabled }))}>
															<Checkbox.Content>
																<Checkbox.Control>
																	<Checkbox.Indicator />
																</Checkbox.Control>
																<span>{stage === "ingress" ? "Ingress" : "Processing"}</span>
															</Checkbox.Content>
														</Checkbox>
													))}
												</fieldset>
											)}
											<div className='flex justify-end gap-2'>
												<Button
													variant='ghost'
													isDisabled={busy}
													onPress={() => {
														setImporting(false);
														setEnvironmentText("");
													}}
												>
													Cancel
												</Button>
												<Button type='submit' isPending={busy} isDisabled={busy || !environmentText.trim()}>
													Import secrets
												</Button>
											</div>
										</Form>
									</Modal.Body>
								</Modal.Dialog>
							</Modal.Container>
						</Modal.Backdrop>
					</Modal>
				)}
			</Card.Content>
		</Card>
	);
}
