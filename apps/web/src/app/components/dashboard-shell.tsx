"use client";

import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { Avatar, Button, Dropdown, Header, Label, Breadcrumbs, Accordion } from "@heroui/react";
import { DashboardLayout } from "@components/ui/dashboard-layout";
import { SidebarNavigation } from "@components/ui/sidebar-navigation";
import { CommandSearch } from "@components/ui/command-search";
import { useNavigationSearch } from "@components/ui/use-navigation-search";
import { RouterProvider } from "react-aria-components";
import { IconHome, IconFolder, IconUsers, IconLogout, IconCode, IconSettings, IconInbox, IconBell, IconKey, IconFlask, IconHistory, IconRoute, IconBuilding, IconArrowLeft, IconChevronRight, IconSearch, IconBuildingCommunity, IconChartBar, IconBook, IconActivity, IconClipboardList, IconServer, IconMenu2 } from "@tabler/icons-react";
import { PreviewNotice } from "@components/preview-notice";
import { LiveSubscription } from "@components/live-subscription";
import { NotificationInbox } from "@components/notification-inbox";
import { api, ApiFailure } from "@lib/api-client";
import type { MeProfile, OrganizationSummary, WorkspaceSummary, ProjectSummary } from "@types";

type NavigationLink = {
	id: string;
	href: string;
	label: string;
	icon: typeof IconHome;
};

