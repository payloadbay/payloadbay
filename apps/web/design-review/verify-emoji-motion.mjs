import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const results = [];
try {
	for (const side of ["catalog-pro", "catalog"])
		for (const reducedMotion of ["no-preference", "reduce"]) {
			const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion });
			await page.goto(`http://localhost:4173/${side}.html?component=emoji-picker`);
			await page.evaluate(
				(selector) => {
					window.emojiFrames = [];
					const observer = new MutationObserver(() => {
						const element = document.querySelector(selector);
						if (!element) return;
						observer.disconnect();
						const start = performance.now();

						function sample() {
							const style = getComputedStyle(element);
							window.emojiFrames.push({ opacity: Number(style.opacity), scale: style.transform === "none" ? 1 : new DOMMatrixReadOnly(style.transform).m11 });
							if (performance.now() - start < 300) requestAnimationFrame(sample);
						}

						requestAnimationFrame(sample);
					});
					observer.observe(document.body, { childList: true, subtree: true });
				},
				side === "catalog-pro" ? "[data-slot=emoji-picker-popover]" : ".pb-emoji-popover",
			);
			await page.getByRole("button", { name: "Choose emoji" }).click();
			await expect.poll(() => page.evaluate(() => window.emojiFrames.length)).toBeGreaterThan(10);
			const frames = await page.evaluate(() => window.emojiFrames);
			if (reducedMotion === "no-preference") {
				expect(frames.some((frame) => frame.opacity > 0 && frame.opacity < 1)).toBe(true);
				expect(frames.some((frame) => frame.scale > 0.95 && frame.scale < 1)).toBe(true);
			} else expect(frames.every((frame) => frame.opacity === 1 && frame.scale === 1)).toBe(true);
			expect(frames.at(-1)).toEqual({ opacity: 1, scale: 1 });
			results.push({ side, reducedMotion, frames });
			console.log("PASS", side, reducedMotion, "emoji animation");
			await page.close();
		}

	await writeFile("/tmp/pab-round2-emoji-motion.json", JSON.stringify(results, null, 2));
} finally {
	await browser.close();
}
