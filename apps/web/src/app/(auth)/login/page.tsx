import { AuthPanel } from "@components/auth-panel";
import { connection } from "next/server";

export default async function LoginPage() {
	await connection();

	return <AuthPanel preview={process.env.IS_PREVIEW === "true"} loginHint={process.env.PAYLOADBAY_LOGIN_HINT} />;
}
