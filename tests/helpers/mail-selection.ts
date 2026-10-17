export type FixtureMail = { ID: string; To: { Address: string }[]; Created?: string };

/** Mailpit's aggregate count can advance before its message index; match identity, not count. */
export function selectVerificationMail(messages: readonly FixtureMail[], recipient: string, previous: ReadonlySet<string>) {
	return messages.filter((message) => !previous.has(message.ID) && message.To.some((to) => to.Address.toLowerCase() === recipient.toLowerCase())).sort((a, b) => (b.Created ?? "").localeCompare(a.Created ?? ""))[0];
}
