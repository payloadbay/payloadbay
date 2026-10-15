import { AuthPanel } from "@components/auth-panel";

export default function LoginPage() {
	return <AuthPanel preview={process.env.IS_PREVIEW === "true"} />;
}
