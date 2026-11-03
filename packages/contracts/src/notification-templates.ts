export const builtinEmailSource = `export default async function sendNotification(ctx: NotificationContext): Promise<NotificationDecision> {
\treturn ctx.email(ctx.message);
}
`;

export const webhookChannelSource = `export default async function sendNotification(ctx: NotificationContext): Promise<NotificationDecision> {
\tconst response = await fetch(ctx.secrets.WEBHOOK_URL, {
\t\tmethod: "POST",
\t\theaders: { "content-type": "application/json" },
\t\tbody: JSON.stringify({ content: ctx.message.title }),
\t});

\treturn response.ok ? ctx.complete() : ctx.retry({ reason: "Notification destination did not accept the message" });
}
`;
