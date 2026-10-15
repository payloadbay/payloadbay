// Build-only diagnostics for the vendor CLI, which otherwise prints [object Object].
// Never log request headers, URLs, response bodies or credential-bearing errors.
const originalFetch = globalThis.fetch;

globalThis.fetch = async (...arguments_) => {
	try {
		const response = await originalFetch(...arguments_);

		if (!response.ok) {
			console.error(`HeroUI installer HTTP request failed (${response.status}). Check the CI/CD token, license access and vendor availability.`);
		}

		return response;
	} catch {
		throw new Error("HeroUI installer network request failed. Check outbound connectivity and TLS trust.");
	}
};
