import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export function encryptPrivate(value: unknown, masterKey: string): Buffer {
	const iv = randomBytes(12);
	const key = createHash("sha256").update(masterKey).digest();
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);

	return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptPrivate<T>(value: Buffer, masterKey: string): T {
	if (value.length < 28) throw Error("Invalid encrypted payload");
	const key = createHash("sha256").update(masterKey).digest();
	const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
	decipher.setAuthTag(value.subarray(12, 28));

	return JSON.parse(Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8")) as T;
}
