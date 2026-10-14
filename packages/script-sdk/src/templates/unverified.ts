export const unverifiedTemplate = {
	name: "Explicitly unverified",
	description: "Accepts incoming requests without signature verification. Use deliberately for public or otherwise protected sources.",
	stage: "ingress" as const,
	body: `return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"Accepted"}});`,
};
