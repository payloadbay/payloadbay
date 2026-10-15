export const hmacTemplate = {
	name: "Generic HMAC SHA-256",
	description: "Verifies x-payloadbay-signature as hexadecimal HMAC SHA-256 of the raw request body. Bind SIGNING_SECRET before publishing.",
	stage: "ingress" as const,
	body: `const secret = ctx.secrets.SIGNING_SECRET;
if (!secret) return ctx.reject({status:503,body:"Signing secret is not configured"});
const header = ctx.request.headers["x-payloadbay-signature"] ?? "";
if (!/^[0-9a-f]{64}$/i.test(header)) return ctx.reject({status:401,body:"Invalid signature"});
const signature = Uint8Array.from(header.match(/../g)!, value => parseInt(value,16));
const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
const verified = await crypto.subtle.verify("HMAC",key,signature,new Uint8Array(ctx.request.body).buffer);
if (!verified) return ctx.reject({status:401,body:"Invalid signature"});
return ctx.accept({event:{body:ctx.request.body,contentType:ctx.request.contentType},response:{status:202,body:"Accepted"}});`,
};

export const hmacHttpTemplate = {
	...hmacTemplate,
	source: `export async function POST(ctx: IngressContext): Promise<IngressDecision> {
${hmacTemplate.body}
}`,
};
