import { useState } from "react";
import { Button } from "@heroui/react";
import { PressableFeedback } from "@components/ui/feedback";
import { ContextualSidebar } from "@components/ui/sidebar-navigation";
import { FileTree } from "@components/ui/file-tree";
import { fileNodes } from "./catalog-items";
import { IconFolder } from "@tabler/icons-react";
import { Carousel } from "@components/ui/carousel";
import { Resizable } from "@components/ui/resizable";
import { Timeline, ItemCard, ItemCardGroup, ListView } from "@components/ui/display";
import { SetupSteps } from "@components/ui/setup-steps";
import { ContextMenu } from "@components/ui/context-menu";
import { Sheet } from "@components/ui/sheet";
import { Markdown } from "@components/ui/content";
import { RichTextEditor } from "@components/ui/rich-text-editor";
import { Agenda, type AgendaEvent } from "@components/ui/agenda";
import { DataGrid } from "@components/ui/data-grid";
import type { JSONContent } from "@tiptap/react";

const entries = ["Receive", "Process", "Deliver"];
const manyRows = Array.from({ length: 500 }, (_, index) => ({ id: String(index), name: `Route ${index}`, count: index }));
const initialEvents: AgendaEvent[] = [
	{
		id: "one",
		title: "Editable event",
		start: new Date("2026-10-20T09:00:00Z"),
		end: new Date("2026-10-20T10:00:00Z"),
	},
];
const supported = new Set(["carousel", "resizable", "timeline", "item-card-group", "list-view", "stepper", "context-menu", "sheet", "markdown", "rich-text-editor", "agenda", "data-grid", "file-tree", "sidebar", "pressable-feedback"]);

