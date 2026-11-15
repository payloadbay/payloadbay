"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppSection } from "@components/ui/app-section";
import { LoadingState } from "@components/loading-state";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button, Chip, FieldError, Form, Input, Label, TextField, Table } from "@heroui/react";
import { authClient } from "@lib/auth-client";
import { api } from "@lib/api-client";
import { oauthProviderNames, type OAuthProvider } from "@contracts/oauth";
import { IconFingerprint, IconLogin, IconTrash, IconUser } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { useFeedbackToast } from "@lib/feedback";

export default function AccountPage() {
	const { me, reload } = useDashboard();
	const router = useRouter();

	const [passkeys, setPasskeys] = useState<{ id: string; name?: string | null; createdAt?: Date | string | null }[]>([]);
	const [passkeyName, setPasskeyName] = useState("My passkey");
	const [loadingKeys, setLoadingKeys] = useState(true);
	const [keysUnavailable, setKeysUnavailable] = useState(false);
	const [name, setName] = useState(me.user.name);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [providers, setProviders] = useState<string[]>([]);
	const [accounts, setAccounts] = useState<{ id: string; providerId: string }[]>([]);
	const [loadingProviders, setLoadingProviders] = useState(true);
	const [providersUnavailable, setProvidersUnavailable] = useState(false);
	const [providerRetry, setProviderRetry] = useState(0);
	const [providerNeedsLogin, setProviderNeedsLogin] = useState(false);

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

	useEffect(() => {
		let active = true;
		Promise.all([api<{ oauthProviders?: string[] }>("/onboarding"), authClient.listAccounts()])
			.then(([status, result]) => {
				if (result.error) throw Error(result.error.message ?? "Could not load sign-in methods");
				if (active) {
					setProviders(status.oauthProviders ?? []);
					setAccounts(result.data ?? []);
					setProvidersUnavailable(false);
				}
			})
			.catch((cause) => {
				if (active) {
					setProvidersUnavailable(true);
					setError(cause.message);
				}
			})
			.finally(() => {
				if (active) setLoadingProviders(false);
			});

		return () => {
			active = false;
		};
	}, [providerRetry]);

	function retryProviders() {
		setLoadingProviders(true);
		setProviderRetry((value) => value + 1);
	}

	async function connectProvider(provider: string) {
		setBusy(true);
		setError("");
		try {
			if (providerNeedsLogin) {
				const signedOut = await authClient.signOut();
				if (signedOut.error) throw Error(signedOut.error.message ?? "Could not restart sign-in");
				router.push("/login?returnTo=/account");

				return;
			}

			const result = await authClient.linkSocial({ provider, callbackURL: new URL("/account", window.location.origin).href });
			if (result.error) {
				if (result.error.status === 401) setProviderNeedsLogin(true);
				throw Error(result.error.message ?? "Could not connect the sign-in method");
			}
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not connect the sign-in method");
		} finally {
			setBusy(false);
		}
	}

	async function disconnectProvider(id: string) {
		setBusy(true);
		setError("");
		try {
			const result = await authClient.unlinkAccount({ accountId: id });
			if (result.error) throw Error(result.error.message ?? "Could not disconnect the sign-in method");
			retryProviders();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not disconnect the sign-in method");
		} finally {
			setBusy(false);
		}
	}

	async function addPasskey() {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const result = await authClient.passkey.addPasskey({ name: passkeyName.trim() || "My passkey" });
			if (result.error) throw Error(result.error.message ?? "Passkey registration was not completed");
			setPasskeys(await loadPasskeys());
			await reload();
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

	const signInProviders = [...new Set([...providers, ...accounts.map((account) => account.providerId)])].filter((provider) => Object.hasOwn(oauthProviderNames, provider));

	return (
		<section className='flex max-w-xl flex-col gap-6'>
			<header>
				{me.passkeyEnrollmentRequired && <p className='text-warning'>Your organization requires a passkey. Add one to access its resources.</p>}
				<h1 className='text-3xl font-semibold'>Account settings</h1>
				<p className='text-muted mt-2'>Manage your profile and sign-in methods.</p>
			</header>
			<Link href='/account/api-keys' className='text-accent w-fit font-medium'>
				Manage personal API keys
			</Link>
			<AppSection icon={<IconUser size={20} />} title='Profile' description='Manage your display name and account details.'>
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
			</AppSection>

			{(loadingProviders || providersUnavailable || signInProviders.length > 0) && (
				<AppSection icon={<IconLogin size={20} />} title='Connected sign-in methods' description='Connect a provider to your account. Email codes remain available.'>
					{loadingProviders ? (
						<LoadingState label='Loading sign-in methods…' />
					) : providersUnavailable ? (
						<Button variant='secondary' className='self-start' onPress={retryProviders}>
							Retry loading sign-in methods
						</Button>
					) : (
						<Table variant='secondary'>
							<Table.ScrollContainer>
								<Table.Content aria-label='Connected sign-in methods'>
									<Table.Header>
										<Table.Column isRowHeader>Provider</Table.Column>
										<Table.Column>Status</Table.Column>
										<Table.Column aria-label='Actions' />
									</Table.Header>
									<Table.Body>
										{signInProviders.map((provider) => {
											const account = accounts.find((value) => value.providerId === provider);
											const label = oauthProviderNames[provider as OAuthProvider];

											return (
												<Table.Row key={provider} id={provider}>
													<Table.Cell>{label}</Table.Cell>
													<Table.Cell>
														{account ? (
															<Chip color='success' variant='soft' size='sm'>
																Connected
															</Chip>
														) : (
															<span className='text-muted text-sm'>Not connected</span>
														)}
													</Table.Cell>
													<Table.Cell className='text-right [&>div]:justify-end'>
														{account ? (
															<Button isIconOnly size='sm' variant='danger-soft' aria-label={"Disconnect " + label} isDisabled={busy} onPress={() => void disconnectProvider(account.id)}>
																<IconTrash size={18} />
															</Button>
														) : (
															<Button size='sm' variant='secondary' aria-label={(providerNeedsLogin ? "Sign in again to connect " : "Connect ") + label} isDisabled={busy || !providers.includes(provider)} onPress={() => void connectProvider(provider)}>
																{providerNeedsLogin ? "Sign in again" : "Connect"}
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
					)}
				</AppSection>
			)}
			<AppSection icon={<IconFingerprint size={20} />} title='Security and passkeys' description='Sign in with your device or security key. Email codes remain available for recovery.'>
				{loadingKeys ? (
					<LoadingState label='Loading passkeys…' />
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
											<Table.Cell className='text-right [&>div]:justify-end'>
												<Button isIconOnly size='sm' variant='ghost' aria-label={"Remove passkey " + (key.name || "Unnamed passkey")} isDisabled={busy || (Boolean(me.passkeyRequired) && passkeys.length <= 1)} onPress={() => void removePasskey(key.id)}>
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
			</AppSection>
		</section>
	);
}
