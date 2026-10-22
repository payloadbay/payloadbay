/** Fixed synthetic identity used only by the disposable PR demo. */
export const previewReviewerEmail = "reviewer@preview.payloadbay.test";

/** Additional identities exercise real scoped access through the normal OTP flow. */
export const previewProjectAccounts = [
	{ email: "project-admin@preview.payloadbay.test", name: "Project Admin Reviewer", role: "admin" },
	{ email: "project-viewer@preview.payloadbay.test", name: "Project Viewer Reviewer", role: "viewer" },
] as const;

/** An unrelated customer boundary for testing organization-wide administration. */
export const previewOrganizationAccount = { email: "organization-owner@preview.payloadbay.test", name: "Organization Owner Reviewer" } as const;
