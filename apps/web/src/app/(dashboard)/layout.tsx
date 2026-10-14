import { DashboardShell } from "@components/dashboard-shell";
import type { AppLayoutProps } from "@types";

export default function DashboardLayout({ children }: AppLayoutProps) {
	return <DashboardShell>{children}</DashboardShell>;
}
