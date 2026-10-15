"use client";

import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { Avatar, Button, Dropdown, Header, Label } from "@heroui/react";
import { AppLayout, Sidebar } from "@heroui-pro/react";
import { IconHome, IconFolder, IconUsers, IconLogout, IconCode, IconSettings, IconInbox, IconBell, IconArrowLeft, IconKey, IconFlask, IconHistory, IconRoute } from "@tabler/icons-react";
import { NotificationInbox } from "@components/notification-inbox";
import { api, ApiFailure } from "@lib/api-client";
import type { MeProfile, WorkspaceSummary, ProjectSummary } from "@types";

type DashboardState = {
	me: MeProfile;
	workspaces: WorkspaceSummary[];
	projects: ProjectSummary[];
	reload: () => Promise<void>;
};

const Context = createContext<DashboardState | null>(null);

export function useDashboard() {
	const state = useContext(Context);

	if (!state) throw Error("Dashboard context is unavailable");

	return state;
}

export function DashboardShell({ children }: { children: ReactNode }) {
	const router = useRouter();

	const pathname = usePathname();
	const search = useSearchParams();

	const [data, setData] = useState<Omit<DashboardState, "reload"> | null>(null);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Dashboard error", success: "Success" });

	const fetchData = useCallback(async () => {
		const [me, workspaces, projects] = await Promise.all([api<MeProfile>("/me"), api<WorkspaceSummary[]>("/workspaces"), api<ProjectSummary[]>("/projects")]);

		return { me, workspaces, projects };
	}, []);

	const receive = useCallback((next: Omit<DashboardState, "reload">) => {
		setData(next);
		setError("");
	}, []);

	const failed = useCallback(
		(cause: unknown) => {
			if (cause instanceof ApiFailure && cause.status === 401) {
				setData(null);
				router.replace("/login");
			} else setError(cause instanceof Error ? cause.message : "Dashboard unavailable");
		},
		[router],
	);

	const load = useCallback(async () => {
		try {
			receive(await fetchData());
		} catch (cause) {
			failed(cause);
		}
	}, [fetchData, receive, failed]);

	useEffect(() => {
		let active = true;
		fetchData().then(
			(next) => {
				if (active) receive(next);
			},
			(cause) => {
				if (active) failed(cause);
			},
		);

		return () => {
			active = false;
		};
	}, [fetchData, receive, failed, pathname]);

	if (!data)
		return (
			<main className='mx-auto max-w-lg p-8'>
				<p role='status'>{error ? "Could not load your dashboard." : "Loading your dashboard…"}</p>
				{error && (
					<>
						<Button onPress={() => void load()}>Retry</Button>
					</>
				)}
			</main>
		);
	const admin = data.me.permissions.includes("members.manage");
	const initials =
		data.me.user.name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0])
			.join("")
			.toUpperCase() || "?";

	async function signOut() {
		try {
			const result = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
			if (!result.ok) throw Error("Could not sign out. Please retry.");
			router.replace("/login");
			router.refresh();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not sign out. Please retry.");
		}
	}

	const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? pathname.match(/^\/code\/project\/([^/]+)/)?.[1] ?? (pathname.startsWith("/code/endpoint/") ? search.get("projectId") : undefined);
	const project = data.projects.find((item) => item.id === projectId);
	const workspaceId = pathname.match(/^\/workspaces\/([^/]+)/)?.[1] ?? pathname.match(/^\/code\/workspace\/([^/]+)/)?.[1] ?? project?.workspace_id;
	const workspace = data.workspaces.find((item) => item.id === workspaceId);
	const workspaceContext = !project && Boolean(workspace);
	const projectLinks = project
		? [
				{
					id: "project-overview",
					label: "Routes and destinations",
					href: "/projects/" + project.id,
					icon: IconFolder,
					visible: true,
				},
				{
					id: "project-events",
					label: "Events",
					href: "/projects/" + project.id + "/events",
					icon: IconInbox,
					visible: project.permissions.includes("metadata.read"),
				},
				{
					id: "project-code",
					label: "Code and middleware",
					href: "/code/project/" + project.id,
					icon: IconCode,
					visible: project.permissions.includes("code.read"),
				},
				{
					id: "project-notifications",
					label: "Notification rules",
					href: "/projects/" + project.id + "/notifications",
					icon: IconBell,
					visible: project.permissions.includes("notifications.rules.manage"),
				},
				{
					id: "project-members",
					label: "Project members",
					href: "/projects/" + project.id + "/members",
					icon: IconUsers,
					visible: project.permissions.includes("members.manage"),
				},
			]
		: [];

	const routeId = pathname.match(/^\/projects\/[^/]+\/routes\/([^/]+)/)?.[1] ?? pathname.match(/^\/code\/endpoint\/([^/]+)/)?.[1];
	const routeSection = pathname.startsWith("/code/endpoint/") ? "middleware" : (search.get("section") ?? "code");
	const routeAddress = routeId && project ? "/projects/" + project.id + "/routes/" + routeId : "";
	const routeLinks =
		routeId && project
			? [
					{
						id: "overview",
						label: "Playground",
						icon: IconRoute,
						visible: true,
					},
					{
						id: "code",
						label: "Scripts",
						icon: IconCode,
						visible: project.permissions.includes("code.read"),
					},
					{
						id: "helpers",
						label: "Helper imports",
						icon: IconCode,
						visible: project.permissions.includes("code.read"),
					},
					{
						id: "secrets",
						label: "Secrets",
						icon: IconKey,
						visible: project.permissions.includes("secrets.use") || project.permissions.includes("secrets.manage"),
					},
					{
						id: "test",
						label: "Script test",
						icon: IconFlask,
						visible: project.permissions.includes("code.test"),
					},
					{
						id: "events",
						label: "Route events",
						icon: IconInbox,
						visible: true,
					},
					{
						id: "history",
						label: "Publications",
						icon: IconHistory,
						visible: project.permissions.includes("code.read"),
					},
				]
			: [];
	const navigationContent = (
		<>
			<Sidebar.Header>
				<Link href='/' className='text-accent px-3 py-4 text-lg font-semibold'>
					Payload Bay
				</Link>
			</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Group>
					{project && <Sidebar.GroupLabel>{routeId ? "Ingress route" : project.name}</Sidebar.GroupLabel>}
					<Sidebar.Menu aria-label='Dashboard navigation'>
						<Sidebar.MenuItem id='overview' href='/' isCurrent={pathname === "/"} textValue={project ? "All projects" : "Overview"}>
							<Sidebar.MenuIcon>
								<IconHome size={18} />
							</Sidebar.MenuIcon>
							<Sidebar.MenuLabel>{project ? "All projects" : "Overview"}</Sidebar.MenuLabel>
						</Sidebar.MenuItem>
						{!project &&
							!workspaceContext &&
							data.projects.map((project) => (
								<Sidebar.MenuItem id={project.id} key={project.id} href={"/projects/" + project.id} textValue={project.name} isCurrent={pathname.startsWith("/projects/" + project.id)}>
									<Sidebar.MenuIcon>
										<IconFolder size={18} />
									</Sidebar.MenuIcon>
									<Sidebar.MenuLabel>{project.name}</Sidebar.MenuLabel>
								</Sidebar.MenuItem>
							))}
						{workspace && !routeId && (
							<Sidebar.MenuItem id='workspace-overview' href={"/workspaces/" + workspace.id} textValue='Workspace settings' isCurrent={pathname === "/workspaces/" + workspace.id}>
								<Sidebar.MenuIcon>
									<IconSettings size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>{workspace.name}</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}
						{workspaceContext && workspace?.permissions.includes("notifications.rules.manage") && (
							<Sidebar.MenuItem id='workspace-notifications' href={"/workspaces/" + workspace.id + "/notifications"} textValue='Workspace notification rules' isCurrent={pathname.endsWith("/notifications")}>
								<Sidebar.MenuIcon>
									<IconBell size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>Notification rules</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}
						{workspaceContext && workspace?.permissions.includes("members.manage") && (
							<Sidebar.MenuItem id='workspace-members' href={"/workspaces/" + workspace.id + "/members"} textValue='Workspace members' isCurrent={pathname.endsWith("/members")}>
								<Sidebar.MenuIcon>
									<IconUsers size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>Workspace members</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}
						{workspaceContext && workspace?.permissions.includes("code.read") && (
							<Sidebar.MenuItem id='workspace-code' href={"/code/workspace/" + workspace.id} textValue='Workspace code and middleware' isCurrent={pathname.startsWith("/code/workspace/")}>
								<Sidebar.MenuIcon>
									<IconCode size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>Code and middleware</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}
						{workspaceContext &&
							data.projects
								.filter((item) => item.workspace_id === workspace?.id)
								.map((item) => (
									<Sidebar.MenuItem key={item.id} id={item.id} href={"/projects/" + item.id} textValue={item.name}>
										<Sidebar.MenuIcon>
											<IconFolder size={18} />
										</Sidebar.MenuIcon>
										<Sidebar.MenuLabel>{item.name}</Sidebar.MenuLabel>
									</Sidebar.MenuItem>
								))}

						{!routeId &&
							projectLinks
								.filter((item) => item.visible)
								.map((item) => (
									<Sidebar.MenuItem key={item.id} id={item.id} href={item.href} textValue={item.label} isCurrent={pathname === item.href}>
										<Sidebar.MenuIcon>
											<item.icon size={18} />
										</Sidebar.MenuIcon>
										<Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
									</Sidebar.MenuItem>
								))}
						{routeId && project && (
							<Sidebar.MenuItem id='back-project' href={"/projects/" + project.id} textValue='Back to project'>
								<Sidebar.MenuIcon>
									<IconArrowLeft size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>{project.name}</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}
						{routeLinks
							.filter((item) => item.visible)
							.map((item) => (
								<Sidebar.MenuItem key={"route-" + item.id} id={"route-" + item.id} href={item.id === "middleware" ? "/code/endpoint/" + routeId + "?projectId=" + project?.id : routeAddress + "?section=" + item.id} textValue={item.label} isCurrent={routeSection === item.id}>
									<Sidebar.MenuIcon>
										<item.icon size={18} />
									</Sidebar.MenuIcon>
									<Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
								</Sidebar.MenuItem>
							))}
						{!project &&
							!workspaceContext &&
							data.workspaces.map((item) => (
								<Sidebar.MenuItem key={item.id} id={"workspace-" + item.id} href={"/workspaces/" + item.id} textValue={item.name + " workspace"}>
									<Sidebar.MenuIcon>
										<IconSettings size={18} />
									</Sidebar.MenuIcon>
									<Sidebar.MenuLabel>{item.name} workspace</Sidebar.MenuLabel>
								</Sidebar.MenuItem>
							))}
						{!project && (
							<Sidebar.MenuItem id='all-events' href='/events' textValue='All events' isCurrent={pathname === "/events"}>
								<Sidebar.MenuIcon>
									<IconInbox size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>All events</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}

						{!project && !workspaceContext && data.me.permissions.includes("code.read") && (
							<Sidebar.MenuItem id='code' href={"/code/instance/" + data.me.instanceId} textValue='Code and middleware'>
								<Sidebar.MenuIcon>
									<IconCode size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>Code and middleware</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}
						{!project && !workspaceContext && admin && (
							<Sidebar.MenuItem id='members' href='/admin/members' textValue='Instance members'>
								<Sidebar.MenuIcon>
									<IconUsers size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>Instance members</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>
		</>
	);

	return (
		<Context.Provider value={{ ...data, reload: load }}>
			<AppLayout
				sidebar={
					<>
						<Sidebar>{navigationContent}</Sidebar>
						<Sidebar.Mobile aria-label='Dashboard navigation'>{navigationContent}</Sidebar.Mobile>
					</>
				}
				navigate={(href) => {
					if (window.dispatchEvent(new CustomEvent("payloadbay:before-navigate", { detail: { href }, cancelable: true }))) router.push(href);
				}}
				navbar={
					<div className='bg-background border-border flex min-h-16 items-center justify-between gap-3 border-b px-4 sm:px-6'>
						<div className='flex min-w-0 items-center gap-2'>
							<AppLayout.MenuToggle aria-label='Toggle navigation' />
							<Link href='/' aria-label='Payload Bay home' className='shrink-0'>
								<Image src='/brand/payloadbay-logo-dark-rounded.svg' alt='Payload Bay' width={160} height={35} priority className='hidden min-[360px]:block' />
								<Image src='/brand/payloadbay-icon-dark-rounded.svg' alt='Payload Bay' width={32} height={32} priority className='min-[360px]:hidden' />
							</Link>
						</div>
						<div className='flex shrink-0 items-center gap-2'>
							{(project?.permissions ?? workspace?.permissions ?? data.me.permissions).includes("notifications.read") && <NotificationInbox scope={{ type: project ? "project" : workspace ? "workspace" : "instance", id: project?.id ?? workspace?.id ?? data.me.instanceId }} />}
							<Dropdown>
								<Dropdown.Trigger aria-label='Account menu' className='rounded-full outline-offset-4'>
									<Avatar size='sm'>
										<Avatar.Fallback>{initials}</Avatar.Fallback>
									</Avatar>
								</Dropdown.Trigger>
								<Dropdown.Popover placement='bottom end' className='w-64 max-w-[calc(100vw-2rem)]'>
									<Dropdown.Menu aria-label='Account actions'>
										<Dropdown.Section>
											<Header className='flex flex-col gap-1 px-2 py-2'>
												<span className='truncate font-medium'>{data.me.user.name}</span>
												<span className='text-muted truncate text-xs'>{data.me.user.email}</span>
											</Header>
											<Dropdown.Item id='notification-preferences' textValue='Your notifications' href='/account/notifications'>
												<IconBell size={18} aria-hidden='true' />
												<Label>Your notifications</Label>
											</Dropdown.Item>
											<Dropdown.Item id='account' textValue='Account settings' href='/account'>
												<IconSettings size={18} aria-hidden='true' />
												<Label>Account settings</Label>
											</Dropdown.Item>
											{admin && (
												<Dropdown.Item id='administration' textValue='Instance members' href='/admin/members'>
													<IconUsers size={18} aria-hidden='true' />
													<Label>Instance members</Label>
												</Dropdown.Item>
											)}
											<Dropdown.Item id='sign-out' textValue='Sign out' onAction={() => void signOut()}>
												<IconLogout size={18} aria-hidden='true' />
												<Label>Sign out</Label>
											</Dropdown.Item>
										</Dropdown.Section>
									</Dropdown.Menu>
								</Dropdown.Popover>
							</Dropdown>
						</div>
					</div>
				}
			>
				<div className='mx-auto w-full min-w-0 max-w-6xl p-4 sm:p-6 lg:p-10'>{children}</div>
			</AppLayout>
		</Context.Provider>
	);
}
