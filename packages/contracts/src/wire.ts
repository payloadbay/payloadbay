// Transport tags: b = binary, a = array, o = object, u = undefined, v = plain value.
// Tagging every value prevents user-owned objects from being mistaken for binary wrappers.
// Keep these functions self-contained: wireRuntimeSource embeds them in workerd modules.
export function packWire(value: unknown): unknown {
	if (value instanceof Uint8Array) {
		const chunkSize = 32768;
		let binaryString = "";
		for (let offset = 0; offset < value.length; offset += chunkSize) {
			binaryString += String.fromCharCode(...value.subarray(offset, offset + chunkSize));
		}

		return ["b", btoa(binaryString)];
	}

	if (Array.isArray(value)) return ["a", value.map(packWire)];
	if (value !== null && typeof value === "object") {
		const entries = Object.entries(value).map(([key, item]) => [key, packWire(item)]);

		return ["o", entries];
	}

	if (value === undefined) return ["u"];
	if (value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return ["v", value];
	throw Error("Unsupported wire value");
}

export function unpackWire(encodedValue: unknown): unknown {
	if (!Array.isArray(encodedValue)) throw Error("Invalid wire value");
	const [tag, payload] = encodedValue;
	switch (tag) {
		case "b":
			if (typeof payload === "string") return Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
			break;
		case "u":
			return undefined;
		case "v":
			return payload;
		case "a":
			if (Array.isArray(payload)) return payload.map(unpackWire);
			break;
		case "o": {
			if (!Array.isArray(payload)) break;
			const decodedObject: Record<string, unknown> = {};
			for (const [key, item] of payload) {
				// Define own properties so keys such as __proto__ remain ordinary user data.
				Object.defineProperty(decodedObject, key, {
					value: unpackWire(item),
					enumerable: true,
					writable: true,
					configurable: true,
				});
			}

			return decodedObject;
		}
	}

	throw Error("Invalid wire value");
}

export const wireRuntimeSource = `export const packWire=${packWire.toString()};\nexport const unpackWire=${unpackWire.toString()};`;
