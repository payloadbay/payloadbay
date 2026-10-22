import { AgendaCallbacks } from "./agenda-callbacks";
import { StylingFixtures } from "./styling-fixtures";
import { ParityFixtures } from "./parity-fixtures";
import { reviewNavigation, timelineExample, TimelineContent, tocItems, TocArticle, flowSlides, CarouselSlide, editorSuggestions, emptyEditorDocument } from "./review-examples";
import { useCalendarDemo } from "./calendar-demo";
import { formatVariant } from "./catalog-variants";
import type { JSONContent } from "@tiptap/react";
import { CatalogPage } from "./catalog-page";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import { IconFolder, IconWebhook, IconBell } from "@tabler/icons-react";
import { AreaChart, BarChart, ChartTooltip, ChartTooltipRow, ComposedChart, LineChart, PieChart, RadarChart, RadialChart } from "@components/ui/charts";
import { CellColorPicker, CellSelect, CellSlider, CellSwitch, CheckboxButtonGroup, InlineSelect, NativeSelect, NumberStepper, RadioButtonGroup } from "@components/ui/cell-controls";
import { ItemCard, ItemCardGroup, KPI, KPIGroup, ListView, Timeline, Widget } from "@components/ui/display";
import { NumberValue, PressableFeedback, TextShimmer, TrendChip } from "@components/ui/feedback";
import { CodeBlock, Markdown } from "@components/ui/content";
import { RichTextEditor } from "@components/ui/rich-text-editor";
import { DropZone } from "@components/ui/drop-zone";
import { Carousel } from "@components/ui/carousel";
import { Resizable } from "@components/ui/resizable";
import { DataGrid } from "@components/ui/data-grid";
import { FileTree } from "@components/ui/file-tree";
import { FloatingToc } from "@components/ui/floating-toc";
import { Agenda } from "@components/ui/agenda";
import { ActionBar } from "@components/ui/action-bar";
import { Segment } from "@components/ui/segment";
import { HoverCard } from "@components/ui/hover-card";
import { ContextMenu } from "@components/ui/context-menu";
import { Sheet } from "@components/ui/sheet";
import { Navbar } from "@components/ui/navbar";
import { EmojiPicker } from "@components/ui/emoji-picker";
import { DashboardLayout } from "@components/ui/dashboard-layout";
import { SidebarNavigation } from "@components/ui/sidebar-navigation";
import { SetupSteps } from "@components/ui/setup-steps";
import { ResourceEmptyState } from "@components/ui/resource-empty-state";
import { CommandSearch } from "@components/ui/command-search";
import { useNavigationSearch } from "@components/ui/use-navigation-search";
import { chartPoints, choices, gridRows, fileNodes, editorDocument, exampleCode, exampleMarkdown } from "./catalog-items";

