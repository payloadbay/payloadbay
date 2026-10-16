/** Fixed synthetic identity used only by the disposable PR demo. */
export const previewReviewerEmail = "reviewer@preview.payloadbay.test";

/** Additional identities exercise real scoped access through the normal OTP flow. */
export const previewProjectAccounts = [
	{ email: "project-admin@preview.payloadbay.test", name: "Project Admin Reviewer", role: "admin" },
	{ email: "project-viewer@preview.payloadbay.test", name: "Project Viewer Reviewer", role: "viewer" },
] as const;
