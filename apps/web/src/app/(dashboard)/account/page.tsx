"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { useDashboard } from "@components/dashboard-shell";
import { useFeedbackToast } from "@lib/feedback";

export default function AccountPage() {
	const { me, reload } = useDashboard();

	const [name, setName] = useState(me.user.name);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	useFeedbackToast(error, notice, { error: "Could not update account", success: "Account saved" });

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
		</section>
	);
}
