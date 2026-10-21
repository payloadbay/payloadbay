export type Body = string | Uint8Array;

export type ProviderResponse = { status: number; headers?: Record<string, string>; body: Body };

export type EventInput = { body: Body; contentType: string; metadata?: Record<string, unknown> };

export type IngressDecision = { kind: "accept"; event: EventInput; response: ProviderResponse } | { kind: "reject" | "respondOnly"; response: ProviderResponse };

export type ProcessingDecision = { kind: "complete" } | { kind: "retry"; reason: string; delayMs?: number } | { kind: "fail"; reason: string };

export type Log = { info(message: string, data?: Record<string, unknown>): void; warn(message: string, data?: Record<string, unknown>): void; error(message: string, data?: Record<string, unknown>): void };

export type IngressContext = {
	request: {
		body: Uint8Array;
		headers: Record<string, string>;
		contentType: string;
		method: string;
		url: string;
	};
	endpointId: string;
	receivedAt: string;
	secrets: Readonly<Record<string, string>>;
	log: Log;
	accept(value: { event: EventInput; response: ProviderResponse }): IngressDecision;
	reject(response: ProviderResponse): IngressDecision;
	respondOnly(response: ProviderResponse): IngressDecision;
};

export type DestinationTarget = string;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type SendInput = {
	operationId: string;
	body: Body;
	headers?: Record<string, string>;
	method?: HttpMethod;
};

export type DefaultSendInput = Omit<SendInput, "operationId" | "body"> & { operationId?: string; body?: Body };

export type DestinationClient = {
	send(input: DefaultSendInput): Promise<SendResult>;
	send(target: DestinationTarget, input: DefaultSendInput): Promise<SendResult>;
} & { [Method in Lowercase<HttpMethod>]: { (input?: DefaultSendInput): Promise<SendResult>; (target: DestinationTarget, input?: DefaultSendInput): Promise<SendResult> } };

export type SendResult = {
	ok: boolean;
	status?: number;
	networkError?: string;
	attemptId: string;
	response?: string;
	reused?: boolean;
};

export type ProcessingContext = {
	event: {
		id: string;
		body: Uint8Array;
		originalBody: Uint8Array;
		contentType: string;
		metadata: Record<string, unknown>;
	};
	executionId: string;
	generation: number;
	attempt: number;
	secrets: Readonly<Record<string, string>>;
	log: Log;
	destinations: DestinationClient;
	complete(): ProcessingDecision;
	retry(input: { reason: string; delayMs?: number }): ProcessingDecision;
	fail(input: { reason: string }): ProcessingDecision;
};

export type IngressMiddlewarePatch = { request?: { headers?: Record<string, string>; contentType?: string } };

export type ProcessingMiddlewarePatch = { event?: { body?: Body; contentType?: string; metadata?: Record<string, unknown> } };

export type IngressMiddlewareDecision = { kind: "continue"; patch?: IngressMiddlewarePatch } | IngressDecision;

export type ProcessingMiddlewareDecision = { kind: "continue"; patch?: ProcessingMiddlewarePatch } | ProcessingDecision;

export type IngressMiddlewareContext = IngressContext & { continue(patch?: IngressMiddlewarePatch): IngressMiddlewareDecision };

export type ProcessingMiddlewareContext = ProcessingContext & { continue(patch?: ProcessingMiddlewarePatch): ProcessingMiddlewareDecision };

export type MiddlewareDecision = IngressMiddlewareDecision | ProcessingMiddlewareDecision;

export type EmailContent = {
	subject: string;
	title: string;
	preview?: string;
	paragraphs: string[];
	code?: string;
	action?: { label: string; url: string };
	html?: string;
	text?: string;
};

export type EmailDecision = { kind: "email"; message: EmailContent };

export type NotificationDecision = EmailDecision | ProcessingDecision;

export type NotificationContext = {
	deliveryId: string;
	attempt: number;
	kind: "auth.login-code" | "auth.invitation" | "delivery.failure-threshold" | "channel.test";
	message: EmailContent;
	recipient: { email: string; name?: string };
	secrets: Readonly<Record<string, string>>;
	log: Log;
	email(message: EmailContent): EmailDecision;
	complete(): ProcessingDecision;
	retry(input: { reason: string; delayMs?: number }): ProcessingDecision;
	fail(input: { reason: string }): ProcessingDecision;
};
