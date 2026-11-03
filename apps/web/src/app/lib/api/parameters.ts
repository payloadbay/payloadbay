import { z } from "zod";
import { AppError } from "@contracts/errors";

export function uuid(value: string) {
	const parsed = z.uuid().safeParse(value);
	if (!parsed.success) throw new AppError("invalid_input", 400, "Invalid resource identifier");

	return parsed.data;
}

export function version(request: Request) {
	const raw = request.headers.get("if-match");
	if (!raw || !/^"[1-9][0-9]*"$/.test(raw)) throw new AppError("version_required", 428, "Provide the current resource version");

	return Number(raw.slice(1, -1));
}
