export const componentGroups = {
	Charts: ["area-chart", "bar-chart", "chart", "chart-tooltip", "composed-chart", "line-chart", "pie-chart", "radar-chart", "radial-chart", "tooltip"],
	"Data display": ["agenda", "action-bar", "carousel", "data-grid", "empty-state", "file-tree", "floating-toc", "hover-card", "item-card", "item-card-group", "kpi", "kpi-group", "list-view", "timeline", "widget"],
	"Content and feedback": ["code-block", "markdown", "text-shimmer", "number-value", "pressable-feedback", "trend-chip", "resizable"],
	Forms: ["cell-color-picker", "cell-select", "cell-slider", "cell-switch", "checkbox-button-group", "drop-zone", "inline-select", "native-select", "number-stepper", "radio-button-group", "rich-text-editor"],
	"Navigation and overlays": ["app-layout", "command", "context-menu", "navbar", "segment", "sidebar", "stepper", "emoji-picker", "sheet"],
};

export const componentIds = Object.values(componentGroups).flat();

export const componentName = (id: string) =>
	id
		.split("-")
		.map((word) => (word === "kpi" ? "KPI" : word === "toc" ? "TOC" : word[0].toUpperCase() + word.slice(1)))
		.join(" ");

export const chartPoints = [
	{ hour: "08:00", accepted: 12, failed: 2 },
	{ hour: "09:00", accepted: 25, failed: 4 },
	{ hour: "10:00", accepted: 18, failed: 1 },
	{ hour: "11:00", accepted: 34, failed: 3 },
	{ hour: "12:00", accepted: 28, failed: 2 },
];

export const choices = [
	{ id: "active", label: "Active" },
	{ id: "paused", label: "Paused" },
	{ id: "archived", label: "Archived" },
];

export const fileNodes = [
	{
		id: "src",
		name: "src",
		children: [
			{ id: "handlers", name: "handlers", children: [{ id: "ingress", name: "ingress.ts" }] },
			{ id: "helpers", name: "helpers.ts" },
		],
	},
	{ id: "readme", name: "README.md" },
];

export const gridRows = [
	{
		id: "one",
		name: "Orders",
		events: 1240,
		status: "Active",
	},
	{
		id: "two",
		name: "Payments",
		events: 890,
		status: "Paused",
	},
	{
		id: "three",
		name: "Alerts",
		events: 320,
		status: "Active",
	},
];

export const exampleCode = "export async function POST(ctx) {\n\treturn ctx.accept({ body: await ctx.request.json() });\n}\n";

export const exampleMarkdown = "# Delivery health\n\n**Accepted** requests are queued for delivery.\n\n- Retries are automatic\n- [View documentation](https://payloadbay.dev)\n\n| Route | Status |\n| --- | --- |\n| Orders | Healthy |\n\n> Keep production credentials out of previews.\n\n```typescript\nexport const accepted = true;\n```";

export const editorDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Notify your team when a delivery needs attention." }] }] };
