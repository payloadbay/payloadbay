import { ToastHost } from "@lib/feedback";
import type { Metadata } from "next";
import type { AppLayoutProps } from "@types";
import "@fontsource-variable/inter";
import "@styles/globals.css";

export const metadata: Metadata = {
	title: "Payload Bay",
	description: "Payload Bay application",
};

export default function RootLayout({ children }: AppLayoutProps) {
	return (
		<html lang='en' data-theme='dark'>
			<body>
				{children}
				<ToastHost />
			</body>
		</html>
	);
}
