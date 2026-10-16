"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Form, TextField, Input, Label, FieldError } from "@heroui/react";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { LoadingState } from "@components/loading-state";

type OnboardingStatus = {
	authenticated: boolean;
	needsOrganization: boolean;
	registrationEnabled: boolean;
	blocked: boolean;
};

export default function OnboardingPage() {
	const router = useRouter();

	const [ready, setReady] = useState(false);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Organization setup could not be completed" });

	useEffect(() => {
		let active = true;
		api<OnboardingStatus>("/onboarding")
			.then((status) => {
				if (!active) return;
				if (!status.authenticated || status.blocked || !status.registrationEnabled) router.replace("/login");
				else if (!status.needsOrganization) router.replace("/");
				else setReady(true);
			})
			.catch((cause) => {
				if (active) setError(cause instanceof Error ? cause.message : "Setup unavailable");
			});

		return () => {
			active = false;
		};
	}, [router]);

	async function create(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			const result = await api<{ organizationId: string; workspaceId: string }>("/onboarding", { method: "POST", json: { name, slug } });
			router.replace("/workspaces/" + result.workspaceId);
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Organization setup failed");
		} finally {
			setBusy(false);
		}
	}

	if (!ready && error)
		return (
			<main className='flex min-h-dvh flex-col items-center justify-center gap-4 p-4'>
				<h1 className='text-xl font-semibold'>Organization setup unavailable</h1>
				<Button onPress={() => window.location.reload()}>Retry setup</Button>
			</main>
		);
	if (!ready) return <LoadingState label='Preparing organization setup…' size='screen' />;

	return (
		<main className='flex min-h-dvh items-center justify-center p-4'>
			<Card className='w-full max-w-lg'>
				<Card.Header>
					<Card.Title>Create your organization</Card.Title>
					<Card.Description>Your organization owns its workspaces and projects. You can invite collaborators after setup.</Card.Description>
				</Card.Header>
				<Card.Content>
					<Form onSubmit={create} className='flex flex-col gap-4'>
						<TextField
							isRequired
							value={name}
							onChange={(next) => {
								setName(next);
								setSlug(
									next
										.toLowerCase()
										.replace(/[^a-z0-9]+/g, "-")
										.replace(/^-|-$/g, ""),
								);
							}}
							maxLength={100}
						>
							<Label>Organization name</Label>
							<Input variant='secondary' autoFocus />
							<FieldError />
						</TextField>
						<TextField isRequired value={slug} onChange={setSlug} pattern='[a-z0-9][a-z0-9-]*' maxLength={63}>
							<Label>URL name</Label>
							<Input variant='secondary' />
							<FieldError />
						</TextField>
						<Button type='submit' isPending={busy} isDisabled={busy}>
							Create organization and continue
						</Button>
					</Form>
				</Card.Content>
			</Card>
		</main>
	);
}
