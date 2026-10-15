"use client";

import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, FieldError } from "@heroui/react";
import { Stepper } from "@heroui-pro/react";
import { IconMail, IconShieldCheck, IconRefresh } from "@tabler/icons-react";
import { api, ApiFailure } from "@lib/api-client";

export function AuthPanel({ setup = false, initialEmail = "" }: { setup?: boolean; initialEmail?: string }) {
	const router = useRouter();

	const [email, setEmail] = useState(initialEmail);
	const [name, setName] = useState("");
	const [secret, setSecret] = useState("");
	const [otp, setOtp] = useState("");
	const [sent, setSent] = useState(false);
	const [busy, setBusy] = useState(setup);
	const [error, setError] = useState("");
	const [status, setStatus] = useState<string>("");
	const [available, setAvailable] = useState(!setup);
	const [configured, setConfigured] = useState(false);

	useFeedbackToast(error, status, { error: "Authentication error", success: "Authentication status" });

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
			});
		else {
			const response = await fetch("/api/auth/email-otp/send-verification-otp", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email, type: "sign-in" }),
			});
			if (!response.ok) throw Error("Could not request a code. Please retry.");
		}

		setSent(true);
		setOtp("");
		setStatus("If this email is eligible, a sign-in code is on its way. The code expires in five minutes.");
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
			router.push("/");
			router.refresh();
		} catch (cause) {
			setError(cause instanceof ApiFailure || cause instanceof Error ? cause.message : "Please try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className='mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12'>
			<Link href='/' className='text-accent text-sm font-semibold'>
				Payload Bay
			</Link>
			<Card className='p-6 sm:p-8'>
				<Card.Header>
					<IconShieldCheck className='text-accent size-8' aria-hidden='true' />
					<h1 className='text-2xl font-semibold'>{setup ? "Set up Payload Bay" : "Welcome back"}</h1>
					<Card.Description>{setup ? "Create the first instance owner with your installation setup secret." : "Sign in with a code sent to your email. No password required."}</Card.Description>
				</Card.Header>
				<Card.Content className='flex flex-col gap-6'>
					{setup && (
						<Stepper currentStep={sent ? 1 : 0}>
							{["Owner identity", "Verify email"].map((title) => (
								<Stepper.Step key={title}>
									<Stepper.Indicator />
									<Stepper.Content>
										<Stepper.Title>{title}</Stepper.Title>
									</Stepper.Content>
									<Stepper.Separator />
								</Stepper.Step>
							))}
						</Stepper>
					)}

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
						<Form className='flex flex-col gap-4' onSubmit={submit}>
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
							<TextField name='email' type='email' value={email} onChange={setEmail} isRequired isReadOnly={sent} maxLength={254}>
								<Label>Email address</Label>
								<Input variant='secondary' autoComplete='email' />
								<FieldError />
							</TextField>
							{sent && (
								<TextField name='otp' value={otp} onChange={setOtp} isRequired minLength={6} maxLength={6} pattern='[0-9]{6}'>
									<Label>Sign-in code</Label>
									<Input variant='secondary' autoComplete='one-time-code' inputMode='numeric' autoFocus />
									<FieldError />
								</TextField>
							)}

							<Button type='submit' isDisabled={busy}>
								{busy ? "Please wait…" : sent ? (setup ? "Create owner and continue" : "Sign in") : "Send sign-in code"}
								<IconMail aria-hidden='true' size={18} />
							</Button>
							{sent && (
								<div className='flex justify-between gap-2'>
									<Button
										size='sm'
										variant='ghost'
										isDisabled={busy}
										onPress={() => {
											setSent(false);
											setStatus("");
											setError("");
										}}
									>
										Change email
									</Button>
									<Button
										size='sm'
										variant='ghost'
										isDisabled={busy}
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
										Resend code
									</Button>
								</div>
							)}
						</Form>
					)}
				</Card.Content>
			</Card>
			<p className='text-muted text-center text-sm'>
				{setup ? "Already configured?" : "Installing your own instance?"}{" "}
				<Link className='text-accent underline' href={setup ? "/login" : "/setup"}>
					{setup ? "Sign in" : "Set up Payload Bay"}
				</Link>
			</p>
		</main>
	);
}
