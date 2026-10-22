import type { ReactNode } from "react";
import { Card, Chip } from "@heroui/react";
import { IconCheck, IconGitBranch, IconClock, IconAlertTriangle, IconFlag, IconCode, IconMessage } from "@tabler/icons-react";
import type { TimelineEntry } from "@components/ui/display";

export const tocItems = [
	{ id: "toc-overview", label: "Overview", level: 1 },
	{ id: "toc-installation", label: "Installation", level: 1 },
	{ id: "toc-configuration", label: "Configuration", level: 1 },
	{ id: "toc-delivery", label: "Delivery", level: 2 },
	{ id: "toc-retries", label: "Retries", level: 2 },
	{ id: "toc-reference", label: "API reference", level: 1 },
];

export function TocArticle() {
	return (
		<article className='space-y-6 text-sm'>
			{tocItems.map((item) => (
				<section id={item.id} key={item.id}>
					<h3 className='font-medium'>{item.label}</h3>
					<p className='mt-1 text-muted'>Manage webhook traffic and delivery for your project.</p>
				</section>
			))}
		</article>
	);
}

export const flowSlides = ["Receive", "Process", "Deliver"];

export function CarouselSlide({ title, index }: { title: string; index: number }) {
	return (
		<div className='flex h-48 flex-col items-center justify-center gap-3 bg-default'>
			<IconGitBranch size={32} className='text-accent' />
			<h3 className='text-xl font-semibold'>{title}</h3>
			<span className='text-sm text-muted'>Step {index + 1} of your webhook flow</span>
		</div>
	);
}

export function timelineExample(variant: string): {
	items: TimelineEntry[];
	axis: "start" | "center";
	placement: "start" | "end" | "alternate";
	density: "compact" | "comfortable";
	size: "sm" | "md" | "lg";
} {
	const compact = variant === "compact-log" || variant === "repository-activity";
	const centered = ["centered-milestones", "studio-review", "split-content"].includes(variant);
	const titles = variant === "version-history" ? ["Version 1 published", "Version 2 published", "Version 3 active"] : variant === "incident-response" ? ["Delivery errors detected", "Mitigation in progress", "Service recovered"] : variant === "repository-activity" ? ["Helper updated", "Review approved", "Changes merged"] : variant === "studio-review" ? ["Draft created", "Design reviewed", "Ready to publish"] : ["Request received", "Processing completed", "Delivered"];

	const items: TimelineEntry[] = titles.map((title, index) => ({
		id: `event-${index}`,
		title,
		time: `09:15:0${index + 1}`,
		dateTime: `2026-10-20T09:15:0${index + 1}Z`,
		status: variant === "incident-response" && index === 0 ? "warning" : index === 2 ? "current" : "success",
		icon: variant === "version-history" ? <IconCode size={14} /> : variant === "repository-activity" ? index === 1 ? <IconMessage size={14} /> : <IconGitBranch size={14} /> : variant === "centered-milestones" ? <IconFlag size={14} /> : index === 0 && variant === "incident-response" ? <IconAlertTriangle size={14} /> : index === 2 ? <IconClock size={14} /> : <IconCheck size={14} />,
		description:
			variant === "studio-review" ? (
				<Card variant='secondary'>
					<Card.Header>
						<Card.Title>{index === 0 ? "Draft proposal" : index === 1 ? "Review feedback" : "Approved design"}</Card.Title>
						<Card.Description>Notification workflow</Card.Description>
					</Card.Header>
					<Card.Content>
						<p className='text-sm'>Keep the response and delivery states clear for reviewers.</p>
					</Card.Content>
				</Card>
			) : variant === "version-history" ? (
				<div className='space-y-2'>
					<p>Publication v{index + 1}</p>
					<pre className='w-full min-w-0 max-w-full overflow-auto rounded-lg bg-default p-3 text-xs'>
						<code>{`export const version = ${index + 1};`}</code>
					</pre>
				</div>
			) : compact ? undefined : (
				<p>{index === 0 ? "Webhook accepted for processing." : index === 1 ? "The configured script completed successfully." : "The destination returned HTTP 202."}</p>
			),
		oppositeContent:
			variant === "split-content" ? (
				<pre className='w-full min-w-0 max-w-full overflow-auto rounded-lg bg-default p-3 text-xs'>
					<code>{`{ "execution": ${index + 1},
  "status": "completed" }`}</code>
				</pre>
			) : undefined,
	}));

	return {
		items,
		axis: centered ? "center" : "start",
		placement: centered ? "alternate" : "end",
		density: compact ? "compact" : "comfortable",
		size: variant === "centered-milestones" ? "lg" : compact ? "sm" : "md",
	};
}

export function TimelineContent({ item }: { item: TimelineEntry }): ReactNode {
	return (
		<article className='grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2'>
			<div className='flex flex-wrap items-center gap-2'>
				<h3 className='text-sm font-medium'>{item.title}</h3>
				{item.status === "current" && (
					<Chip size='sm' color='accent' variant='soft'>
						<Chip.Label>Current</Chip.Label>
					</Chip>
				)}
			</div>
			{item.time && (
				<time dateTime={item.dateTime} className='text-xs text-muted'>
					{item.time}
				</time>
			)}
			{item.description && <div className='col-span-2 text-sm text-muted'>{item.description}</div>}
		</article>
	);
}

export const editorSuggestions: import("@components/ui/rich-text-editor").EditorSuggestion[] = [
	{
		id: "heading",
		title: "Heading",
		command: (editor, range) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
		},
	},
	{
		id: "list",
		title: "Bullet list",
		command: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		id: "quote",
		title: "Quote",
		command: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run();
		},
	},
];

export const emptyEditorDocument = { type: "doc", content: [{ type: "paragraph" }] };

export const reviewNavigation = [
	{
		label: "Settings",
		items: [
			{
				id: "overview",
				label: "Overview",
				href: "#overview",
				icon: <IconFlag size={16} />,
			},
			{
				id: "members",
				label: "Members",
				href: "#members",
				icon: <IconMessage size={16} />,
			},
		],
	},
	{
		label: "Observe and troubleshoot",
		items: [
			{
				id: "events",
				label: "Event log",
				href: "#events",
				icon: <IconGitBranch size={16} />,
			},
		],
	},
];
