"use client";

import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, TextField, Label, Input, InputOTP, REGEXP_ONLY_DIGITS, Spinner, FieldError } from "@heroui/react";
import { Stepper } from "@heroui-pro/react";
import { IconMail, IconRefresh } from "@tabler/icons-react";
import { api, ApiFailure } from "@lib/api-client";

export function AuthPanel({ setup = false, preview = false }: { setup?: boolean; preview?: boolean }) {
	const router = useRouter();

	const [email, setEmail] = useState(preview && !setup ? "reviewer@preview.payloadbay.test" : "");
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
		<main className='mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10 sm:py-16'>
			<Link href='/' className='mx-auto block' aria-label='Payload Bay home'>
				<Image src='/brand/payloadbay-logo-dark-rounded.svg' alt='Payload Bay' width={240} height={53} priority />
			</Link>
			<Card className='w-full gap-6 p-6 sm:p-8'>
				<Card.Header className='items-center gap-2 text-center'>
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
							<TextField name='email' type='email' value={email} onChange={setEmail} isRequired isReadOnly={sent} maxLength={254}>
								<Label>Email address</Label>
								<Input variant='secondary' autoComplete='email' />
								<FieldError />
							</TextField>
							{sent && (
								<div className='flex flex-col gap-2'>
									<Label htmlFor='sign-in-code'>Sign-in code</Label>
									<InputOTP id='sign-in-code' name='otp' aria-label='Sign-in code' value={otp} onChange={setOtp} maxLength={6} pattern={REGEXP_ONLY_DIGITS} variant='secondary' autoComplete='one-time-code' autoFocus isDisabled={busy} className='justify-center'>
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

							<Button type='submit' fullWidth className='justify-center' isDisabled={busy || (sent && otp.length !== 6)} isPending={busy}>
								{busy ? "Please wait…" : sent ? (setup ? "Create owner and continue" : "Sign in") : "Send sign-in code"}
								{busy ? <Spinner size='sm' color='current' /> : !sent && <IconMail aria-hidden='true' size={18} />}
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