export function ParityFixtures({ id }: { id: string }) {
	const [step, setStep] = useState(1);
	const [message, setMessage] = useState("");
	const [sheet, setSheet] = useState<string | null>(null);
	const [snap, setSnap] = useState(0.5);
	const [nested, setNested] = useState(false);
	const [document, setDocument] = useState<JSONContent>({ type: "doc", content: [{ type: "paragraph" }] });
	const [events, setEvents] = useState(initialEvents);

	if (!supported.has(id)) return null;
	let content;
	switch (id) {
		case "pressable-feedback":
			content = (
				<div className='flex gap-2'>
					<PressableFeedback progressDuration={400} resetDelay={200} progressDirection='down' onPress={() => setMessage("Completed")}>
						Click to confirm
					</PressableFeedback>
					<PressableFeedback feedback='highlight' onPress={() => setMessage("Highlight pressed")}>
						Highlight
					</PressableFeedback>
				</div>
			);
			break;
		case "file-tree":
			content = <FileTree label='Selectable files' items={fileNodes} defaultExpandedKeys={["src"]} selectionMode='multiple' onReorder={(keys, target) => setMessage(`${keys.join(",")} to ${target}`)} />;
			break;
		case "sidebar":
			content = (
				<ContextualSidebar
					label='Contextual resource navigation'
					collapsed={false}
					defaultPageId='root'
					pages={[
						{
							id: "root",
							title: "Instance",
							groups: [
								{
									label: "Resources",
									items: [
										{
											id: "project",
											label: "Project",
											href: "#project",
											pageId: "project",
											icon: <IconFolder size={16} />,
										},
									],
								},
							],
						},
						{
							id: "project",
							parentId: "root",
							title: "Project",
							groups: [
								{
									label: "Settings",
									items: [
										{
											id: "members",
											label: "Members",
											href: "#members",
											icon: <IconFolder size={16} />,
										},
									],
								},
							],
						},
					]}
				/>
			);
			break;
		case "carousel":
			content = (
				<Carousel
					label='Thumbnail carousel'
					direction='rtl'
					thumbnails={entries.map((title) => (
						<span key={title}>{title}</span>
					))}
					slides={entries.map((title) => (
						<div className='h-24 bg-default p-4' key={title}>
							{title}
						</div>
					))}
				/>
			);
			break;
		case "resizable":
			content = (
				<Resizable autoSaveId='parity-panels' orientation='vertical' style={{ height: 240 }}>
					<Resizable.Panel id='top' defaultSize={40} minSize={10} collapsible collapsedSize={0} onCollapse={() => setMessage("Collapsed")} onExpand={() => setMessage("Expanded")}>
						<p className='p-4'>Persistent upper panel</p>
					</Resizable.Panel>
					<Resizable.Handle type='pill' aria-label='Resize vertical panels' />
					<Resizable.Panel id='bottom'>
						<p className='p-4'>Lower panel</p>
					</Resizable.Panel>
				</Resizable>
			);
			break;
		case "timeline":
			content = (
				<Timeline
					placement='alternate'
					density='compact'
					items={entries.map((title, index) => ({
						id: title,
						title,
						status: index === 0 ? "complete" : index === 1 ? "current" : "default",
						description: "Event lifecycle",
					}))}
				/>
			);
			break;
		case "item-card-group":
			content = (
				<ItemCardGroup title='Grid collection' layout='grid'>
					{entries.map((title) => (
						<ItemCard key={title} title={title} description='Resource summary' />
					))}
				</ItemCardGroup>
			);
			break;
		case "list-view":
			content = (
				<ListView virtualized height={240} rowHeight={48} aria-label='Virtualized resources' items={manyRows}>
					{(row: (typeof manyRows)[number]) => (
						<ListView.Item id={row.id} textValue={row.name}>
							{row.name}
						</ListView.Item>
					)}
				</ListView>
			);
			break;
		case "stepper":
			content = <SetupSteps currentStep={step} onStepChange={setStep} orientation='vertical' items={entries.map((title) => ({ id: title, title, description: `Configure ${title.toLowerCase()}` }))} />;
			break;
		case "context-menu":
			content = (
				<ContextMenu
					label='Nested actions'
					items={[
						{
							id: "move",
							label: "Move to",
							children: [
								{ id: "project", label: "Project" },
								{ id: "workspace", label: "Workspace" },
							],
						},
					]}
					onAction={setMessage}
				>
					<div className='border border-dashed border-border p-8'>Right-click for nested actions</div>
				</ContextMenu>
			);
			break;
		case "sheet":
			content = (
				<div className='flex flex-wrap gap-2'>
					{(["left", "right", "top", "bottom"] as const).map((placement) => (
						<Button key={placement} variant='secondary' onPress={() => setSheet(placement)}>
							{placement} sheet
						</Button>
					))}
					<Sheet
						title='Snap sheet'
						placement={(sheet ?? "bottom") as "left" | "right" | "top" | "bottom"}
						open={sheet !== null}
						onOpenChange={(open) => {
							if (!open) setSheet(null);
						}}
						snapPoints={[0.3, 0.5, 0.85]}
						activeSnapPoint={snap}
						onActiveSnapPointChange={setSnap}
						isDetached
					>
						<p>Drag to resize, or use arrow keys on the handle.</p>
						<Button variant='secondary' onPress={() => setNested(true)}>
							Nested sheet
						</Button>
						<Sheet title='Nested sheet' open={nested} onOpenChange={setNested}>
							<p>Child sheet</p>
						</Sheet>
						<Button variant='secondary' onPress={() => setSnap(snap === 0.5 ? 0.85 : 0.5)}>
							Change snap point
						</Button>
					</Sheet>
				</div>
			);
			break;
		case "markdown":
			content = (
				<Markdown streaming isAnimating>
					{"## Streaming response\n\nAn incomplete **formatted phrase\n\n```ts\nconst result = "}
				</Markdown>
			);
			break;
		case "rich-text-editor":
			content = (
				<RichTextEditor
					label='Extended editor'
					value={document}
					onChange={setDocument}
					placeholder='Type / for commands'
					maxLength={200}
					bubbleMenu={<span>Selection tools</span>}
					floatingMenu={<span>Insert block</span>}
					suggestions={[
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
					]}
				/>
			);
			break;
		case "agenda":
			content = (
				<Agenda
					events={events}
					date={new Date("2026-10-20T09:00:00Z")}
					locale='en-GB'
					timeZone='Europe/Berlin'
					view='day'
					onEventMove={(id, start, end) => {
						setEvents((current) => current.map((entry) => (entry.id === id ? { ...entry, start, end } : entry)));
						setMessage(start.toISOString());
					}}
				/>
			);
			break;
		case "data-grid":
			content = (
				<DataGrid
					label='Virtualized routes'
					rows={manyRows}
					virtualized
					height={240}
					columns={[
						{
							key: "name",
							label: "Route",
							pinned: "start",
							width: 180,
						},
						{ key: "count", label: "Count", width: 300 },
					]}
					onLoadMore={() => setMessage("Load more requested")}
					onReorder={(ids, target, position) => setMessage(`${ids.join(",")} ${position} ${target}`)}
				/>
			);
			break;
	}

	return (
		<details className='mt-6 border-t border-border pt-4'>
			<summary className='cursor-pointer text-sm font-medium'>Additional interaction cases</summary>
			<div className='mt-4' data-parity-fixture={id}>
				{content}
				{message && (
					<p role='status' className='mt-2 text-sm text-muted'>
						{message}
					</p>
				)}
			</div>
		</details>
	);
}
