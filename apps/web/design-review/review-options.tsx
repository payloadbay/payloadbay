import { useState, useEffect, type CSSProperties } from "react";
import { Label, ListBox, Select } from "@heroui/react";

export const defaultOptions = {
	motion: "enabled",
	accent: "brand",
	surface: "surface",
	side: "left",
};

export type ReviewOptions = typeof defaultOptions;

const choices = {
	motion: [
		["enabled", "Animated"],
		["system", "Follow device"],
		["reduced", "Reduced motion"],
	],
	accent: [
		["brand", "Brand blue"],
		["success", "Success green"],
		["warning", "Warning amber"],
	],
	surface: [
		["surface", "Raised surface"],
		["background", "Page background"],
	],
	side: [
		["left", "Left"],
		["right", "Right"],
	],
};

const labels = {
	motion: "Motion",
	accent: "Accent",
	surface: "Navigation surface",
	side: "Navigation side",
};

export function useReviewOptions() {
	const [options, setOptions] = useState(() => {
		const params = new URLSearchParams(location.search);

		return Object.fromEntries(Object.entries(defaultOptions).map(([key, value]) => [key, choices[key as keyof ReviewOptions].some(([id]) => id === params.get(key)) ? params.get(key)! : value])) as ReviewOptions;
	});

	const style = {
		"--pb-step-accent": options.accent === "brand" ? "var(--accent)" : `var(--${options.accent})`,
		"--pb-step-foreground": options.accent === "brand" ? "var(--accent-foreground)" : `var(--${options.accent}-foreground)`,
		"--pb-navigation-background": `var(--${options.surface})`,
	} as CSSProperties;

	useEffect(() => {
		const url = new URL(location.href);
		Object.entries(options).forEach(([key, value]) => url.searchParams.set(key, value));
		history.replaceState(null, "", url);
		if (window.parent !== window) window.parent.postMessage({ type: "review-options", options }, location.origin);
	}, [options]);

	useEffect(() => {
		document.documentElement.style.setProperty("--pb-navigation-background", `var(--${options.surface})`);
	}, [options.surface]);

	useEffect(() => {
		let active = true;
		// Let the open selector finish closing before changing its motion rules.
		const animations = [...document.querySelectorAll('[data-slot="select-popover"]')].flatMap((element) => element.getAnimations());
		Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
			if (active) document.documentElement.dataset.reviewMotion = options.motion;
		});

		return () => {
			active = false;
		};
	}, [options.motion]);

	useEffect(() => {
		const receive = (event: MessageEvent) => {
			if (event.origin === location.origin && event.source === window.parent && event.data?.type === "review-options") setOptions(event.data.options);
		};

		window.addEventListener("message", receive);

		return () => window.removeEventListener("message", receive);
	}, []);

	return { options, setOptions, style };
}

export function ReviewControls({ options, onChange }: { options: ReviewOptions; onChange: (options: ReviewOptions) => void }) {
	return (
		<section aria-label='Comparison options' className='grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4'>
			{(Object.keys(choices) as (keyof ReviewOptions)[]).map((key) => (
				<Select key={key} variant='secondary' aria-label={labels[key]} value={options[key]} onChange={(value) => onChange({ ...options, [key]: String(value) })}>
					<Label>{labels[key]}</Label>
					<Select.Trigger>
						<Select.Value />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							{choices[key].map(([id, text]) => (
								<ListBox.Item key={id} id={id} textValue={text}>
									{text}
								</ListBox.Item>
							))}
						</ListBox>
					</Select.Popover>
				</Select>
			))}
		</section>
	);
}
