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
			<body className='flex min-h-svh flex-col' data-preview={preview ? "true" : undefined}>
				{children}
				<ToastHost />
			</body>
		</html>
	);
}
