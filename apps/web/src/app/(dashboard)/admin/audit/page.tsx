"use client";

import { useEffect, useState } from "react";
import { Button, Table } from "@heroui/react";
import { IconRefresh } from "@tabler/icons-react";
import { useDashboard } from "@components/dashboard-shell";
import { LoadingState } from "@components/loading-state";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import type { AuditPage } from "@contracts/audit";

export default function AuditLogPage() {
	const { me } = useDashboard();

	const authorized = me.permissions.includes("audit.read");

	const [revision, setRevision] = useState(0);
	const [cursor, setCursor] = useState("");
	const [requestRevision, setRequestRevision] = useState(0);
	const [result, setResult] = useState<{ revision: number; data: AuditPage } | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");

	const data = authorized && result?.revision === revision ? result.data : null;

	useFeedbackToast(error, "", { error: "Audit log could not be loaded" });

	useEffect(() => {
		if (!authorized) return;
		let active = true;
		api<AuditPage>("/audit?limit=50" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""))
			.then((page) => {
				if (active) setResult((previous) => ({ revision, data: { ...page, items: cursor && previous?.revision === revision ? [...previous.data.items, ...page.items] : page.items } }));
			})
			.catch((cause) => {
				if (active) setError(cause instanceof Error ? cause.message : "Audit log is unavailable");
			})
			.finally(() => {
				if (active) setPending(false);
			});

		return () => {
			active = false;
		};
	}, [authorized, revision, cursor, requestRevision]);

	function refresh() {
		setError("");
		setCursor("");
		setPending(true);
		setRevision((value) => value + 1);
	}

	if (!authorized)
		return (
			<section>
				<h1 className='text-2xl font-semibold'>Audit access is restricted</h1>
				<p className='text-muted mt-2'>Instance-level audit access is required.</p>
			</section>
		);

	return (
		<section className='flex min-w-0 flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-3xl font-semibold'>Audit log</h1>
					<p className='text-muted mt-2'>Actions across this instance, newest first. Stored diffs and secret values are excluded.</p>
				</div>
				<Button variant='secondary' onPress={refresh} isDisabled={pending}>
					<IconRefresh aria-hidden='true' size={18} />
					Refresh
				</Button>
			</header>
			{!data ? (
				error ? (
					<div>
						<p>Audit history is unavailable.</p>
						<Button className='mt-3' variant='secondary' onPress={refresh}>
							Retry
						</Button>
					</div>
				) : (
					<LoadingState label='Loading audit log' />
				)
			) : (
				<>
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Audit log' className='w-full min-w-160'>
								<Table.Header>
									<Table.Column isRowHeader>Action</Table.Column>
									<Table.Column>Actor</Table.Column>
									<Table.Column>Scope</Table.Column>
									<Table.Column>Resource</Table.Column>
									<Table.Column>Time</Table.Column>
								</Table.Header>
								<Table.Body renderEmptyState={() => "No audit actions have been recorded."}>
									{data.items.map((item) => (
										<Table.Row id={item.id} key={item.id}>
											<Table.Cell>{item.operation}</Table.Cell>
											<Table.Cell>
												<span className='font-mono text-xs'>{item.actor}</span>
											</Table.Cell>
											<Table.Cell>
												{item.scope.type}
												<span className='text-muted block font-mono text-xs'>{item.scope.id}</span>
											</Table.Cell>
											<Table.Cell>
												<span className='font-mono text-xs'>{item.resourceId ?? "—"}</span>
											</Table.Cell>
											<Table.Cell>{new Date(item.createdAt).toLocaleString()}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
					{data.nextCursor && (
						<Button
							className='self-center'
							variant='secondary'
							isPending={pending}
							onPress={() => {
								setError("");
								setPending(true);
								setCursor(data.nextCursor!);
								setRequestRevision((value) => value + 1);
							}}
						>
							Load more
						</Button>
					)}
				</>
			)}
		</section>
	);
}
