"use client";

import { use } from "react";
import Link from "next/link";
import { Table } from "@heroui/react";
import { useDashboard } from "@components/dashboard-shell";

export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
	const { workspaceId } = use(params);

	const { workspaces, projects } = useDashboard();

	const workspace = workspaces.find((item) => item.id === workspaceId);
	if (!workspace) return <p>Workspace unavailable.</p>;
	const visible = projects.filter((project) => project.workspace_id === workspaceId);

	return (
		<section className='flex flex-col gap-6'>
			<header>
				<p className='text-muted text-sm'>Workspace</p>
				<h1 className='text-3xl font-semibold'>{workspace.name}</h1>
				<p className='text-muted mt-2'>Manage projects, inherited access, shared code and project notification rules from this workspace.</p>
			</header>
			<div className='flex flex-wrap gap-2'>
				{workspace.permissions.includes("members.manage") && (
					<Link href={"/workspaces/" + workspaceId + "/members"} className='text-accent underline'>
						Workspace members
					</Link>
				)}
				{workspace.permissions.includes("code.read") && (
					<Link href={"/code/workspace/" + workspaceId} className='text-accent underline'>
						Shared code and middleware
					</Link>
				)}
			</div>
			{visible.length ? (
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label='Workspace projects'>
							<Table.Header>
								<Table.Column isRowHeader>Project</Table.Column>
								<Table.Column>Actions</Table.Column>
							</Table.Header>
							<Table.Body>
								{visible.map((project) => (
									<Table.Row key={project.id} id={project.id}>
										<Table.Cell>
											<Link href={"/projects/" + project.id} className='font-medium'>
												{project.name}
											</Link>
										</Table.Cell>
										<Table.Cell>
											<div className='flex flex-wrap gap-2'>
												<Link href={"/projects/" + project.id} className='text-accent text-sm'>
													Open project
												</Link>
												{project.permissions.includes("notifications.rules.manage") && (
													<Link href={"/projects/" + project.id + "/notifications"} className='text-accent text-sm'>
														Notification rules
													</Link>
												)}
											</div>
										</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			) : (
				<p className='text-muted'>No accessible projects in this workspace.</p>
			)}
		</section>
	);
}
