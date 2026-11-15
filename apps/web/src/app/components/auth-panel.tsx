"use client";

import { LOGIN_CODE_COOLDOWN_SECONDS } from "@contracts/auth";
import { oauthProviderNames, type OAuthProvider } from "@contracts/oauth";
import { authClient } from "@lib/auth-client";
import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, InputOTP, REGEXP_ONLY_DIGITS, Spinner, FieldError } from "@heroui/react";
import { SetupSteps } from "@components/ui/setup-steps";
import { IconMail, IconRefresh, IconFingerprint } from "@tabler/icons-react";
import { api, ApiFailure } from "@lib/api-client";

type AuthPanelProps = {
	setup?: boolean;
	preview?: boolean;
	loginHint?: string;
	initialEmail?: string;
	returnTo?: string;
};

const loginCooldowns = new Map<string, number>();

function remainingLoginCooldown(key: string) {
	let until = loginCooldowns.get(key) ?? 0;
	try {
		until = Math.max(until, Number(sessionStorage.getItem(key)) || 0);
	} catch {
		// Browser storage can be unavailable in a restricted browsing context.
	}

	return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function subscribeLoginCooldown(onChange: () => void) {
	const timer = setInterval(onChange, 1000);
	window.addEventListener("storage", onChange);
	window.addEventListener("payloadbay:login-code-cooldown", onChange);

	return () => {
		clearInterval(timer);
		window.removeEventListener("storage", onChange);
		window.removeEventListener("payloadbay:login-code-cooldown", onChange);
	};
}

export function AuthPanel({ setup = false, preview = false, loginHint, initialEmail, returnTo = "/" }: AuthPanelProps) {
	const router = useRouter();

	const [email, setEmail] = useState(initialEmail ?? "");
	const [name, setName] = useState("");
	const [secret, setSecret] = useState("");
	const [otp, setOtp] = useState("");
	const [sent, setSent] = useState(false);
	const [busy, setBusy] = useState(setup);
	const [error, setError] = useState("");
	const [available, setAvailable] = useState(!setup);
	const [configured, setConfigured] = useState(false);
	const [oauthProviders, setOauthProviders] = useState<string[]>([]);
	const [registrationEnabled, setRegistrationEnabled] = useState(false);

	const cooldownKey = "payloadbay:login-code-cooldown:" + email.trim().toLowerCase();

	const cooldownSeconds = useSyncExternalStore(
		subscribeLoginCooldown,
		() => remainingLoginCooldown(cooldownKey),
		() => 0,
	);

	function startCooldown(seconds: number) {
		const until = Date.now() + seconds * 1000;
		loginCooldowns.set(cooldownKey, until);
		try {
			sessionStorage.setItem(cooldownKey, String(until));
		} catch {
			// The in-memory countdown still works; the server enforces the limit.
		}

		window.dispatchEvent(new Event("payloadbay:login-code-cooldown"));
	}

	useFeedbackToast(error, "", { error: setup ? "Setup unavailable" : "Could not sign in" });

	useEffect(() => {
		if (setup) return;
		let active = true;
		api<{ registrationEnabled: boolean; oauthProviders?: string[] }>("/onboarding")
			.then((status) => {
				if (active) {
					setRegistrationEnabled(status.registrationEnabled);
					setOauthProviders(status.oauthProviders ?? []);
				}
			})
			.catch(() => {});

		return () => {
			active = false;
		};
	}, [setup]);

	async function check() {
		try {
			const result = await api<{ configured: boolean }>("/bootstrap");
			setConfigured(result.configured);
			setAvailable(true);
		} catch {
			setAvailable(false);
			setError("Setup service unavailable. Check the database and SMTP configuration, then retry.");
		} finally {
			setBusy(false);
		}
	}

	useEffect(() => {
		if (!setup) return;
		let active = true;
		api<{ configured: boolean }>("/bootstrap")
			.then(
				(result) => {
					if (active) {
						setConfigured(result.configured);
						setAvailable(true);
					}
				},
				() => {
					if (active) {
						setAvailable(false);
						setError("Setup service unavailable. Check the database and SMTP configuration, then retry.");
					}
				},
			)
			.finally(() => {
				if (active) setBusy(false);
			});

		return () => {
			active = false;
		};
	}, [setup]);

	async function requestCode() {
		if (setup)
			await api("/bootstrap", {
				method: "POST",
				json: {
					action: "request-code",
					secret,
					email,
					name,
				},
			}).catch((cause) => {
				if (cause instanceof ApiFailure && cause.status === 429) startCooldown(LOGIN_CODE_COOLDOWN_SECONDS);
				throw cause;
			});
		else {
			const response = await fetch("/api/auth/email-otp/send-verification-otp", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email, type: "sign-in" }),
			});
			if (response.status === 429) {
				const seconds = Number(response.headers.get("Retry-After"));
				startCooldown(Number.isFinite(seconds) && seconds > 0 ? seconds : LOGIN_CODE_COOLDOWN_SECONDS);
				throw Error("Please wait before requesting another sign-in code.");
			}

			if (!response.ok) throw Error("Could not request a code. Please retry.");
		}

		startCooldown(LOGIN_CODE_COOLDOWN_SECONDS);
		setSent(true);
		setOtp("");
	}

	async function signInWithPasskey() {
		setBusy(true);
		setError("");
		try {
			const result = await authClient.signIn.passkey();
			if (result.error) throw Error(result.error.message ?? "Passkey sign-in was not completed");
			router.push(returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\") ? returnTo : "/");
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not sign in with a passkey");
		} finally {
			setBusy(false);
		}
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			if (!sent) {
				await requestCode();

				return;
			}

			const signed = await fetch("/api/auth/sign-in/email-otp", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email, otp }),
			});
			if (!signed.ok) throw Error("Code is invalid or expired. Request a new code and try again.");
			if (setup) await api("/bootstrap", { method: "POST", json: { action: "complete", secret } });
			setSecret("");
			setOtp("");
			router.push(returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\") ? returnTo : "/");
			router.refresh();
		} catch (cause) {
			setError(cause instanceof ApiFailure || cause instanceof Error ? cause.message : "Please try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className='mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10 sm:py-16'>
			<Card className='w-full gap-6 p-6 sm:p-8'>
				<Link href='/' className='mx-auto block' aria-label='Payload Bay home'>
					<Image src='/brand/payloadbay-logo-dark-transparent-padded.svg' alt='Payload Bay' width={240} height={53} priority />
				</Link>
				<Card.Header className='items-center gap-2 text-center'>
					<h1 className='text-2xl font-semibold'>{sent ? "Check your email" : setup ? "Set up Payload Bay" : registrationEnabled ? "Welcome to Payload Bay" : "Welcome back"}</h1>
					<Card.Description>
						{sent ? (
							<>
								Enter the six-digit code sent to
								<strong className='text-foreground mt-1 block font-medium [overflow-wrap:anywhere]'>{email}</strong>
								<span className='mt-1 block'>The code expires in five minutes.</span>
							</>
						) : setup ? (
							"Create the first instance owner with your installation setup secret."
						) : registrationEnabled ? (
							"Sign in or create your organization with a code sent to your email. No password required."
						) : (
							"Sign in with a code sent to your email. No password required."
						)}
					</Card.Description>
				</Card.Header>
				<Card.Content className='flex flex-col gap-6'>
					{setup && <SetupSteps currentStep={sent ? 1 : 0} items={["Owner identity", "Verify email"]} />}

					{configured ? (
						<p>
							This instance is already set up.{" "}
							<Link href='/login' className='text-accent underline'>
								Sign in
							</Link>{" "}
							to continue.
						</p>
					) : !available ? (
						<Button
							isDisabled={busy}
							variant='secondary'
							onPress={() => {
								setBusy(true);
								setError("");
								void check();
							}}
						>
							<IconRefresh aria-hidden='true' size={18} />
							Retry setup check
						</Button>
					) : (
						<Form className='flex w-full flex-col items-stretch gap-5' onSubmit={submit}>
							{setup && !sent && (
								<>
									<TextField name='name' value={name} onChange={setName} isRequired maxLength={100}>
										<Label>Your name</Label>
										<Input variant='secondary' autoComplete='name' />
										<FieldError />
									</TextField>
									<TextField name='setup-secret' type='password' value={secret} onChange={setSecret} isRequired maxLength={512}>
										<Label>Setup secret</Label>
										<Input variant='secondary' autoComplete='off' />
										<FieldError />
									</TextField>
								</>
							)}
							{!setup && !sent && loginHint?.trim() && (
								<Card variant='transparent' role='note' aria-label='Sign-in information' className='border-warning/30 bg-warning-soft border shadow-none'>
									<Card.Content className='text-warning-soft-foreground text-sm whitespace-pre-line wrap-anywhere'>{loginHint.trim()}</Card.Content>
								</Card>
							)}
							{!sent && (
								<TextField name='email' type='email' value={email} onChange={setEmail} isRequired maxLength={254}>
									<Label>Email address</Label>
									<Input variant='secondary' autoComplete='email' />
									<FieldError />
								</TextField>
							)}
							{sent && (
								<div className='flex flex-col gap-2'>
									<Label htmlFor='sign-in-code'>Sign-in code</Label>
									<InputOTP id='sign-in-code' name='otp' aria-label='Sign-in code' value={otp} onChange={setOtp} maxLength={6} pasteTransformer={(text) => text.replace(/\D/g, "")} pattern={REGEXP_ONLY_DIGITS} variant='secondary' autoComplete='one-time-code' autoFocus isDisabled={busy} className='mx-auto w-fit justify-center'>
										<InputOTP.Group>
											<InputOTP.Slot index={0} />
											<InputOTP.Slot index={1} />
											<InputOTP.Slot index={2} />
										</InputOTP.Group>
										<InputOTP.Separator />
										<InputOTP.Group>
											<InputOTP.Slot index={3} />
											<InputOTP.Slot index={4} />
											<InputOTP.Slot index={5} />
										</InputOTP.Group>
									</InputOTP>
								</div>
							)}

							<Button type='submit' fullWidth className='w-full justify-center' isDisabled={busy || (sent ? otp.length !== 6 : cooldownSeconds > 0)} isPending={busy}>
								{busy ? "Please wait…" : sent ? (setup ? "Create owner and continue" : "Sign in") : cooldownSeconds > 0 ? `Send code in ${cooldownSeconds}s` : "Send sign-in code"}
								{busy ? <Spinner size='sm' color='current' /> : !sent && <IconMail aria-hidden='true' size={18} />}
							</Button>
							{!setup && !sent && (
								<>
									{oauthProviders.map((provider) => (
										<Button
											key={provider}
											variant='secondary'
											className='w-full'
											isDisabled={busy}
											onPress={async () => {
												setBusy(true);
												setError("");
												try {
													const result = await authClient.signIn.social({ provider, callbackURL: new URL(returnTo, window.location.origin).href });
													if (result.error) throw Error("Could not start provider sign-in");
												} catch (cause) {
													setError(cause instanceof Error ? cause.message : "Could not start sign-in");
													setBusy(false);
												}
											}}
										>
											Continue with {oauthProviderNames[provider as OAuthProvider] ?? provider}
										</Button>
									))}
									<Button variant='secondary' fullWidth onPress={() => void signInWithPasskey()} isDisabled={busy}>
										<IconFingerprint size={18} />
										Sign in with a passkey
									</Button>
								</>
							)}
							{sent && (
								<div className='grid w-full grid-cols-2 gap-3'>
									<Button
										size='sm'
										variant='ghost'
										isDisabled={busy}
										onPress={() => {
											setSent(false);
											setOtp("");
											setError("");
										}}
									>
										Change email
									</Button>
									<Button
										size='sm'
										variant='ghost'
										isDisabled={busy || cooldownSeconds > 0}
										onPress={async () => {
											setBusy(true);
											setError("");
											try {
												await requestCode();
											} catch (cause) {
												setError(cause instanceof Error ? cause.message : "Could not resend code");
											} finally {
												setBusy(false);
											}
										}}
									>
										{cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : "Resend code"}
									</Button>
								</div>
							)}
						</Form>
					)}
				</Card.Content>
			</Card>
			{!preview && (
				<p className='text-muted text-center text-sm'>
					{setup ? "Already configured?" : "Installing your own instance?"}{" "}
					<Link className='text-accent underline' href={setup ? "/login" : "/setup"}>
						{setup ? "Sign in" : "Set up Payload Bay"}
					</Link>
				</p>
			)}
		</main>
	);
}
