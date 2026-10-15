import { Suspense } from "react";
import { DashboardShell } from "@components/dashboard-shell";
import type { AppLayoutProps } from "@types";

export default function DashboardLayout({ children }: AppLayoutProps) {
	return (
		<Suspense
			fallback={
				<p role='status' className='p-6'>
					Loading dashboard…
				</p>
			}
		>
			<DashboardShell>{children}</DashboardShell>
		</Suspense>
	);
}
