export const catalogVariants: Record<string, readonly string[]> = {
	agenda: ["week", "day", "month"],
	"floating-toc": ["default", "press", "hierarchical", "left"],
	timeline: ["default", "centered-milestones", "studio-review", "compact-log", "incident-response", "version-history", "repository-activity", "split-content"],
	carousel: ["default", "thumbnails"],
	resizable: ["line", "pill", "drag", "vertical"],
	"number-value": ["decimal", "currency", "percent", "compact"],
	"number-stepper": ["default", "currency", "disabled"],
	"cell-select": ["default", "disabled"],
	"cell-slider": ["default", "disabled"],
	"cell-color-picker": ["default", "disabled"],
	"native-select": ["default", "full-width", "disabled"],
	"inline-select": ["default", "disabled"],
	"drop-zone": ["default", "disabled"],
	"rich-text-editor": ["default", "slash-commands", "read-only"],
	navbar: ["default", "floating"],
};

export function variantLabel(value: string) {
	return value
		.split("-")
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join(" ");
}

export function firstVariant(id: string) {
	return catalogVariants[id]?.[0] ?? "default";
}

export function formatVariant(variant: string): Intl.NumberFormatOptions {
	if (variant === "currency") return { style: "currency", currency: "EUR" };
	if (variant === "percent") return { style: "percent", maximumFractionDigits: 1 };
	if (variant === "compact") return { notation: "compact", maximumFractionDigits: 1 };

	return { maximumFractionDigits: 2 };
}
