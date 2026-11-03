import { z } from "zod";

export const scriptTestInput = z
	.object({
		stage: z.enum(["ingress", "processing"]),
		includeMiddleware: z.boolean().default(true),
		assertionSource: z.string().max(32768).default(""),
		expectations: z
			.object({ decision: z.enum(["accept", "reject", "respondOnly", "complete", "retry", "fail"]).optional(), status: z.number().int().min(100).max(599).optional(), bodyContains: z.string().min(1).max(8192).optional() })
			.strict()
			.default({}),
		body: z.string().max(131072),
		sharedBindings: z
			.record(z.string(), z.uuid())
			.refine((value) => Object.keys(value).length <= 32)
			.default({}),
		fixture: z
			.object({
				body: z.string().refine((value) => Buffer.byteLength(value) <= 1048576),
				contentType: z.string().min(1).max(256).default("application/json"),
				method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).default("POST"),
				headers: z
					.record(z.string(), z.string())
					.refine((value) => Buffer.byteLength(JSON.stringify(value)) <= 16384)
					.default({}),
				secrets: z
					.record(z.string(), z.string())
					.refine((value) => Buffer.byteLength(JSON.stringify(value)) <= 65536)
					.default({}),
			})
			.strict(),
	})
	.strict();

export const savedScriptTestInput = z.object({ name: z.string().trim().min(1).max(100), version: z.number().int().min(0), definition: scriptTestInput.omit({ body: true, sharedBindings: true }) }).strict();

export const scriptTestContextDeclaration = `
type ScriptTestContext = {
 decision: {kind:string};
 response: {status:number|null;body:string};
 test: (name:string,run:()=>void|Promise<void>)=>Promise<void>;
 expect:(actual:unknown)=>{toBe(expected:unknown):void;toEqual(expected:unknown):void;toContain(expected:string):void;toBeTruthy():void};
};
`;

export const exampleAssertionSource = `export default async function testResponse({ response, test, expect }: ScriptTestContext) {
	await test("Returns a successful response", () => {
		expect(response.status).toBe(202);
	});
}
`;

export type SavedScriptTestDefinition = z.infer<typeof savedScriptTestInput>["definition"];
