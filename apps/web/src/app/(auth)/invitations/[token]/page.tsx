"use client";

import { LoadingState } from "@components/loading-state";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@heroui/react";
import { AuthPanel } from "@components/auth-panel";
import { api, ApiFailure } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import type { MeProfile } from "@types";

type Invitation = { email: string; expiresAt: string; grants: { scope: { type: string; id: string }; role: string }[] };

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
	const { token } = use(params);

	const router = useRouter();

	const [invitation, setInvitation] = useState<Invitation | null>(null);
	const [me, setMe] = useState<MeProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [unavailable, setUnavailable] = useState(false);
	const [busy, setBusy] = useState(false);

	useFeedbackToast(error, "", { error: "Invitation error" });

	useEffect(() => {
		let active = true;
		Promise.all([
			api<Invitation>("/invitations/token/" + encodeURIComponent(token)),
			api<MeProfile>("/me").catch((cause) => {
				if (cause instanceof ApiFailure && cause.status === 401) return null;
				throw cause;
			}),
		])
			.then(
				([details, profile]) => {
					if (active) {
						setInvitation(details);
						setMe(profile);
					}
				},
				(cause) => {
					if (active) {
						setUnavailable(true);
						setError(cause instanceof Error ? cause.message : "Invitation unavailable");
					}
				},
			)
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [token]);

	async function accept() {
		setBusy(true);
		setError("");
		try {
			await api("/invitations/accept", { method: "POST", json: { token } });
			const project = invitation?.grants.find((grant) => grant.scope.type === "project");
			router.replace(project ? "/projects/" + project.scope.id : "/");
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not accept invitation");
		} finally {
			setBusy(false);
		}
	}

	if (loading) return <LoadingState label='Loading invitation…' size='screen' />;
	if (unavailable || !invitation)
		return (
			<main className='mx-auto max-w-md p-8'>
				<h1 className='text-2xl font-semibold'>Invitation unavailable</h1>
				<p className='text-muted my-4'>It may have expired, been cancelled or already been accepted. Ask the sender for a new invitation.</p>
				<Link href='/login' className='text-accent'>
					Go to sign in
				</Link>
			</main>
		);
	if (!me) return <AuthPanel initialEmail={invitation.email} returnTo={"/invitations/" + token} />;

	return (
		<main className='mx-auto w-full max-w-md px-5 py-10'>
			<Card>
				<Card.Header>
					<h1 className='text-2xl font-semibold'>Join Payload Bay</h1>
					<Card.Description>Invitation for {invitation.email}. Access is added only after you accept.</Card.Description>
				</Card.Header>
				<Card.Content>
					<ul className='flex flex-col gap-2'>
						{invitation.grants.map((grant) => (
							<li key={grant.scope.id} className='capitalize'>
								{grant.role} · {grant.scope.type} access
							</li>
						))}
					</ul>
					{me.user.email.toLowerCase() !== invitation.email.toLowerCase() && <p className='text-muted mt-4'>You are signed in as {me.user.email}. Sign out and use the invited email address.</p>}
				</Card.Content>
				<Card.Footer>
					<Button isDisabled={busy || me.user.email.toLowerCase() !== invitation.email.toLowerCase()} onPress={() => void accept()}>
						{busy ? "Joining…" : "Accept invitation"}
					</Button>
					<Button
						variant='ghost'
						onPress={async () => {
							await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
							setMe(null);
						}}
					>
						Use another account
					</Button>
				</Card.Footer>
			</Card>
		</main>
	);
}
