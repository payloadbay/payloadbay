"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, FieldError } from "@heroui/react";
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
		setNotice("Binding changed locally. Save and publish to activate it.");
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
				{Object.keys(bindings).length > 0 && (
					<ul className='flex flex-col gap-2'>
						{Object.entries(bindings).map(([key, id]) => {
							const secret = versions.find((version) => version.id === id);

							return (
								<li key={key} className='flex items-center justify-between gap-3 text-sm'>
									<span>
										<code>{key}</code> → {secret ? `${secret.name} · v${secret.version}${secret.revoked_at ? " · Revoked" : ""}` : id}
									</span>
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
								</li>
							);
						})}
					</ul>
				)}
				{canUse && (
					<Form onSubmit={bind} className='flex flex-wrap items-end gap-3'>
						<TextField isRequired value={binding} onChange={setBinding} isDisabled={disabled || busy} pattern='[A-Za-z_][A-Za-z0-9_]*'>
							<Label>Binding name</Label>
							<Input variant='secondary' />
							<FieldError />
						</TextField>
						<label className='flex min-w-56 flex-col gap-2 text-sm'>
							Secret version
							<select aria-label='Secret version' className='border-border bg-field rounded-lg border p-2' value={selected} onChange={(event) => setSelected(event.target.value)} disabled={disabled || busy} required>
								<option value=''>Choose a version</option>
								{versions
									.filter((version) => !version.revoked_at)
									.map((version) => (
										<option key={version.id} value={version.id}>
											{version.name} · v{version.version}
										</option>
									))}
							</select>
						</label>
						<Button type='submit' variant='secondary' isDisabled={disabled || busy || !selected}>
							Bind secret version
						</Button>
					</Form>
				)}
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