type DashboardState = {
	me: MeProfile;
	organizations: OrganizationSummary[];
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

function NavigationSearch({ onSearch, collapsed }: { onSearch: () => void; collapsed: boolean }) {
	return (
		<Button variant='secondary' isIconOnly={collapsed} aria-label='Search pages and resources' aria-haspopup='dialog' className={collapsed ? "text-muted" : "text-muted w-full justify-start font-normal"} onPress={onSearch}>
			<IconSearch size={18} aria-hidden='true' className='shrink-0' />
			{!collapsed && (
				<>
					<span className='min-w-0 flex-1 truncate text-left'>Search…</span>
					<kbd className='text-muted shrink-0 text-xs'>Ctrl K</kbd>
				</>
			)}
		</Button>
	);
}

export function DashboardShell({ children, preview = false }: { children: ReactNode; preview?: boolean }) {
	const router = useRouter();

	const pathname = usePathname();
	const search = useSearchParams();

	const [data, setData] = useState<Omit<DashboardState, "reload"> | null>(null);
	const [error, setError] = useState("");

	const { searchOpen, navigationOpen, onSearchOpenChange: setSearchOpen, onNavigationOpenChange, onNavigationClosed } = useNavigationSearch();

	const rawRouteId = pathname.match(/^\/projects\/[^/]+\/routes\/([^/]+)/)?.[1] ?? pathname.match(/^\/code\/endpoint\/([^/]+)/)?.[1];

	const [routeMetadata, setRouteMetadata] = useState<{ id: string; name: string } | null>(null);
	const [browse, setBrowse] = useState<{ type: "instance" | "organization" | "workspace" | "project"; id?: string } | null>(null);

	useFeedbackToast(error, "", { error: "Dashboard error", success: "Success" });

	const fetchData = useCallback(async () => {
		const [me, organizations, workspaces, projects] = await Promise.all([api<MeProfile>("/me"), api<OrganizationSummary[]>("/organizations"), api<WorkspaceSummary[]>("/workspaces"), api<ProjectSummary[]>("/projects")]);

		return {
			me,
			organizations,
			workspaces,
			projects,
		};
	}, []);

	const receive = useCallback((next: Omit<DashboardState, "reload">) => {
		setData(next);
		setBrowse(null);
		setError("");
	}, []);

	const failed = useCallback(
		(cause: unknown) => {
			if (cause instanceof ApiFailure && cause.status === 401) {
				setData(null);
				void api<{ needsOrganization: boolean }>("/onboarding")
					.then((status) => router.replace(status.needsOrganization ? "/onboarding" : "/login"))
					.catch(() => router.replace("/login"));
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

	useEffect(() => {
		const openSearch = () => setSearchOpen(true);

		document.addEventListener("payloadbay:open-search", openSearch);

		return () => document.removeEventListener("payloadbay:open-search", openSearch);
	}, [setSearchOpen]);

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

	const organizationId = pathname.match(/^\/organizations\/([^/]+)/)?.[1] ?? pathname.match(/^\/code\/organization\/([^/]+)/)?.[1] ?? currentWorkspace?.organization_id ?? currentProject?.organization_id;
	const currentOrganization = data.organizations.find((item) => item.id === organizationId);
	const organization = browse ? data.organizations.find((item) => item.id === (workspace?.organization_id ?? (browse.type === "organization" ? browse.id : undefined))) : currentOrganization;
	const organizationLinks = organization
		? [
				{
					id: "organization",
					label: "Workspaces",
					href: "/organizations/" + organization.id,
					icon: IconBuilding,
					visible: true,
				},
				{
					id: "organization-usage",
					label: "Usage and limits",
					href: "/organizations/" + organization.id + "/usage",
					icon: IconChartBar,
					visible: organization.permissions.includes("metadata.read"),
				},
				{
					id: "organization-members",
					label: "Organization members",
					href: "/organizations/" + organization.id + "/members",
					icon: IconUsers,
					visible: organization.permissions.includes("members.manage"),
				},
				{
					id: "organization-security",
					label: "Security",
					href: "/organizations/" + organization.id + "/security",
					icon: IconKey,
					visible: organization.permissions.includes("members.manage"),
				},
				{
					id: "organization-code",
					label: "Code and middleware",
					href: "/code/organization/" + organization.id,
					icon: IconCode,
					visible: organization.permissions.includes("code.read"),
				},
				{
					id: "organization-api-keys",
					label: "API keys",
					href: "/organizations/" + organization.id + "/api-keys",
					icon: IconKey,
					visible: organization.permissions.includes("tokens.manage"),
				},
			]
		: [];

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
					id: "project-members",
					label: "Project members",
					href: "/projects/" + project.id + "/members",
					icon: IconUsers,
					visible: project.permissions.includes("members.manage"),
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
					id: "project-api-keys",
					label: "API keys",
					href: "/projects/" + project.id + "/api-keys",
					icon: IconKey,
					visible: project.permissions.includes("tokens.manage"),
				},
			]
		: [];

	const routeId = pathname.match(/^\/projects\/[^/]+\/routes\/([^/]+)/)?.[1] ?? pathname.match(/^\/code\/endpoint\/([^/]+)/)?.[1];
	const routeSection = pathname.startsWith("/code/endpoint/") ? "middleware" : (search.get("section") ?? "overview");
	const routeAddress = routeId && currentProject ? "/projects/" + currentProject.id + "/routes/" + routeId : "";
	const routeLinks =
		!browse && routeId && project
			? [
					{
						id: "overview",
						label: "Overview",
						icon: IconRoute,
						visible: true,
					},
					{
						id: "playground",
						label: "Playground",
						icon: IconFlask,
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

	const administrationLabel = pathname === "/admin/installation" ? "Installation" : pathname === "/admin/audit" ? "Audit log" : pathname === "/admin/jobs" ? "Jobs and queues" : pathname.startsWith("/admin/notification-channels/") ? "Notification module" : pathname === "/admin/notification-channels" ? "Notification modules" : pathname === "/admin/email" ? "Instance customization" : "Administration";
	const breadcrumbItems: { label: string; href?: string }[] = [{ label: "Overview", href: pathname === "/" ? undefined : "/" }];
	if (currentOrganization) breadcrumbItems.push({ label: currentOrganization.name, href: "/organizations/" + currentOrganization.id });
	if (currentWorkspace) breadcrumbItems.push({ label: currentWorkspace.name, href: "/workspaces/" + currentWorkspace.id });
	if (currentProject) breadcrumbItems.push({ label: currentProject.name, href: "/projects/" + currentProject.id });
	if (routeId) {
		breadcrumbItems.push({ label: routeMetadata?.name ?? "Ingress route", href: routeAddress });
		breadcrumbItems.push({ label: routeSection === "middleware" ? "Middleware" : (routeLinks.find((item) => item.id === routeSection)?.label ?? "Scripts") });
	} else if (pathname.endsWith("/members")) breadcrumbItems.push({ label: currentProject ? "Project members" : currentWorkspace ? "Workspace members" : currentOrganization ? "Organization members" : "Instance members" });
	else if (pathname.endsWith("/audit")) breadcrumbItems.push({ label: "Audit log" });
	else if (pathname.endsWith("/usage")) breadcrumbItems.push({ label: "Usage and limits" });
	else if (currentOrganization && pathname.endsWith("/security")) breadcrumbItems.push({ label: "Security" });
	else if (pathname.endsWith("/api-keys")) breadcrumbItems.push({ label: currentOrganization ? "API keys" : "Personal API keys" });
	else if (pathname.startsWith("/code/")) breadcrumbItems.push({ label: currentProject || currentWorkspace || currentOrganization ? "Code and middleware" : "Instance code and middleware" });
	else if (pathname.endsWith("/notifications")) breadcrumbItems.push({ label: currentProject || currentWorkspace || currentOrganization ? "Notification rules" : "Notification settings" });
	else if (pathname.startsWith("/admin/notification-channels/")) {
		breadcrumbItems.push({ label: "Notification modules", href: "/admin/notification-channels" });
		breadcrumbItems.push({ label: administrationLabel });
	} else if (!currentOrganization && !currentWorkspace && !currentProject && pathname !== "/") breadcrumbItems.push({ label: pathname === "/organizations" ? "Organizations" : pathname === "/workspaces" ? "Workspaces" : pathname === "/projects" ? "Projects" : pathname === "/events" ? "Events" : pathname.startsWith("/account") ? "Account settings" : administrationLabel });
	if (breadcrumbItems.length > 1) breadcrumbItems[breadcrumbItems.length - 1].href = undefined;

	const globalLinks = [
		{
			id: "home",
			label: "Overview",
			href: "/",
			icon: IconHome,
			visible: true,
		},
		{
			id: "organizations",
			label: "Organizations",
			href: "/organizations",
			icon: IconBuildingCommunity,
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
				{
					id: "workspace-api-keys",
					label: "API keys",
					href: "/workspaces/" + workspace.id + "/api-keys",
					icon: IconKey,
					visible: workspace.permissions.includes("tokens.manage"),
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
	const primaryContextualLinks = !browse && routeId ? [...routeLinks.map((item) => ({ ...item, href: routeAddress + "?section=" + item.id })), ...(middlewareLink ? [middlewareLink] : [])] : project ? projectLinks : workspace ? workspaceLinks : organization ? organizationLinks : [];
	const auditResource = project ?? workspace ?? organization;
	const auditType = project ? "project" : workspace ? "workspace" : "organization";
	const contextualLinks = [
		...primaryContextualLinks,
		...(!routeId && auditResource?.permissions.includes("audit.read")
			? [
					{
						id: "scoped-audit",
						label: "Audit log",
						href: "/" + (auditType === "project" ? "projects" : auditType === "workspace" ? "workspaces" : "organizations") + "/" + auditResource.id + "/audit",
						icon: IconClipboardList,
						visible: true,
					},
				]
			: []),
	];

	const groups = [
		{ label: "Settings", items: contextualLinks.filter((item) => ["organization-security", "overview", "code", "helpers", "secrets", "middleware", "project-overview", "project-code", "project-members", "workspace", "workspace-members", "workspace-code", "organization", "organization-members", "organization-code", "organization-api-keys", "workspace-api-keys", "project-api-keys"].includes(item.id)) },
		{ label: "Observe and troubleshoot", items: contextualLinks.filter((item) => ["events", "project-events", "playground", "test", "organization-usage", "scoped-audit"].includes(item.id)) },
		{ label: "Publish and history", items: contextualLinks.filter((item) => item.id === "history") },
		{ label: "Automation", items: contextualLinks.filter((item) => ["project-notifications", "workspace-rules"].includes(item.id)) },
	];
	const searchItems = [
		...globalLinks.filter((item) => item.visible),
		...(data.me.permissions.includes("audit.read")
			? [
					{
						id: "instance-audit",
						label: "Audit log",
						href: "/admin/audit",
						icon: IconClipboardList,
					},
				]
			: []),
		...(data.me.permissions.includes("jobs.read")
			? [
					{
						id: "instance-jobs",
						label: "Jobs and queues",
						href: "/admin/jobs",
						icon: IconActivity,
					},
				]
			: []),
		...(data.me.permissions.includes("settings.manage")
			? [
					{
						id: "installation",
						label: "Installation",
						href: "/admin/installation",
						icon: IconServer,
					},
					{
						id: "notification-modules",
						label: "Notification modules",
						href: "/admin/notification-channels",
						icon: IconBell,
					},
				]
			: []),
		{
			id: "account",
			label: "Account settings",
			href: "/account",
			icon: IconSettings,
		},
		{
			id: "personal-api-keys",
			label: "Personal API keys",
			href: "/account/api-keys",
			icon: IconKey,
		},
		{
			id: "personal-notifications",
			label: "Notification settings",
			href: "/account/notifications",
			icon: IconBell,
		},
		...data.organizations.map((item) => ({
			id: "o-" + item.id,
			label: item.name + " / Organization",
			href: "/organizations/" + item.id,
			icon: IconBuildingCommunity,
		})),
		...data.workspaces.flatMap((item) => [
			{
				id: "w-" + item.id,
				label: item.name + " / Workspace",
				href: "/workspaces/" + item.id,
				icon: IconBuilding,
			},
			...(item.permissions.includes("members.manage")
				? [
						{
							id: "wm-" + item.id,
							label: item.name + " / Workspace members",
							href: "/workspaces/" + item.id + "/members",
							icon: IconUsers,
						},
					]
				: []),
		]),
		...data.projects.flatMap((item) => [
			{
				id: item.id,
				label: item.name + " / Project",
				href: "/projects/" + item.id,
				icon: IconFolder,
			},
			...(item.permissions.includes("members.manage")
				? [
						{
							id: "pm-" + item.id,
							label: item.name + " / Project members",
							href: "/projects/" + item.id + "/members",
							icon: IconUsers,
						},
					]
				: []),
		]),
		...contextualLinks.filter((item) => item.visible).map((item) => ({ ...item, id: "context-" + item.id })),
	];
	const routeScope = !browse && Boolean(routeId);
	const scoped = routeScope || Boolean(project || workspace || organization);
	const scopeTitle = routeScope ? (routeMetadata && routeMetadata.id === routeId ? routeMetadata.name : "Ingress route") : (project?.name ?? workspace?.name ?? organization?.name ?? "Payload Bay");
	const parentScope = routeScope ? { type: "project" as const, id: project!.id } : project && data.workspaces.some((item) => item.id === project.workspace_id) ? { type: "workspace" as const, id: project.workspace_id } : workspace && data.organizations.some((item) => item.id === workspace.organization_id) ? { type: "organization" as const, id: workspace.organization_id } : { type: "instance" as const };

	function navigate(href: string) {
		setSearchOpen(false);
		if (!window.dispatchEvent(new CustomEvent("payloadbay:before-navigate", { detail: { href }, cancelable: true }))) return;
		onNavigationOpenChange(false);
		router.push(href);
		setBrowse(null);
		setSearchOpen(false);
	}

	function renderLinks(label: string, items: NavigationLink[], collapsed: boolean) {
		return (
			<SidebarNavigation
				label={label}
				title=''
				collapsed={collapsed}
				groups={[{ label: "", items: items.map((item) => ({ ...item, icon: <item.icon size={18} /> })) }]}
				activeId={items.find((item) => item.href === pathname || item.href === pathname + "?section=" + routeSection || (item.id === "middleware" && pathname.startsWith("/code/endpoint/")))?.id}
				onNavigate={(event, item) => {
					if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
					event.preventDefault();
					navigate(item.href);
				}}
			/>
		);
	}

	function renderNavigation(collapsed: boolean) {
		const operations = searchItems.filter((item) => ["instance-audit", "instance-jobs"].includes(item.id));
		const access = searchItems.filter((item) => item.id === "instance-members");
		const configuration = searchItems.filter((item) => ["installation", "notification-modules"].includes(item.id));

		return (
			<div className='flex h-full min-h-0 flex-col'>
				<div className='dashboard-navigation-header flex flex-col gap-3 px-3 py-4'>
					<NavigationSearch collapsed={collapsed} onSearch={() => setSearchOpen(true)} />
					{scoped && (
						<Button variant='ghost' size='sm' isIconOnly={collapsed} aria-label={"Back to " + parentScope.type} onPress={() => setBrowse(parentScope)}>
							<IconArrowLeft size={16} />
							{!collapsed && <>Back to {parentScope.type}</>}
						</Button>
					)}
					{scoped && !collapsed && <p className='break-words text-lg font-semibold'>{scopeTitle}</p>}
				</div>
				<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6'>
					{!scoped &&
						renderLinks(
							"Instance navigation",
							globalLinks.filter((item) => item.visible && item.id !== "instance-members"),
							collapsed,
						)}
					{scoped &&
						groups
							.filter((group) => group.items.some((item) => item.visible))
							.map((group) =>
								collapsed ? (
									<div key={group.label}>
										{renderLinks(
											group.label,
											group.items.filter((item) => item.visible),
											true,
										)}
									</div>
								) : (
									<Accordion key={scopeTitle + group.label + pathname + routeSection} defaultExpandedKeys={[group.label]} hideSeparator className='px-2'>
										<Accordion.Item id={group.label}>
											<Accordion.Heading>
												<Accordion.Trigger className='text-muted px-2 py-3 text-xs font-semibold whitespace-normal'>
													{group.label}
													<Accordion.Indicator />
												</Accordion.Trigger>
											</Accordion.Heading>
											<Accordion.Panel>
												{renderLinks(
													group.label,
													group.items.filter((item) => item.visible),
													false,
												)}
											</Accordion.Panel>
										</Accordion.Item>
									</Accordion>
								),
							)}
				</div>
				{!scoped && operations.length + access.length + configuration.length > 0 && (
					<footer className='shrink-0 border-t border-border py-3'>
						{[
							{ label: "Operations", links: operations },
							{ label: "Access", links: access },
							{ label: "Configuration", links: configuration },
						].map(({ label, links }) => {
							if (!links.length) return null;

							return (
								<section key={String(label)}>
									{!collapsed && <p className='px-5 py-2 text-xs font-semibold text-muted'>{String(label)}</p>}
									{renderLinks(String(label), links, collapsed)}
								</section>
							);
						})}
					</footer>
				)}
			</div>
		);
	}

	return (
		<Context.Provider value={{ ...data, reload: load }}>
			<RouterProvider navigate={navigate}>
				<LiveSubscription instanceId={data.me.instanceId} onReconnect={load}>
					<DashboardLayout
						className='dashboard-app-layout'
						brand='Payload Bay'
						navigationLabel='Dashboard navigation'
						width={256}
						open={navigationOpen}
						onOpenChange={onNavigationOpenChange}
						onClosed={onNavigationClosed}
						navigation={renderNavigation}
						header={(toggleNavigation) => (
							<div className='bg-background'>
								{preview && <PreviewNotice />}
								<div className='bg-background border-border flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-6'>
									<div className='flex min-w-0 items-center gap-2'>
										<Button isIconOnly variant='ghost' aria-label='Toggle navigation' onPress={toggleNavigation}>
											<IconMenu2 size={18} />
										</Button>
										<Link href='/' aria-label='Payload Bay home' className='shrink-0'>
											<Image src='/brand/payloadbay-logo-dark-transparent.svg' alt='Payload Bay' width={160} height={35} priority className='hidden min-[360px]:block' />
											<Image src='/brand/payloadbay-icon-dark-transparent.svg' alt='Payload Bay' width={32} height={32} priority className='min-[360px]:hidden' />
										</Link>
									</div>

									<div className='flex shrink-0 items-center gap-2'>
										{data.me.passkeyEnrollmentRequired && (
											<Link href='/account' className='button button--secondary button--sm'>
												Add required passkey
											</Link>
										)}
										<NotificationInbox />
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

														<Dropdown.Item id='api-keys' textValue='Personal API keys' href='/account/api-keys'>
															<IconKey size={18} aria-hidden='true' />
															<Label>Personal API keys</Label>
														</Dropdown.Item>
														<Dropdown.Item id='api-docs' textValue='API documentation' href='/docs/api'>
															<IconBook size={18} aria-hidden='true' />
															<Label>API documentation</Label>
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
						)}
					>
						<main className='mx-auto w-full min-w-0 max-w-6xl p-4 sm:p-6 lg:p-10'>
							<nav aria-label='Breadcrumbs' className='mb-6 w-full min-w-0'>
								<Breadcrumbs className='w-full min-w-0 flex-nowrap [&_[data-slot=breadcrumbs-item]]:min-w-0 [&_[data-slot=link]]:block [&_[data-slot=link]]:min-w-0 [&_[data-slot=link]]:max-w-full [&_[data-slot=link]]:truncate [&_[data-slot=breadcrumbs-separator]]:shrink-0'>
									{breadcrumbItems.flatMap((item, index) => {
										const collapsed = breadcrumbItems.length > 3 && index > 0 && index < breadcrumbItems.length - 2;
										const crumb = (
											<Breadcrumbs.Item key={item.href ?? item.label} href={item.href} className={collapsed ? "hidden min-w-0 shrink sm:flex" : index === 0 ? "shrink-0" : "min-w-0 shrink"}>
												{item.label}
											</Breadcrumbs.Item>
										);
										if (index !== 1 || breadcrumbItems.length <= 3) return [crumb];

										return [
											<Breadcrumbs.Item key='collapsed-parents' className='shrink-0 sm:hidden'>
												{() => (
													<>
														<Dropdown>
															<Dropdown.Trigger aria-label='Parent pages' className='button button--ghost size-8'>
																…
															</Dropdown.Trigger>
															<Dropdown.Popover className='max-w-[calc(100vw-2rem)]'>
																<Dropdown.Menu aria-label='Parent pages'>
																	{breadcrumbItems.slice(1, -2).map((parent) => (
																		<Dropdown.Item key={parent.href ?? parent.label} id={parent.href ?? parent.label} href={parent.href}>
																			{parent.label}
																		</Dropdown.Item>
																	))}
																</Dropdown.Menu>
															</Dropdown.Popover>
														</Dropdown>
														<IconChevronRight aria-hidden='true' className='breadcrumbs__separator shrink-0' />
													</>
												)}
											</Breadcrumbs.Item>,
											crumb,
										];
									})}
								</Breadcrumbs>
							</nav>
							{children}
						</main>
					</DashboardLayout>
					<CommandSearch
						open={searchOpen}
						onOpenChange={setSearchOpen}
						hideLauncher
						items={searchItems.map((item) => ({ id: item.id, label: item.label, icon: <item.icon size={18} /> }))}
						onAction={(id) => {
							const item = searchItems.find((entry) => entry.id === id);
							if (item) navigate(item.href);
						}}
					/>
				</LiveSubscription>
			</RouterProvider>
		</Context.Provider>
	);
}
