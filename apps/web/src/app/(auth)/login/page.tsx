import { AuthPanel } from "@components/auth-panel";

export default function LoginPage() {
	return <AuthPanel initialEmail={process.env.IS_PREVIEW === "true" ? "reviewer@preview.payloadbay.test" : ""} />;
}
