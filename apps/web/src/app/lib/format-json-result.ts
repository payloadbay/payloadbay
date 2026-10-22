/** Render binary values for inspection without changing the underlying result. */
export function formatJsonResult(result: unknown) {
	return JSON.stringify(
		result,
		function (this: Record<string, unknown>, key: string, value: unknown) {
			if (!(value instanceof Uint8Array)) return value;
			try {
				const text = new TextDecoder("utf-8", { fatal: true }).decode(value);
				const contentType = typeof this.contentType === "string" ? this.contentType.split(";", 1)[0].trim().toLowerCase() : "";
				if (key === "body" && (contentType === "application/json" || contentType === "text/json" || contentType.endsWith("+json"))) {
					try {
						return JSON.parse(text) as unknown;
					} catch {
						// Keep malformed JSON visible as the original text.
					}
				}

				return text;
			} catch {
				let binary = "";
				for (let offset = 0; offset < value.length; offset += 32768) binary += String.fromCharCode(...value.subarray(offset, offset + 32768));

				return { encoding: "base64", data: btoa(binary) };
			}
		},
		2,
	);
}
