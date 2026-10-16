"use client";

import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { Avatar, Button, Dropdown, Header, Label, Breadcrumbs } from "@heroui/react";
import { AppLayout, Sidebar, Command } from "@heroui-pro/react";
import { IconHome, IconFolder, IconUsers, IconLogout, IconCode, IconSettings, IconInbox, IconBell, IconKey, IconFlask, IconHistory, IconRoute, IconBuilding, IconArrowLeft, IconSearch } from "@tabler/icons-react";
import { PreviewNotice } from "@components/preview-notice";
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

export function DashboardShell({ children, preview = false }: { children: ReactNode; preview?: boolean }) {
	const router = useRouter();

	const pathname = usePathname();
	const search = useSearchParams();

	const [data, setData] = useState<Omit<DashboardState, "reload"> | null>(null);
	const [error, setError] = useState("");
	const [navigationQuery, setNavigationQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);

	const rawRouteId = pathname.match(/^\/projects\/[^/]+\/routes\/([^/]+)/)?.[1] ?? pathname.match(/^\/code\/endpoint\/([^/]+)/)?.[1];

	const [routeMetadata, setRouteMetadata] = useState<{ id: string; name: string } | null>(null);
	const [browse, setBrowse] = useState<{ type: "instance" | "workspace" | "project"; id?: string } | null>(null);

	useFeedbackToast(error, "", { error: "Dashboard error", success: "Success" });

	const fetchData = useCallback(async () => {
		const [me, workspaces, projects] = await Promise.all([api<MeProfile>("/me"), api<WorkspaceSummary[]>("/workspaces"), api<ProjectSummary[]>("/projects")]);

		return { me, workspaces, projects };
	}, []);

	const receive = useCallback((next: Omit<DashboardState, "reload">) => {
		setData(next);
		setBrowse(null);
		setNavigationQuery("");
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

	useEffect(() => {
		if (!rawRouteId) return;
		let active = true;
		api<{ id: string; name: string }>("/endpoints/" + rawRouteId)
			.then((value) => {
				if (active) setRouteMetadata(value);
			})
			.catch(failed);

		return () => {
			active = false;
		};
	}, [rawRouteId, failed]);

	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;

		const update = () => {
			document.documentElement.style.setProperty("--dashboard-viewport-height", viewport.height + "px");
			document.documentElement.style.setProperty("--dashboard-viewport-top", viewport.offsetTop + "px");
		};

		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);

		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
			document.documentElement.style.removeProperty("--dashboard-viewport-height");
			document.documentElement.style.removeProperty("--dashboard-viewport-top");
		};
	}, []);

	if (!data)
		return (
			<main className='flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center'>
				{!error && <LoadingState label='Loading your dashboard…' />}
				{error && <p role='status'>Could not load your dashboard.</p>}
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
	const currentProject = data.projects.find((item) => item.id === projectId);
	const project = browse ? data.projects.find((item) => browse.type === "project" && item.id === browse.id) : currentProject;
	const workspaceId = pathname.match(/^\/workspaces\/([^/]+)/)?.[1] ?? pathname.match(/^\/code\/workspace\/([^/]+)/)?.[1] ?? currentProject?.workspace_id;
	const currentWorkspace = data.workspaces.find((item) => item.id === workspaceId);
	const workspace = browse ? data.workspaces.find((item) => item.id === (project?.workspace_id ?? (browse.type === "workspace" ? browse.id : undefined))) : currentWorkspace;

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
	const routeAddress = routeId && currentProject ? "/projects/" + currentProject.id + "/routes/" + routeId : "";
	const routeLinks =
		!browse && routeId && project
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

	const globalLinks = [
		{
			id: "home",
			label: "Overview",
			href: "/",
			icon: IconHome,
			visible: true,
		},
		{
			id: "workspaces",
			label: "Workspaces",
			href: "/workspaces",
			icon: IconBuilding,
			visible: true,
		},
		{
			id: "projects",
			label: "Projects",
			href: "/projects",
			icon: IconFolder,
			visible: true,
		},
		{
			id: "events",
			label: "Event log",
			href: "/events",
			icon: IconInbox,
			visible: true,
		},
		{
			id: "instance-code",
			label: "Shared code",
			href: "/code/instance/" + data.me.instanceId,
			icon: IconCode,
			visible: data.me.permissions.includes("code.read"),
		},
		{
			id: "instance-members",
			label: "Instance members",
			href: "/admin/members",
			icon: IconUsers,
			visible: admin,
		},
	];
	const workspaceLinks = workspace
		? [
				{
					id: "workspace",
					label: "Workspace overview",
					href: "/workspaces/" + workspace.id,
					icon: IconBuilding,
					visible: true,
				},
				{
					id: "workspace-members",
					label: "Workspace members",
					href: "/workspaces/" + workspace.id + "/members",
					icon: IconUsers,
					visible: workspace.permissions.includes("members.manage"),
				},
				{
					id: "workspace-code",
					label: "Code and middleware",
					href: "/code/workspace/" + workspace.id,
					icon: IconCode,
					visible: workspace.permissions.includes("code.read"),
				},
				{
					id: "workspace-rules",
					label: "Notification rules",
					href: "/workspaces/" + workspace.id + "/notifications",
					icon: IconBell,
					visible: workspace.permissions.includes("notifications.rules.manage"),
				},
			]
		: [];
	const middlewareLink =
		routeId && project
			? {
					id: "middleware",
					label: "Middleware",
					href: "/code/endpoint/" + routeId + "?projectId=" + project.id,
					icon: IconCode,
					visible: project.permissions.includes("code.read"),
				}
			: null;
	const contextualLinks = !browse && routeId ? [...routeLinks.map((item) => ({ ...item, href: routeAddress + "?section=" + item.id })), ...(middlewareLink ? [middlewareLink] : [])] : project ? projectLinks : workspace ? workspaceLinks : [];
	const groups = [
		{ label: "Settings", items: contextualLinks.filter((item) => ["code", "helpers", "secrets", "middleware", "project-overview", "project-code", "project-members", "workspace", "workspace-members", "workspace-code"].includes(item.id)) },
		{ label: "Observe and troubleshoot", items: contextualLinks.filter((item) => ["events", "project-events", "overview", "test"].includes(item.id)) },
		{ label: "Publish and history", items: contextualLinks.filter((item) => item.id === "history") },
		{ label: "Automation", items: contextualLinks.filter((item) => ["project-notifications", "workspace-rules"].includes(item.id)) },
	];
	const searchItems = [
		...globalLinks.filter((item) => item.visible),
		{
			id: "account",
			label: "Account settings",
			href: "/account",
			icon: IconSettings,
		},
		{
			id: "personal-notifications",
			label: "Notification settings",
			href: "/account/notifications",
			icon: IconBell,
		},
		...data.workspaces.flatMap((item) => [
			{
				id: "w-" + item.id,
				label: item.name + " · Workspace",
				href: "/workspaces/" + item.id,
				icon: IconBuilding,
			},
			...(item.permissions.includes("members.manage")
				? [
						{
							id: "wm-" + item.id,
							label: item.name + " · Workspace members",
							href: "/workspaces/" + item.id + "/members",
							icon: IconUsers,
						},
					]
				: []),
		]),
		...data.projects.flatMap((item) => [
			{
				id: item.id,
				label: item.name + " · Project",
				href: "/projects/" + item.id,
				icon: IconFolder,
			},
			...(item.permissions.includes("members.manage")
				? [
						{
							id: "pm-" + item.id,
							label: item.name + " · Project members",
							href: "/projects/" + item.id + "/members",
							icon: IconUsers,
						},
					]
				: []),
		]),
		...contextualLinks.filter((item) => item.visible).map((item) => ({ ...item, id: "context-" + item.id })),
	];
	const routeScope = !browse && Boolean(routeId);
	const scoped = routeScope || Boolean(project || workspace);
	const scopeTitle = routeScope ? (routeMetadata && routeMetadata.id === routeId ? routeMetadata.name : "Ingress route") : (project?.name ?? workspace?.name ?? "Payload Bay");
	const parentScope = routeScope ? { type: "project" as const, id: project!.id } : project ? { type: "workspace" as const, id: project.workspace_id } : { type: "instance" as const };

	function navigate(href: string) {
		setSearchOpen(false);
		if (!window.dispatchEvent(new CustomEvent("payloadbay:before-navigate", { detail: { href }, cancelable: true }))) return;
		router.push(href);
		setBrowse(null);
		setSearchOpen(false);
		setNavigationQuery("");
	}

	const navigationContent = (
		<>
			<Sidebar.Header>
				<div className='px-3 py-4'>
					{scoped && (
						<Button variant='ghost' size='sm' onPress={() => setBrowse(parentScope)}>
							<IconArrowLeft size={16} />
							Back to {routeScope ? "project" : project ? "workspace" : "instance"}
						</Button>
					)}
					<p className='mt-2 break-words text-lg font-semibold'>{scopeTitle}</p>
				</div>
			</Sidebar.Header>
			<Sidebar.Content className='min-h-0 overflow-y-auto overscroll-contain pb-6'>
				{!scoped && (
					<Sidebar.Group>
						<Sidebar.Menu aria-label='Instance navigation'>
							{globalLinks
								.filter((item) => item.visible && item.id !== "instance-members")
								.map((item) => (
									<Sidebar.MenuItem key={item.id} id={item.id} href={item.href} textValue={item.label} isCurrent={pathname === item.href}>
										<Sidebar.MenuIcon>
											<item.icon size={18} />
										</Sidebar.MenuIcon>
										<Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
									</Sidebar.MenuItem>
								))}
						</Sidebar.Menu>
					</Sidebar.Group>
				)}
				{scoped &&
					groups
						.filter((group) => group.items.some((item) => item.visible))
						.map((group) => (
							<details key={scopeTitle + group.label} open className='px-2'>
								<summary className='text-muted cursor-pointer px-2 py-3 text-xs font-semibold whitespace-normal'>{group.label}</summary>
								<Sidebar.Group>
									<Sidebar.Menu aria-label={group.label}>
										{group.items
											.filter((item) => item.visible)
											.map((item) => (
												<Sidebar.MenuItem key={item.id} id={item.id} href={item.href} textValue={item.label} isCurrent={item.href === pathname || item.href === pathname + "?section=" + routeSection}>
													<Sidebar.MenuIcon>
														<item.icon size={18} />
													</Sidebar.MenuIcon>
													<Sidebar.MenuLabel className='whitespace-normal'>{item.label}</Sidebar.MenuLabel>
												</Sidebar.MenuItem>
											))}
									</Sidebar.Menu>
								</Sidebar.Group>
							</details>
						))}
			</Sidebar.Content>
			{admin && !scoped && (
				<Sidebar.Footer>
					<Sidebar.Group>
						<Sidebar.GroupLabel>Administration</Sidebar.GroupLabel>
						<Sidebar.Menu aria-label='Instance administration'>
							<Sidebar.MenuItem id='instance-members' href='/admin/members' textValue='Instance members' isCurrent={pathname === "/admin/members"}>
								<Sidebar.MenuIcon>
									<IconUsers size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>Instance members</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.Group>
				</Sidebar.Footer>
			)}
		</>
	);

	return (
		<Context.Provider value={{ ...data, reload: load }}>
			<AppLayout
				scrollMode='page'
				sidebar={
					<>
						<Sidebar>{navigationContent}</Sidebar>
						<Sidebar.Mobile aria-label='Dashboard navigation'>{navigationContent}</Sidebar.Mobile>
					</>
				}
				navigate={navigate}
				navbar={
					<div>
						{preview && <PreviewNotice />}
						<div className='bg-background border-border flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-6'>
							<div className='flex min-w-0 items-center gap-2'>
								<AppLayout.MenuToggle aria-label='Toggle navigation' />
								<Link href='/' aria-label='Payload Bay home' className='shrink-0'>
									<Image src='/brand/payloadbay-logo-dark-transparent.svg' alt='Payload Bay' width={160} height={35} priority className='hidden min-[360px]:block' />
									<Image src='/brand/payloadbay-icon-dark-transparent.svg' alt='Payload Bay' width={32} height={32} priority className='min-[360px]:hidden' />
								</Link>
							</div>
							<Button variant='secondary' aria-label='Search pages and resources' aria-haspopup='dialog' onPress={() => setSearchOpen(true)} className='text-muted order-3 w-full justify-start font-normal sm:order-none sm:min-w-0 sm:max-w-lg sm:flex-1'>
								<IconSearch size={18} aria-hidden='true' />
								<span className='truncate'>Search pages and resources…</span>
							</Button>
							<div className='flex shrink-0 items-center gap-2'>
								{(currentProject?.permissions ?? currentWorkspace?.permissions ?? data.me.permissions).includes("notifications.read") && <NotificationInbox scope={{ type: currentProject ? "project" : currentWorkspace ? "workspace" : "instance", id: currentProject?.id ?? currentWorkspace?.id ?? data.me.instanceId }} />}
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
												<Dropdown.Item id='notification-preferences' textValue='Notification settings' href='/account/notifications'>
													<IconBell size={18} aria-hidden='true' />
													<Label>Notification settings</Label>
												</Dropdown.Item>
												<Dropdown.Item id='account' textValue='Account settings' href='/account'>
													<IconSettings size={18} aria-hidden='true' />
													<Label>Account settings</Label>
												</Dropdown.Item>

												<Dropdown.Item className='text-danger' id='sign-out' textValue='Sign out' onAction={() => void signOut()}>
													<IconLogout size={18} aria-hidden='true' />
													<Label>Sign out</Label>
												</Dropdown.Item>
											</Dropdown.Section>
										</Dropdown.Menu>
									</Dropdown.Popover>
								</Dropdown>
							</div>
						</div>
					</div>
				}
			>
				<div className='mx-auto w-full min-w-0 max-w-6xl p-4 sm:p-6 lg:p-10'>
					<nav aria-label='Breadcrumbs' className='mb-6 hidden overflow-x-auto sm:block'>
						<Breadcrumbs className='min-w-max'>
							<Breadcrumbs.Item href={pathname === "/" ? undefined : "/"}>Overview</Breadcrumbs.Item>
							{currentWorkspace && <Breadcrumbs.Item href={pathname === "/workspaces/" + currentWorkspace.id ? undefined : "/workspaces/" + currentWorkspace.id}>{currentWorkspace.name}</Breadcrumbs.Item>}
							{currentProject && <Breadcrumbs.Item href={pathname === "/projects/" + currentProject.id ? undefined : "/projects/" + currentProject.id}>{currentProject.name}</Breadcrumbs.Item>}
							{routeId && <Breadcrumbs.Item href={routeAddress}>{routeMetadata && routeMetadata.id === routeId ? routeMetadata.name : "Ingress route"}</Breadcrumbs.Item>}
							{routeId && <Breadcrumbs.Item>{routeSection === "middleware" ? "Middleware" : (routeLinks.find((item) => item.id === routeSection)?.label ?? "Scripts")}</Breadcrumbs.Item>}
							{!currentProject && !currentWorkspace && pathname !== "/" && <Breadcrumbs.Item>{pathname === "/workspaces" ? "Workspaces" : pathname === "/projects" ? "Projects" : pathname === "/events" ? "Events" : pathname.startsWith("/account") ? "Account settings" : "Administration"}</Breadcrumbs.Item>}
						</Breadcrumbs>
					</nav>
					<nav aria-label='Breadcrumbs' className='mb-6 flex min-w-0 items-center gap-2 sm:hidden'>
						{pathname !== "/" && (
							<Dropdown>
								<Dropdown.Trigger aria-label='Parent pages' className='button button--ghost size-9 shrink-0'>
									…
								</Dropdown.Trigger>
								<Dropdown.Popover className='max-w-[calc(100vw-2rem)]'>
									<Dropdown.Menu aria-label='Parent pages'>
										<Dropdown.Item id='home' href='/'>
											Overview
										</Dropdown.Item>
										{currentWorkspace && (
											<Dropdown.Item id='workspace' href={"/workspaces/" + currentWorkspace.id}>
												{currentWorkspace.name}
											</Dropdown.Item>
										)}
										{currentProject && (
											<Dropdown.Item id='project' href={"/projects/" + currentProject.id}>
												{currentProject.name}
											</Dropdown.Item>
										)}
										{routeId && (
											<Dropdown.Item id='route' href={routeAddress}>
												{routeMetadata?.name ?? "Ingress route"}
											</Dropdown.Item>
										)}
									</Dropdown.Menu>
								</Dropdown.Popover>
							</Dropdown>
						)}
						<Breadcrumbs className='min-w-0 [&_.breadcrumbs__link]:max-w-36 [&_.breadcrumbs__link]:truncate'>
							{routeId ? <Breadcrumbs.Item href={routeAddress}>{routeMetadata?.name ?? "Ingress route"}</Breadcrumbs.Item> : currentProject ? <Breadcrumbs.Item href={pathname === "/projects/" + currentProject.id ? undefined : "/projects/" + currentProject.id}>{currentProject.name}</Breadcrumbs.Item> : currentWorkspace ? <Breadcrumbs.Item href={pathname === "/workspaces/" + currentWorkspace.id ? undefined : "/workspaces/" + currentWorkspace.id}>{currentWorkspace.name}</Breadcrumbs.Item> : null}
							{routeId ? <Breadcrumbs.Item>{routeSection === "middleware" ? "Middleware" : (routeLinks.find((item) => item.id === routeSection)?.label ?? "Scripts")}</Breadcrumbs.Item> : !currentProject && !currentWorkspace ? <Breadcrumbs.Item>{pathname === "/" ? "Overview" : pathname === "/workspaces" ? "Workspaces" : pathname === "/projects" ? "Projects" : pathname === "/events" ? "Events" : pathname.startsWith("/account") ? "Account settings" : "Administration"}</Breadcrumbs.Item> : null}
						</Breadcrumbs>
					</nav>
					{children}
				</div>
			</AppLayout>
			<Command>
				<Command.Backdrop
					isOpen={searchOpen}
					onOpenChange={(open) => {
						setSearchOpen(open);
						if (!open) setNavigationQuery("");
					}}
				>
					<Command.Container size='lg'>
						<Command.Dialog aria-label='Search pages and resources' inputValue={navigationQuery} onInputChange={setNavigationQuery}>
							<Command.Header>All accessible pages and resources</Command.Header>
							<Command.InputGroup>
								<Command.InputGroup.Input placeholder='Search pages and resources…' />
								<Command.InputGroup.ClearButton aria-label='Clear search' />
							</Command.InputGroup>
							<Command.List
								onAction={(key) => {
									const item = searchItems.find((item) => item.id === key);
									if (item) navigate(item.href);
								}}
								renderEmptyState={() => <p className='p-4 text-muted'>No matching pages or resources.</p>}
							>
								<Command.Group heading='Jump to'>
									{searchItems.map((item) => (
										<Command.Item key={item.id} id={item.id} textValue={item.label} aria-label={"Jump to " + item.label}>
											<item.icon size={18} />
											<span className='min-w-0 whitespace-normal'>{item.label}</span>
											<span className='ml-auto text-xs text-muted'>Jump to</span>
										</Command.Item>
									))}
								</Command.Group>
							</Command.List>
						</Command.Dialog>
					</Command.Container>
				</Command.Backdrop>
			</Command>
		</Context.Provider>
	);
}
