import { selectVerificationMail, type FixtureMail } from "./mail-selection";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

const origin = () => String(test.info().project.use.baseURL);

export const commandHeaders = () => ({ origin: origin(), "x-payloadbay-csrf": "1" });

async function mailSnapshot(request: APIRequestContext) {
	const messages = await (await request.get(process.env.PAB_TEST_MAIL_URL + "/api/v1/messages")).json();

	return new Set<string>((messages.messages as FixtureMail[]).map((message) => message.ID));
}

async function verifyNextCode(page: Page, email: string, before: ReadonlySet<string>) {
	let id = "";
	await expect
		.poll(async () => {
			const messages = await (await page.request.get(process.env.PAB_TEST_MAIL_URL + "/api/v1/messages")).json();
			id = selectVerificationMail(messages.messages, email, before)?.ID ?? "";

			return id;
		})
		.not.toBe("");
	const message = await (await page.request.get(process.env.PAB_TEST_MAIL_URL + "/api/v1/message/" + id)).json();
	const otp = message.Text.match(/\b\d{6}\b/)?.[0];
	expect(otp).toBeTruthy();
	const verified = await page.request.post("/api/auth/sign-in/email-otp", { headers: { origin: origin() }, data: { email, otp } });
	expect(verified.status()).toBe(200);
}

export async function signInBrowser(page: Page, email: string) {
	const before = await mailSnapshot(page.request);
	const requested = await page.request.post("/api/auth/email-otp/send-verification-otp", { headers: { origin: origin() }, data: { email, type: "sign-in" } });
	expect(requested.status()).toBe(200);
	await verifyNextCode(page, email, before);
}

export async function ensureBrowserOwner(page: Page) {
	const configured = (await (await page.request.get("/api/v1/bootstrap")).json()).configured;
	if (configured) {
		await signInBrowser(page, "browser@example.test");

		return;
	}

	const before = await mailSnapshot(page.request);
	const secret = process.env.PAYLOADBAY_BOOTSTRAP_SECRET;
	const response = await page.request.post("/api/v1/bootstrap", {
		headers: commandHeaders(),
		data: {
			action: "request-code",
			secret,
			email: "browser@example.test",
			name: "Browser owner",
		},
	});
	expect(response.status()).toBe(200);
	await verifyNextCode(page, "browser@example.test", before);
	expect((await page.request.post("/api/v1/bootstrap", { headers: commandHeaders(), data: { action: "complete", secret } })).status()).toBe(200);
}

/** The first accessible organization is test context, never an authorization grant. */
export async function browserOrganization(page: Page) {
	const response = await page.request.get("/api/v1/organizations");
	expect(response.status()).toBe(200);
	const organizations = await response.json();
	expect(organizations.length).toBeGreaterThan(0);

	return organizations[0].id as string;
}
