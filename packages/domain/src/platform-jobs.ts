/** Scheduling class is owned by trusted job kind, never webhook payload data. */
export function platformJobPriority(kind: string) {
	if (kind === "event_retention") return 1000;
	if (kind === "otp_mail" || kind === "invitation_mail") return 10;

	return 30;
}
