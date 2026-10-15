"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Card, FieldError, Form, Input, Label, TextField, Table } from "@heroui/react";
import { authClient } from "@lib/auth-client";
import { IconFingerprint, IconTrash } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { useFeedbackToast } from "@lib/feedback";

export default function AccountPage() {
	const { me, reload } = useDashboard();

	const [passkeys, setPasskeys] = useState<{ id: string; name?: string | null; createdAt?: Date | string | null }[]>([]);
	const [passkeyName, setPasskeyName] = useState("My passkey");
	const [loadingKeys, setLoadingKeys] = useState(true);
	const [keysUnavailable, setKeysUnavailable] = useState(false);
	const [name, setName] = useState(me.user.name);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	useFeedbackToast(error, notice, { error: "Could not update account", success: "Account saved" });

	const loadPasskeys = useCallback(async () => {
		const result = await authClient.passkey.listUserPasskeys();
		if (result.error) throw Error(result.error.message ?? "Could not load passkeys");

		return result.data ?? [];
	}, []);

	useEffect(() => {
		let active = true;
		loadPasskeys()
			.then((keys) => {
				if (active) setPasskeys(keys);
			})
			.catch((cause) => {
				if (active) {
					setKeysUnavailable(true);
					setError(cause.message);
				}
			})
			.finally(() => {
				if (active) setLoadingKeys(false);
			});

		return () => {
			active = false;
		};
	}, [loadPasskeys]);

	async function addPasskey() {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const result = await authClient.passkey.addPasskey({ name: passkeyName.trim() || "My passkey" });
			if (result.error) throw Error(result.error.message ?? "Passkey registration was not completed");
			setPasskeys(await loadPasskeys());
			setNotice("Your passkey is ready for sign-in.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not register passkey");
		} finally {
			setBusy(false);
		}
	}

	async function removePasskey(id: string) {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const result = await authClient.passkey.deletePasskey({ id });
			if (result.error) throw Error(result.error.message ?? "Could not remove passkey");
			setPasskeys(await loadPasskeys());
			setNotice("Passkey removed. Email-code sign-in remains available.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not remove passkey");
		} finally {
			setBusy(false);
		}
	}

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const result = await fetch("/api/auth/update-user", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
			if (!result.ok) throw Error("Your name could not be saved. Please retry.");
			await reload();
			setNotice("Your display name has been updated.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not update account");
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className='flex max-w-xl flex-col gap-6'>
			<header>
				<h1 className='text-3xl font-semibold'>Account settings</h1>
				<p className='text-muted mt-2'>Manage how your name appears in this instance.</p>
			</header>
			<Card>
				<Card.Content>
					<Form onSubmit={save} className='flex flex-col gap-5'>
						<TextField name='name' value={name} onChange={setName} isRequired maxLength={100} isDisabled={busy}>
							<Label>Display name</Label>
							<Input variant='secondary' autoComplete='name' />
							<FieldError />
						</TextField>
						<TextField name='email' type='email' value={me.user.email} isReadOnly>
							<Label>Email address</Label>
							<Input variant='secondary' autoComplete='email' />
						</TextField>
						<p className='text-muted text-sm'>Sign in with a one-time email code. Email changes are not available.</p>
						<Button type='submit' className='self-start' isPending={busy} isDisabled={busy || !name.trim() || name.trim() === me.user.name}>
							Save changes
						</Button>
					</Form>
				</Card.Content>
			</Card>
			<Card>
				<Card.Header>
					<h2 className='flex items-center gap-2 text-xl font-semibold'>
						<IconFingerprint size={20} />
						Security and passkeys
					</h2>
					<Card.Description>Sign in with your device or security key. Email codes remain available for recovery.</Card.Description>
				</Card.Header>
				<Card.Content className='flex flex-col gap-4'>
					{loadingKeys ? (
						<p role='status'>Loading passkeys…</p>
					) : keysUnavailable ? (
						<div>
							<p className='text-muted text-sm'>Passkeys could not be loaded.</p>
							<Button
								variant='secondary'
								onPress={() => {
									setLoadingKeys(true);
									loadPasskeys()
										.then(
											(keys) => {
												setPasskeys(keys);
												setKeysUnavailable(false);
											},
											(cause) => setError(cause.message),
										)
										.finally(() => setLoadingKeys(false));
								}}
							>
								Retry loading passkeys
							</Button>
						</div>
					) : passkeys.length ? (
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Your passkeys'>
									<Table.Header>
										<Table.Column isRowHeader>Passkey</Table.Column>
										<Table.Column aria-label='Actions' />
									</Table.Header>
									<Table.Body>
										{passkeys.map((key) => (
											<Table.Row key={key.id} id={key.id}>
												<Table.Cell>
													{key.name || "Unnamed passkey"}
													<p className='text-muted text-xs'>{key.createdAt ? new Date(key.createdAt).toLocaleDateString() : ""}</p>
												</Table.Cell>
												<Table.Cell>
													<Button isIconOnly size='sm' variant='ghost' aria-label={"Remove passkey " + (key.name || "Unnamed passkey")} isDisabled={busy} onPress={() => void removePasskey(key.id)}>
														<IconTrash size={18} />
													</Button>
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					) : (
						<p className='text-muted text-sm'>No passkeys registered yet.</p>
					)}
					<TextField value={passkeyName} onChange={setPasskeyName} maxLength={100}>
						<Label>Passkey name</Label>
						<Input variant='secondary' />
					</TextField>
					<Button className='self-center sm:self-start' variant='secondary' onPress={() => void addPasskey()} isDisabled={busy || loadingKeys}>
						<IconFingerprint size={18} />
						Add passkey
					</Button>
				</Card.Content>
			</Card>
		</section>
	);
}
