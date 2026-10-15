"use client";

import { useFeedbackToast } from "@lib/feedback";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { AppLayout, Sidebar } from "@heroui-pro/react";
import { IconHome, IconFolder, IconUsers, IconLogout, IconCode } from "@tabler/icons-react";
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
	const nav = (
		<Sidebar>
			<Sidebar.Header>
				<Link href='/' className='text-accent px-3 py-4 text-lg font-semibold'>
					Payload Bay
				</Link>
			</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.Menu aria-label='Dashboard navigation'>
						<Sidebar.MenuItem id='overview' href='/' isCurrent={pathname === "/"} textValue='Overview'>
							<Sidebar.MenuIcon>
								<IconHome size={18} />
							</Sidebar.MenuIcon>
							<Sidebar.MenuLabel>Overview</Sidebar.MenuLabel>
						</Sidebar.MenuItem>
						{data.projects.map((project) => (
							<Sidebar.MenuItem id={project.id} key={project.id} href={"/projects/" + project.id} textValue={project.name} isCurrent={pathname.startsWith("/projects/" + project.id)}>
								<Sidebar.MenuIcon>
									<IconFolder size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>{project.name}</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						))}
						{data.me.permissions.includes("code.read") && (
							<Sidebar.MenuItem id='code' href={"/code/instance/" + data.me.instanceId} textValue='Code and middleware'>
								<Sidebar.MenuIcon>
									<IconCode size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>Code and middleware</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						)}
						{admin && (
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
			<Sidebar.Footer>
				<p className='text-muted px-3 text-sm'>{data.me.user.name}</p>
				<Button
					variant='ghost'
					onPress={async () => {
						const result = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
						if (result.ok) {
							router.replace("/login");
							router.refresh();
						} else setError("Could not sign out. Please retry.");
					}}
				>
					<IconLogout size={18} aria-hidden='true' />
					Sign out
				</Button>
			</Sidebar.Footer>
		</Sidebar>
	);

	return (
		<Context.Provider value={{ ...data, reload: load }}>
			<AppLayout
				sidebar={nav}
				navigate={(href) => router.push(href)}
				navbar={
					<header className='border-border flex min-h-16 items-center justify-between gap-4 border-b px-6'>
						<div className='flex items-center gap-3'>
							<Sidebar.Trigger />
							<Link href='/' className='font-semibold'>
								Your event delivery platform
							</Link>
						</div>
						<div className='flex items-center gap-3'>
							{data.me.permissions.includes("notifications.read") && <NotificationInbox scope={{ type: "instance", id: data.me.instanceId }} />}
							<span className='text-muted text-sm'>{data.me.user.email}</span>
						</div>
					</header>
				}
			>
				<main className='mx-auto w-full max-w-6xl p-6 lg:p-10'>{children}</main>
			</AppLayout>
		</Context.Provider>
	);
}