function Charts({ id }: { id: string }) {
	if (id === "chart-tooltip")
		return (
			<ChartTooltip title='09:00'>
				<ChartTooltipRow label='Accepted' value='25' color='var(--success)' />
				<ChartTooltipRow label='Failed' value='4' color='var(--danger)' />
			</ChartTooltip>
		);
	if (id === "pie-chart")
		return (
			<PieChart label='Delivery outcomes'>
				<PieChart.Pie
					data={[
						{ name: "Accepted", value: 92 },
						{ name: "Failed", value: 8 },
					]}
					dataKey='value'
					innerRadius='55%'
					outerRadius='80%'
					paddingAngle={3}
					isAnimationActive={false}
				>
					<PieChart.Cell fill='var(--success)' />
					<PieChart.Cell fill='var(--danger)' />
				</PieChart.Pie>
				<PieChart.Tooltip />
				<PieChart.Legend />
			</PieChart>
		);
	if (id === "radar-chart")
		return (
			<RadarChart
				label='Route performance'
				data={[
					{ label: "Latency", value: 75 },
					{ label: "Success", value: 95 },
					{ label: "Capacity", value: 65 },
					{ label: "Availability", value: 90 },
					{ label: "Throughput", value: 80 },
				]}
			>
				<RadarChart.PolarGrid stroke='var(--border)' />
				<RadarChart.PolarAngleAxis dataKey='label' tick={{ fill: "var(--muted)", fontSize: 11 }} />
				<RadarChart.Radar dataKey='value' name='Health' stroke='var(--accent)' fill='var(--accent)' fillOpacity={0.15} isAnimationActive={false} />
				<RadarChart.Tooltip />
			</RadarChart>
		);
	if (id === "radial-chart")
		return (
			<RadialChart label='Delivery success 92 percent' data={[{ name: "Success", value: 92, fill: "var(--success)" }]} innerRadius='65%' outerRadius='90%' startAngle={90} endAngle={-270}>
				<RadialChart.PolarAngleAxis type='number' domain={[0, 100]} tick={false} />
				<RadialChart.RadialBar dataKey='value' background={{ fill: "var(--default)" }} cornerRadius={8} isAnimationActive={false} />
				<RadialChart.Tooltip />
			</RadialChart>
		);
	if (id === "area-chart")
		return (
			<AreaChart data={chartPoints} label='Accepted requests'>
				<AreaChart.Grid />
				<AreaChart.XAxis dataKey='hour' />
				<AreaChart.YAxis allowDecimals={false} />
				<AreaChart.Area dataKey='accepted' name='Accepted' stroke='var(--accent)' fill='var(--accent)' fillOpacity={0.12} type='monotone' strokeWidth={2} isAnimationActive={false} />
				<AreaChart.Tooltip />
			</AreaChart>
		);
	if (id === "bar-chart")
		return (
			<BarChart data={chartPoints} label='Delivery counts'>
				<BarChart.Grid />
				<BarChart.XAxis dataKey='hour' />
				<BarChart.YAxis allowDecimals={false} />
				<BarChart.Bar dataKey='accepted' name='Accepted' fill='var(--accent)' radius={[4, 4, 0, 0]} isAnimationActive={false} />
				<BarChart.Bar dataKey='failed' name='Failed' fill='var(--danger)' radius={[4, 4, 0, 0]} isAnimationActive={false} />
				<BarChart.Tooltip />
			</BarChart>
		);
	if (id === "composed-chart")
		return (
			<ComposedChart data={chartPoints} label='Traffic and failures'>
				<ComposedChart.Grid />
				<ComposedChart.XAxis dataKey='hour' />
				<ComposedChart.YAxis allowDecimals={false} />
				<ComposedChart.Bar dataKey='accepted' name='Accepted' fill='var(--accent)' fillOpacity={0.3} isAnimationActive={false} />
				<ComposedChart.Line dataKey='failed' name='Failed' stroke='var(--danger)' strokeWidth={2} isAnimationActive={false} />
				<ComposedChart.Tooltip />
			</ComposedChart>
		);

	return (
		<LineChart data={chartPoints} label='Accepted requests'>
			<LineChart.Grid />
			<LineChart.XAxis dataKey='hour' />
			<LineChart.YAxis allowDecimals={false} />
			<LineChart.Line dataKey='accepted' name='Accepted' stroke='var(--accent)' strokeWidth={2} dot={false} type='monotone' isAnimationActive={false} />
			<LineChart.Tooltip />
		</LineChart>
	);
}

