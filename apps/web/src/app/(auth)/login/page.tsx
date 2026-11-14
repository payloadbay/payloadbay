import { AuthPanel } from "@components/auth-panel";
import { connection } from "next/server";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
	await connection();

	const returnTo = (await searchParams).returnTo === "/account" ? "/account" : "/";

	return <AuthPanel returnTo={returnTo} preview={process.env.IS_PREVIEW === "true"} loginHint={process.env.PAYLOADBAY_LOGIN_HINT} />;
}
