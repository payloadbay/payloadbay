import { ToastHost } from "@lib/feedback";
import type { Metadata } from "next";
import type { AppLayoutProps } from "@types";
import { connection } from "next/server";
import "@fontsource-variable/inter";
import "@styles/globals.css";

export const metadata: Metadata = {
	title: "Payload Bay",
	description: "Payload Bay application",
};

export default async function RootLayout({ children }: AppLayoutProps) {
	await connection();
	const preview = process.env.IS_PREVIEW === "true";

	return (
		<html lang='en' data-theme='dark'>
			<body>
				{preview && (
					<aside aria-label='Preview mode' className='border-warning/40 bg-warning/10 border-b px-6 py-3 text-sm'>
						<strong>Disposable PR preview.</strong> Shared demo data is reset on every redeployment. Do not use production credentials or sensitive data. Use provider test webhooks only.
					</aside>
				)}
				{children}
				<ToastHost />
			</body>
		</html>
	);
}