function LocalAgendaPreview({ variant }: { variant: string }) {
	const demo = useCalendarDemo();

	const [view, setView] = useState<"day" | "week" | "month">(variant === "day" ? "day" : variant === "month" ? "month" : "week");

	return (
		<>
			<div className='mb-3 flex justify-end'>
				<Button size='sm' variant='secondary' onPress={() => demo.edit()}>
					Add event
				</Button>
			</div>
			<Agenda
				events={demo.events}
				view={view}
				onViewChange={(next) => {
					if (next !== "list") setView(next);
				}}
				onEventCreate={({ start, end }) => demo.create(start, end)}
				onEventMove={(id, start, end) => {
					const event = demo.events.find((entry) => entry.id === id);
					if (event) demo.update({ ...event, start, end });
				}}
				onEventResize={(id, start, end) => {
					const event = demo.events.find((entry) => entry.id === id);
					if (event) demo.update({ ...event, start, end });
				}}
				selectedEventId={demo.selected}
				onEventSelect={demo.select}
			/>
			<p role='status' className='mt-3 text-sm text-muted'>
				{demo.selected ? `Selected: ${demo.events.find((event) => event.id === demo.selected)?.title}` : "No event selected"}
			</p>
			{demo.dialog}
		</>
	);
}

function Example({ id, variant = "default" }: { id: string; variant?: string }) {
	const [status, setStatus] = useState("active");
	const [number, setNumber] = useState(24);
	const [selected, setSelected] = useState(["ingress"]);
	const [enabled, setEnabled] = useState(true);
	const [files, setFiles] = useState<File[]>([]);
	const [message, setMessage] = useState("");
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState(0);
	const [emoji, setEmoji] = useState("😀");
	const [document, setDocument] = useState<JSONContent>(variant === "slash-commands" ? emptyEditorDocument : editorDocument);

	const overlays = useNavigationSearch();

	const groups = reviewNavigation;

	const choiceOptions = [
		{ value: "ingress", label: "Ingress", description: "Incoming requests" },
		{ value: "processing", label: "Processing", description: "Delivery handling" },
	];
	let body;
	if (["area-chart", "bar-chart", "chart", "chart-tooltip", "composed-chart", "line-chart", "pie-chart", "radar-chart", "radial-chart"].includes(id)) body = <Charts id={id} />;
	else
		switch (id) {
			case "tooltip":
				body = (
					<Tooltip delay={0}>
						<Button variant='secondary'>Hover or focus me</Button>
						<Tooltip.Content>Keyboard and pointer help</Tooltip.Content>
					</Tooltip>
				);
				break;
			case "cell-select":
				body = <CellSelect isDisabled={variant === "disabled"} label='Status' value={status} onChange={(key) => setStatus(String(key))} options={choices} />;
				break;
			case "inline-select":
				body = <InlineSelect isDisabled={variant === "disabled"} label='Status' value={status} onChange={(key) => setStatus(String(key))} options={choices} />;
				break;
			case "native-select":
				body = (
					<NativeSelect fullWidth={variant === "full-width"} disabled={variant === "disabled"} label='Status' value={status} onChange={(event) => setStatus(event.target.value)}>
						{choices.map((item) => (
							<option key={item.id} value={item.id}>
								{item.label}
							</option>
						))}
					</NativeSelect>
				);
				break;
			case "cell-slider":
				body = <CellSlider isDisabled={variant === "disabled"} label='Concurrency' value={number} onChange={(value) => setNumber(Number(value))} minValue={0} maxValue={100} />;
				break;
			case "cell-switch":
				body = <CellSwitch label='Enabled' isSelected={enabled} onChange={setEnabled} />;
				break;
			case "cell-color-picker":
				body = <CellColorPicker isDisabled={variant === "disabled"} label='Accent' defaultValue='#1979e7' />;
				break;
			case "checkbox-button-group":
				body = <CheckboxButtonGroup label='Stages' value={selected} onChange={setSelected} options={choiceOptions} />;
				break;
			case "radio-button-group":
				body = <RadioButtonGroup label='Stage' value={["ingress", "processing"].includes(status) ? status : "ingress"} onChange={setStatus} options={choiceOptions} />;
				break;
			case "number-stepper":
				body = <NumberStepper formatOptions={variant === "currency" ? formatVariant(variant) : undefined} isDisabled={variant === "disabled"} label='Retries' value={number} onChange={setNumber} minValue={0} maxValue={30} />;
				break;
			case "drop-zone":
				body = <DropZone isDisabled={variant === "disabled"} label='Upload fixtures' value={files} onChange={setFiles} acceptedFileTypes={["application/json", ".json"]} maxFileSize={1024 * 1024} maxFiles={3} />;
				break;
			case "rich-text-editor":
				body = <RichTextEditor label='Notification message' value={document} onChange={setDocument} isReadOnly={variant === "read-only"} suggestions={variant === "slash-commands" ? editorSuggestions : undefined} placeholder='Type / for commands' />;
				break;
			case "code-block":
				body = <CodeBlock code={exampleCode} language='typescript' />;
				break;
			case "markdown":
				body = <Markdown>{exampleMarkdown}</Markdown>;
				break;
			case "text-shimmer":
				body = <TextShimmer>Preparing your delivery report…</TextShimmer>;
				break;
			case "number-value":
				body = <NumberValue value={variant === "percent" ? 0.1234 : 12345.67} format={formatVariant(variant)} locales='en-US' className='text-4xl font-semibold' />;
				break;

			case "pressable-feedback":
				body = (
					<div className='flex flex-wrap gap-3'>
						<PressableFeedback onPress={() => setMessage("Action completed")}>Press me</PressableFeedback>
						<PressableFeedback holdDuration={800} onPress={() => setMessage("Confirmed")}>
							Hold to confirm
						</PressableFeedback>
					</div>
				);
				break;
			case "trend-chip":
				body = (
					<div className='flex gap-3'>
						<TrendChip trend='up'>+12.3%</TrendChip>
						<TrendChip trend='down'>-2.1%</TrendChip>
						<TrendChip trend='neutral'>0.0%</TrendChip>
					</div>
				);
				break;
			case "resizable":
				body = (
					<Resizable orientation={variant === "vertical" ? "vertical" : "horizontal"} style={{ height: 240 }}>
						<Resizable.Panel defaultSize={35} minSize={20}>
							<div className='h-full bg-default p-4'>Resources</div>
						</Resizable.Panel>
						<Resizable.Handle type={variant === "drag" ? "drag" : variant === "pill" ? "pill" : "line"} withIndicator={variant !== "line"} aria-label='Resize panels' />
						<Resizable.Panel>
							<div className='p-4'>Selected resource</div>
						</Resizable.Panel>
					</Resizable>
				);
				break;

			case "carousel":
				body = (
					<Carousel
						label='Project tips'
						slides={flowSlides.map((title, index) => (
							<CarouselSlide title={title} index={index} key={title} />
						))}
						thumbnails={
							variant === "thumbnails"
								? flowSlides.map((title) => (
										<span className='text-xs' key={title}>
											{title}
										</span>
									))
								: undefined
						}
					/>
				);
				break;

			case "file-tree":
				body = <FileTree label='Project files' items={fileNodes} defaultExpandedKeys={["src"]} onAction={setMessage} />;
				break;
			case "data-grid":
				body = (
					<DataGrid
						label='Routes'
						rows={gridRows}
						columns={[
							{ key: "name", label: "Route" },
							{ key: "events", label: "Events" },
							{ key: "status", label: "Status" },
						]}
						selectionMode='multiple'
					/>
				);
				break;
			case "item-card":
				body = (
					<ItemCard
						icon={<IconWebhook size={20} />}
						title='Orders webhook'
						description='Receives completed orders'
						action={
							<Button size='sm' variant='secondary' onPress={() => setMessage("Opened orders")}>
								Open
							</Button>
						}
					/>
				);
				break;
			case "item-card-group":
				body = (
					<ItemCardGroup title='Integrations' description='Manage connected resources'>
						<ItemCard
							icon={<IconWebhook size={20} />}
							title='Orders webhook'
							description='Receives completed orders'
							action={
								<Button size='sm' variant='secondary' onPress={() => setMessage("Opened orders")}>
									Open
								</Button>
							}
						/>
						<ItemCard icon={<IconBell size={20} />} title='Notifications' description='Delivery alerts' />
					</ItemCardGroup>
				);
				break;
			case "kpi":
				body = <KPI title='Accepted requests' value={12450} description='Compared with the previous period' trend={{ direction: "up", label: "+12.3%" }} chart={<KPI.Chart data={chartPoints} dataKey='accepted' color='var(--accent)' />} />;
				break;
			case "kpi-group":
				body = (
					<KPIGroup>
						<KPI chart={<KPI.Chart data={chartPoints} dataKey='accepted' color='var(--accent)' />} title='Accepted requests' value={12450} description='Compared with the previous period' trend={{ direction: "up", label: "+12.3%" }} />
						<KPI chart={<KPI.Chart data={chartPoints} dataKey='failed' color='var(--danger)' />} title='Failed' value={18} trend={{ direction: "down", label: "-4.1%" }} />
					</KPIGroup>
				);
				break;
			case "widget":
				body = (
					<Widget>
						<Widget.Header>
							<Widget.Title>Traffic health</Widget.Title>
							<Widget.Legend>
								<Widget.LegendItem color='var(--accent)'>Accepted requests</Widget.LegendItem>
							</Widget.Legend>
						</Widget.Header>
						<Widget.Content>
							<Charts id='area-chart' />
						</Widget.Content>
					</Widget>
				);
				break;
			case "list-view":
				body = (
					<ListView aria-label='Resources' selectionMode='multiple'>
						{gridRows.map((row) => (
							<ListView.Item key={row.id} id={row.id} textValue={row.name}>
								<IconFolder size={18} />
								<div>
									<strong className='text-sm font-medium'>{row.name}</strong>
									<p className='text-xs text-muted'>{row.events} events</p>
								</div>
							</ListView.Item>
						))}
					</ListView>
				);
				break;
			case "timeline": {
				const example = timelineExample(variant);
				body = <Timeline {...example} items={example.items.map((item) => ({ ...item, content: <TimelineContent item={item} /> }))} />;
				break;
			}

			case "empty-state":
				body = <ResourceEmptyState title='No projects yet' description='Create a project to start receiving and delivering webhooks.' icon={<IconFolder size={20} />} action={<Button onPress={() => setMessage("Create project selected")}>Create project</Button>} />;
				break;
			case "action-bar":
				body = (
					<div>
						<Button variant='secondary' onPress={() => setNumber(number ? 0 : 3)}>
							Toggle selection
						</Button>
						<ActionBar count={number ? 3 : 0} onClear={() => setNumber(0)}>
							<Button size='sm' variant='ghost' onPress={() => setMessage("Export selected")}>
								Export
							</Button>
							<Button size='sm' variant='ghost' className='text-danger' onPress={() => setMessage("Delete selected")}>
								Delete
							</Button>
						</ActionBar>
					</div>
				);
				break;
			case "segment":
				body = <Segment label='Status view' value={status} onChange={setStatus} items={choices} />;
				break;
			case "hover-card":
				body = (
					<HoverCard label='Orders project'>
						<strong className='font-medium'>Orders project</strong>
						<p className='mt-2 text-sm text-muted'>3 endpoints. Last delivery succeeded.</p>
						<Button className='mt-3' variant='secondary' size='sm' onPress={() => setMessage("Project opened")}>
							Open project
						</Button>
					</HoverCard>
				);
				break;
			case "context-menu":
				body = (
					<ContextMenu
						label='Resource actions'
						items={[
							{ id: "open", label: "Open" },
							{ id: "rename", label: "Rename" },
							{ id: "delete", label: "Delete", danger: true },
						]}
						onAction={setMessage}
					>
						<div className='rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted'>Right-click, long-press, or use Shift+F10</div>
					</ContextMenu>
				);
				break;
			case "emoji-picker":
				body = <EmojiPicker value={emoji} onChange={setEmoji} />;
				break;
			case "sheet":
				body = (
					<>
						<Button onPress={() => setOpen(true)}>Open sheet</Button>
						<Sheet
							title='Delivery details'
							open={open}
							onOpenChange={setOpen}
							footer={
								<Button variant='secondary' onPress={() => setOpen(false)}>
									Done
								</Button>
							}
						>
							<p className='text-sm text-muted'>Drag the handle down to dismiss, or use the close action.</p>
						</Sheet>
					</>
				);
				break;
			case "navbar":
				body = (
					<Navbar
						brand='Payload Bay'
						position={variant === "floating" ? "floating" : "static"}
						links={[
							{ href: "#overview", label: "Overview" },
							{ href: "#projects", label: "Projects" },
						]}
						activeHref='#overview'
					/>
				);
				break;
			case "stepper":
				body = (
					<div className='flex flex-col gap-6'>
						<SetupSteps currentStep={step} items={["Owner identity", "Verify email", "Create workspace"]} />
						<div className='flex justify-between'>
							<Button variant='secondary' isDisabled={step === 0} onPress={() => setStep(step - 1)}>
								Back
							</Button>
							<Button onPress={() => setStep(step === 2 ? 0 : step + 1)}>{step === 2 ? "Reset" : "Continue"}</Button>
						</div>
					</div>
				);
				break;
			case "command":
				body = <CommandSearch open={overlays.searchOpen} onOpenChange={overlays.onSearchOpenChange} items={gridRows.map((row) => ({ id: row.id, label: row.name, icon: <IconFolder size={16} /> }))} onAction={setMessage} />;
				break;
			case "sidebar":
			case "app-layout":
				body = (
					<DashboardLayout
						className='pb-review-layout'
						background='var(--background)'
						fullscreen={false}
						brand='Payload Bay'

						navigationLabel='Project navigation'
						open={overlays.navigationOpen}
						onOpenChange={overlays.onNavigationOpenChange}
						onClosed={overlays.onNavigationClosed}
						navigation={(collapsed) => (
							<SidebarNavigation
								label='Project navigation'
								title='Orders project'
								collapsed={collapsed}
								groups={groups}
								activeId={status}
								onNavigate={(event, item) => {
									if (event.ctrlKey || event.metaKey) return;
									event.preventDefault();
									setStatus(item.id);
									overlays.onNavigationOpenChange(false);
								}}
							/>
						)}
					>
						<div className='p-4'>{status === "members" ? "Members" : status === "events" ? "Event log" : "Overview"}</div>
					</DashboardLayout>
				);
				break;
			case "floating-toc":
				body = (
					<div className='relative flex min-h-96 items-center justify-between gap-5'>
						<TocArticle />
						<div className={variant === "left" ? "order-first" : ""}>
							<FloatingToc items={tocItems.map((item) => ({ ...item, level: variant === "hierarchical" ? item.level : 1 }))} activeId={message || tocItems[0].id} onNavigate={setMessage} placement={variant === "left" ? "left" : "right"} trigger={variant === "press" ? "click" : "hover"} />
						</div>
					</div>
				);
				break;

			case "agenda":
				body = <LocalAgendaPreview variant={variant} />;
				break;

			default:
				body = <p>Unknown component.</p>;
		}

	return (
		<>
			{body}

			{message && (
				<p role='status' className='mt-4 text-sm text-muted'>
					{message}
				</p>
			)}
		</>
	);
}

const fixture = new URLSearchParams(location.search).get("fixture");
createRoot(document.getElementById("root")!).render(fixture ? <main className='p-6'>{fixture === "agenda-callbacks" ? <AgendaCallbacks /> : fixture === "styling-props" ? <StylingFixtures /> : <ParityFixtures id={fixture} />}</main> : <CatalogPage Example={Example} />);
