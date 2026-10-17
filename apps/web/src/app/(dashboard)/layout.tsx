import { LoadingState } from "@components/loading-state";
import { Suspense } from "react";
import { DashboardShell } from "@components/dashboard-shell";
import type { AppLayoutProps } from "@types";

export default function DashboardLayout({ children }: AppLayoutProps) {
	return (
		<Suspense fallback={<LoadingState label='Loading dashboard…' size='screen' />}>
			<DashboardShell preview={process.env.IS_PREVIEW === "true"}>{children}</DashboardShell>
		</Suspense>
	);
}
