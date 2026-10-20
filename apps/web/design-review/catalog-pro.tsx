import { reviewNavigation, timelineExample, TimelineContent, tocItems, TocArticle, flowSlides, CarouselSlide, editorSuggestions, emptyEditorDocument } from "./review-examples";
import { formatVariant } from "./catalog-variants";
import emojiData from "@emoji-mart/data";
import type { EmojiMartData } from "@emoji-mart/data";
import { Legend } from "recharts";
import { CatalogPage } from "./catalog-page";
import { createRoot } from "react-dom/client";
import { useState, useContext } from "react";
import { ColorPickerStateContext } from "react-aria-components";
import { Button, Description, ColorArea, ColorSlider, ColorField, Label, ListBox, SearchField, Tooltip } from "@heroui/react";
import { useCalendarDemo } from "./calendar-demo";
import { CalendarDateTime } from "@internationalized/date";
import { IconFolder, IconWebhook, IconBell, IconBold, IconItalic, IconStrikethrough, IconH2, IconList, IconListNumbers, IconCode, IconArrowBackUp, IconArrowForwardUp } from "@tabler/icons-react";
import { Agenda, useAgenda, ActionBar, ChartTooltip, Command, ContextMenu, DataGrid, DropZone, EmojiPicker, EmptyState, FileTree, FloatingToc, HoverCard, ItemCard, ItemCardGroup, KPIGroup, ListView, Navbar, NativeSelect, NumberValue, PressableFeedback, RadioButtonGroup, Segment, Sheet, Sidebar, AppLayout, Stepper, TextShimmer, Timeline, TrendChip, Widget, EMOJI_SKIN_TONES, CellColorPicker, CellSelect, CellSlider, CellSwitch, CheckboxButtonGroup, InlineSelect } from "@heroui-pro/react";
import { AreaChart } from "@heroui-pro/react/area-chart";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { ComposedChart } from "@heroui-pro/react/composed-chart";
import { LineChart } from "@heroui-pro/react/line-chart";
import { PieChart } from "@heroui-pro/react/pie-chart";
import { RadarChart } from "@heroui-pro/react/radar-chart";
import { RadialChart } from "@heroui-pro/react/radial-chart";
import { Carousel } from "@heroui-pro/react/carousel";
import { KPI } from "@heroui-pro/react/kpi";
import { CodeBlock } from "@heroui-pro/react/code-block";
import { Markdown } from "@heroui-pro/react/markdown";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { RichTextEditor } from "@heroui-pro/react/rich-text-editor";
import { Resizable } from "@heroui-pro/react/resizable";
import { chartPoints, choices, gridRows, editorDocument, exampleCode, exampleMarkdown } from "./catalog-items";

function ReferenceHexField() {
	const state = useContext(ColorPickerStateContext);

	return (
		<ColorField
			aria-label='Hex color'
			value={state?.color}
			onChange={(color) => {
				if (color) state?.setColor(color);
			}}
		>
			<Label>Hex color</Label>
			<ColorField.Group variant='secondary'>
				<ColorField.Input />
			</ColorField.Group>
		</ColorField>
	);
}

function AgendaPreview({ variant }: { variant: string }) {
	const demo = useCalendarDemo();

	const dt = (value: Date) => new CalendarDateTime(value.getFullYear(), value.getMonth() + 1, value.getDate(), value.getHours(), value.getMinutes());

	const date = (value: CalendarDateTime) => new Date(value.year, value.month - 1, value.day, value.hour, value.minute);

	const agenda = useAgenda({
		events: demo.events.map((event) => ({ ...event, start: dt(event.start), end: dt(event.end) })),
		defaultView: variant === "day" ? "day" : variant === "month" ? "month" : "week",
		onEventCreate: ({ start, end }) => demo.create(date(start), date(end)),
		onEventSelect: demo.select,
		selectedEventId: demo.selected,
		onEventMove: (id, start, end) => {
			const event = demo.events.find((entry) => entry.id === id);
			if (event) demo.update({ ...event, start: date(start), end: date(end) });
		},
		onEventResize: (id, start, end) => {
			const event = demo.events.find((entry) => entry.id === id);
			if (event) demo.update({ ...event, start: date(start), end: date(end) });
		},
	});

	return (
		<>
			<div className='mb-3 flex justify-end'>
				<Button size='sm' variant='secondary' onPress={() => demo.edit()}>
					Add event
				</Button>
			</div>
			<div className='h-[600px]'>
				<Agenda {...agenda}>
					<Agenda.Header>
						<Agenda.Heading />
						<Agenda.ViewSelector />
						<Agenda.Navigation>
							<Agenda.NavButton slot='previous' />
							<Agenda.TodayButton />
							<Agenda.NavButton slot='next' />
						</Agenda.Navigation>
					</Agenda.Header>
					<Agenda.Body>
						{agenda.view === "month" ? (
							<Agenda.MonthGrid>
								{agenda.visibleWeeks.map((week, index) => (
									<Agenda.MonthRow key={index}>
										{week.map((day) => (
											<Agenda.MonthCell key={day.toString()} date={day}>
												{agenda.getPerCellEvents(day, week).map((event) => (
													<Agenda.MonthEvent key={event.id} event={event} />
												))}
											</Agenda.MonthCell>
										))}
									</Agenda.MonthRow>
								))}
							</Agenda.MonthGrid>
						) : (
							<>
								<Agenda.WeekHeader>
									{agenda.visibleDays.map((day) => (
										<Agenda.DayHeader key={day.toString()} date={day} className={agenda.view === "week" ? "max-sm:h-12 max-sm:flex-col max-sm:gap-1 max-sm:py-1" : undefined} />
									))}
								</Agenda.WeekHeader>
								<Agenda.TimeGrid>
									<Agenda.CurrentTimeIndicator />
									{agenda.visibleDays.map((day) => (
										<Agenda.DayColumn key={day.toString()} date={day}>
											{agenda.getEventsForDay(day).map((event) => (
												<Agenda.Event key={event.id} event={event} />
											))}
										</Agenda.DayColumn>
									))}
								</Agenda.TimeGrid>
							</>
						)}
					</Agenda.Body>
				</Agenda>
			</div>
			<p role='status' className='mt-3 text-sm text-muted'>
				{demo.selected ? `Selected: ${demo.events.find((event) => event.id === demo.selected)?.title}` : "No event selected"}
			</p>
			{demo.dialog}
		</>
	);
}

function Example({ id, variant = "default" }: { id: string; variant?: string }) {
	const [selectedEmoji, setSelectedEmoji] = useState("grinning");
	const [skinTone, setSkinTone] = useState("default");
	const [status, setStatus] = useState("active");
	const [number, setNumber] = useState(24);
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState(0);
	const [message, setMessage] = useState("");

	let body;
	switch (id) {
		case "area-chart":
			body = (
				<AreaChart data={chartPoints} height={240}>
					<AreaChart.Grid vertical={false} />
					<AreaChart.XAxis dataKey='hour' />
					<AreaChart.YAxis allowDecimals={false} />
					<AreaChart.Area dataKey='accepted' name='Accepted' stroke='var(--accent)' fill='var(--accent)' fillOpacity={0.12} strokeWidth={2} type='monotone' isAnimationActive={false} />
					<AreaChart.Tooltip content={<AreaChart.TooltipContent />} />
				</AreaChart>
			);
			break;
		case "bar-chart":
			body = (
				<BarChart data={chartPoints} height={240}>
					<BarChart.Grid vertical={false} />
					<BarChart.XAxis dataKey='hour' />
					<BarChart.YAxis allowDecimals={false} />
					<BarChart.Bar dataKey='accepted' name='Accepted' fill='var(--accent)' radius={[4, 4, 0, 0]} isAnimationActive={false} />
					<BarChart.Bar dataKey='failed' name='Failed' fill='var(--danger)' radius={[4, 4, 0, 0]} isAnimationActive={false} />
					<BarChart.Tooltip content={<BarChart.TooltipContent />} />
				</BarChart>
			);
			break;
		case "composed-chart":
			body = (
				<ComposedChart data={chartPoints} height={240}>
					<ComposedChart.Grid vertical={false} />
					<ComposedChart.XAxis dataKey='hour' />
					<ComposedChart.YAxis allowDecimals={false} />
					<ComposedChart.Bar dataKey='accepted' name='Accepted' fill='var(--accent)' fillOpacity={0.3} isAnimationActive={false} />
					<ComposedChart.Line dataKey='failed' name='Failed' stroke='var(--danger)' strokeWidth={2} isAnimationActive={false} />
					<ComposedChart.Tooltip content={<ComposedChart.TooltipContent />} />
				</ComposedChart>
			);
			break;
		case "chart":
		case "line-chart":
			body = (
				<LineChart data={chartPoints} height={240}>
					<LineChart.Grid vertical={false} />
					<LineChart.XAxis dataKey='hour' />
					<LineChart.YAxis allowDecimals={false} />
					<LineChart.Line dataKey='accepted' name='Accepted' stroke='var(--accent)' strokeWidth={2} dot={false} type='monotone' isAnimationActive={false} />
					<LineChart.Tooltip content={<LineChart.TooltipContent />} />
				</LineChart>
			);
			break;
		case "pie-chart":
			body = (
				<PieChart height={240}>
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
					<PieChart.Tooltip content={<PieChart.TooltipContent />} />
					<Legend />
				</PieChart>
			);
			break;
		case "radar-chart":
			body = (
				<RadarChart
					data={[
						{ label: "Latency", value: 75 },
						{ label: "Success", value: 95 },
						{ label: "Capacity", value: 65 },
						{ label: "Availability", value: 90 },
						{ label: "Throughput", value: 80 },
					]}
					height={240}
				>
					<RadarChart.Grid />
					<RadarChart.AngleAxis dataKey='label' />
					<RadarChart.Radar dataKey='value' name='Health' stroke='var(--accent)' fill='var(--accent)' fillOpacity={0.15} isAnimationActive={false} />
					<RadarChart.Tooltip content={<RadarChart.TooltipContent />} />
				</RadarChart>
			);
			break;
		case "radial-chart":
			body = (
				<RadialChart height={240} data={[{ name: "Success", value: 92, fill: "var(--success)" }]} innerRadius='65%' outerRadius='90%' startAngle={90} endAngle={-270}>
					<RadialChart.AngleAxis type='number' domain={[0, 100]} tick={false} />
					<RadialChart.Bar dataKey='value' background={{ fill: "var(--default)" }} cornerRadius={8} isAnimationActive={false} />
					<RadialChart.Tooltip content={<RadialChart.TooltipContent />} />
				</RadialChart>
			);
			break;
		case "chart-tooltip":
			body = (
				<ChartTooltip>
					<ChartTooltip.Header>09:00</ChartTooltip.Header>
					{[
						{ label: "Accepted", value: 25, color: "var(--success)" },
						{ label: "Failed", value: 4, color: "var(--danger)" },
					].map((row) => (
						<ChartTooltip.Item key={row.label}>
							<ChartTooltip.Indicator color={row.color} />
							<ChartTooltip.Label>{row.label}</ChartTooltip.Label>
							<ChartTooltip.Value>{row.value}</ChartTooltip.Value>
						</ChartTooltip.Item>
					))}
				</ChartTooltip>
			);
			break;
		case "tooltip":
			body = (
				<Tooltip delay={0}>
					<Button variant='secondary'>Hover or focus me</Button>
					<Tooltip.Content>Keyboard and pointer help</Tooltip.Content>
				</Tooltip>
			);
			break;
		case "agenda":
			body = <AgendaPreview variant={variant} />;
			break;
		case "action-bar":
			body = (
				<>
					<Button variant='secondary' onPress={() => setNumber(number ? 0 : 3)}>
						Toggle selection
					</Button>
					<ActionBar isOpen={number > 0}>
						<ActionBar.Prefix>{number ? 3 : 0} selected</ActionBar.Prefix>
						<ActionBar.Content>
							<Button size='sm' variant='ghost' onPress={() => setMessage("Export selected")}>
								Export
							</Button>
							<Button size='sm' variant='ghost' className='text-danger' onPress={() => setMessage("Delete selected")}>
								Delete
							</Button>
						</ActionBar.Content>
						<ActionBar.Suffix>
							<Button size='sm' variant='ghost' onPress={() => setNumber(0)}>
								Clear
							</Button>
						</ActionBar.Suffix>
					</ActionBar>
				</>
			);
			break;
		case "carousel":
			body = (
				<Carousel>
					<Carousel.Content>
						{flowSlides.map((title, index) => (
							<Carousel.Item key={title}>
								<CarouselSlide title={title} index={index} />
							</Carousel.Item>
						))}
					</Carousel.Content>
					<Carousel.Previous />
					<Carousel.Next />
					{variant === "thumbnails" ? (
						<Carousel.Thumbnails>
							{flowSlides.map((title, index) => (
								<Carousel.Thumbnail key={title} index={index} alt={title}>
									<span className='text-xs'>{title}</span>
								</Carousel.Thumbnail>
							))}
						</Carousel.Thumbnails>
					) : (
						<Carousel.Dots />
					)}
				</Carousel>
			);
			break;

		case "data-grid":
			body = (
				<div className='flex flex-col gap-3'>
					<SearchField variant='secondary' aria-label='Search Routes' value={status === "active" ? "" : status} onChange={setStatus}>
						<SearchField.Group>
							<SearchField.SearchIcon />
							<SearchField.Input placeholder='Search rows…' />
							<SearchField.ClearButton aria-label='Clear search' />
						</SearchField.Group>
					</SearchField>
					<DataGrid
						aria-label='Routes'
						getRowId={(row) => row.id}
						data={gridRows.filter((row) => status === "active" || Object.values(row).some((value) => String(value).toLowerCase().includes(status.toLowerCase())))}
						columns={[
							{
								id: "name",
								header: "Route",
								accessorKey: "name",
								isRowHeader: true,
								allowsSorting: true,
							},
							{
								id: "events",
								header: "Events",
								accessorKey: "events",
								allowsSorting: true,
							},
							{
								id: "status",
								header: "Status",
								accessorKey: "status",
								allowsSorting: true,
							},
						]}
						selectionMode='multiple'
						showSelectionCheckboxes
						allowsColumnResize
					/>
				</div>
			);
			break;
		case "empty-state":
			body = (
				<EmptyState>
					<EmptyState.Header>
						<EmptyState.Media variant='icon'>
							<IconFolder size={24} />
						</EmptyState.Media>
						<EmptyState.Title>No projects yet</EmptyState.Title>
						<EmptyState.Description>Create a project to start receiving and delivering webhooks.</EmptyState.Description>
					</EmptyState.Header>
					<Button onPress={() => setMessage("Create project selected")}>Create project</Button>
				</EmptyState>
			);
			break;
		case "file-tree":
			body = (
				<FileTree aria-label='Project files' defaultExpandedKeys={["src"]}>
					<FileTree.Item id='src' title='src' textValue='src'>
						<FileTree.Item id='handlers' title='handlers' textValue='handlers'>
							<FileTree.Item id='ingress' title='ingress.ts' textValue='ingress.ts' />
						</FileTree.Item>
						<FileTree.Item id='helpers' title='helpers.ts' textValue='helpers.ts' />
					</FileTree.Item>
					<FileTree.Item id='readme' title='README.md' textValue='README.md' />
				</FileTree>
			);
			break;
		case "floating-toc":
			body = (
				<div className='relative flex min-h-96 items-center justify-between gap-5'>
					<TocArticle />
					<div className={variant === "left" ? "order-first" : ""}>
						<FloatingToc placement={variant === "left" ? "left" : "right"} triggerMode={variant === "press" ? "press" : "hover"}>
							<FloatingToc.Trigger aria-label='Table of contents'>
								{tocItems.map((item) => (
									<FloatingToc.Bar key={item.id} active={item.id === (message || tocItems[0].id)} level={variant === "hierarchical" ? item.level : 1} />
								))}
							</FloatingToc.Trigger>
							<FloatingToc.Content>
								{tocItems.map((item) => (
									<FloatingToc.Item key={item.id} active={item.id === (message || tocItems[0].id)} level={variant === "hierarchical" ? item.level : 1} onClick={() => setMessage(item.id)}>
										{item.label}
									</FloatingToc.Item>
								))}
							</FloatingToc.Content>
						</FloatingToc>
					</div>
				</div>
			);
			break;

		case "hover-card":
			body = (
				<HoverCard>
					<HoverCard.Trigger>
						<Button variant='ghost' className='text-accent underline'>
							Orders project
						</Button>
					</HoverCard.Trigger>
					<HoverCard.Content>
						<strong>Orders project</strong>
						<p className='mt-2 text-sm text-muted'>3 endpoints. Last delivery succeeded.</p>
						<Button className='mt-3' variant='secondary' size='sm' onPress={() => setMessage("Project opened")}>
							Open project
						</Button>
					</HoverCard.Content>
				</HoverCard>
			);
			break;
		case "item-card":
		case "item-card-group": {
			const item = (
				<ItemCard>
					<ItemCard.Icon>
						<IconWebhook size={20} />
					</ItemCard.Icon>
					<ItemCard.Content>
						<ItemCard.Title>Orders webhook</ItemCard.Title>
						<ItemCard.Description>Receives completed orders</ItemCard.Description>
					</ItemCard.Content>
					<ItemCard.Action>
						<Button size='sm' variant='secondary' onPress={() => setMessage("Opened orders")}>
							Open
						</Button>
					</ItemCard.Action>
				</ItemCard>
			);
			body =
				id === "item-card" ? (
					item
				) : (
					<ItemCardGroup>
						<ItemCardGroup.Header>
							<ItemCardGroup.Title>Integrations</ItemCardGroup.Title>
							<ItemCardGroup.Description>Manage connected resources</ItemCardGroup.Description>
						</ItemCardGroup.Header>
						{item}
						<ItemCard>
							<ItemCard.Icon>
								<IconBell size={20} />
							</ItemCard.Icon>
							<ItemCard.Content>
								<ItemCard.Title>Notifications</ItemCard.Title>
								<ItemCard.Description>Delivery alerts</ItemCard.Description>
							</ItemCard.Content>
						</ItemCard>
					</ItemCardGroup>
				);
			break;
		}

		case "kpi":
		case "kpi-group": {
			const one = (
				<KPI>
					<KPI.Header>
						<KPI.Title>Accepted requests</KPI.Title>
					</KPI.Header>
					<KPI.Content>
						<KPI.Value value={12450} />
						<KPI.Trend trend='up'>+12.3%</KPI.Trend>
					</KPI.Content>
					<KPI.Chart data={chartPoints} dataKey='accepted' color='var(--accent)' />
					<KPI.Footer>
						<p className='text-xs text-muted'>Compared with the previous period</p>
					</KPI.Footer>
				</KPI>
			);
			body =
				id === "kpi" ? (
					one
				) : (
					<KPIGroup>
						{one}
						<KPI>
							<KPI.Header>
								<KPI.Title>Failed</KPI.Title>
							</KPI.Header>
							<KPI.Content>
								<KPI.Value value={18} />
								<KPI.Trend trend='down'>-4.1%</KPI.Trend>
							</KPI.Content>
							<KPI.Chart data={chartPoints} dataKey='failed' color='var(--danger)' />
						</KPI>
					</KPIGroup>
				);
			break;
		}

		case "list-view":
			body = (
				<ListView aria-label='Resources' selectionMode='multiple'>
					{gridRows.map((row) => (
						<ListView.Item key={row.id} id={row.id} textValue={row.name}>
							<ListView.ItemContent>
								<IconFolder size={18} />
								<div className='flex flex-col'>
									<ListView.Title>{row.name}</ListView.Title>
									<ListView.Description>{row.events} events</ListView.Description>
								</div>
							</ListView.ItemContent>
						</ListView.Item>
					))}
				</ListView>
			);
			break;
		case "timeline": {
			const example = timelineExample(variant);
			body = (
				<Timeline axis={example.axis} placement={example.placement} density={example.density} size={example.size}>
					{example.items.map((item, index) => (
						<Timeline.Item key={item.id} status={item.status === "complete" ? "success" : item.status}>
							<Timeline.Rail>
								<Timeline.Marker>{item.icon}</Timeline.Marker>
								<Timeline.Connector />
							</Timeline.Rail>
							<Timeline.Content className='w-full min-w-0'>
								<TimelineContent item={item} />
							</Timeline.Content>
							{item.oppositeContent && (
								<Timeline.Content className='w-full min-w-0' side={index % 2 === 0 ? "start" : "end"}>
									{item.oppositeContent}
								</Timeline.Content>
							)}
						</Timeline.Item>
					))}
				</Timeline>
			);
			break;
		}

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
						<AreaChart data={chartPoints} height={240}>
							<AreaChart.Grid vertical={false} />
							<AreaChart.YAxis allowDecimals={false} />
							<AreaChart.XAxis dataKey='hour' />
							<AreaChart.Area dataKey='accepted' name='Accepted' stroke='var(--accent)' fill='var(--accent)' fillOpacity={0.12} type='monotone' strokeWidth={2} isAnimationActive={false} />
							<AreaChart.Tooltip content={<AreaChart.TooltipContent />} />
						</AreaChart>
					</Widget.Content>
				</Widget>
			);
			break;
		case "code-block":
			body = (
				<CodeBlock>
					<CodeBlock.Header>
						<span className='text-xs uppercase text-muted'>typescript</span>
						<CodeBlock.CopyButton code={exampleCode} />
					</CodeBlock.Header>
					<CodeBlock.Code code={exampleCode} language='typescript' theme='github-dark' />
				</CodeBlock>
			);
			break;
		case "markdown":
			body = <Markdown>{exampleMarkdown}</Markdown>;
			break;
		case "text-shimmer":
			body = <TextShimmer>Preparing your delivery report…</TextShimmer>;
			break;
		case "number-value":
			body = <NumberValue value={variant === "percent" ? 0.1234 : 12345.67} formatOptions={formatVariant(variant)} locale='en-US' className='text-4xl font-semibold' />;
			break;

		case "pressable-feedback":
			body = (
				<div className='flex flex-wrap gap-3'>
					<Button onPress={() => setMessage("Action completed")}>
						<PressableFeedback.Ripple />
						Press me
					</Button>
					<Button>
						<PressableFeedback.HoldConfirm duration={800} onComplete={() => setMessage("Confirmed")}>
							<span className='h-full w-full bg-accent-foreground/20' />
						</PressableFeedback.HoldConfirm>
						Hold to confirm
					</Button>
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

		case "cell-color-picker":
			body = (
				<CellColorPicker aria-label='Accent' defaultValue='#1979e7'>
					<CellColorPicker.Trigger isDisabled={variant === "disabled"}>
						<CellColorPicker.Label>Accent</CellColorPicker.Label>
						<CellColorPicker.ValueDisplay />
						<CellColorPicker.Swatch />
					</CellColorPicker.Trigger>
					<CellColorPicker.Popover className='w-[260px] max-w-[calc(100vw-32px)]'>
						<ColorArea className='h-[190px] w-full max-w-none' aria-label='Color saturation and brightness' colorSpace='hsb' xChannel='saturation' yChannel='brightness'>
							<ColorArea.Thumb />
						</ColorArea>
						<ColorSlider className='w-full' aria-label='Hue' channel='hue' colorSpace='hsb'>
							<ColorSlider.Track>
								<ColorSlider.Thumb />
							</ColorSlider.Track>
						</ColorSlider>
						<ReferenceHexField />
					</CellColorPicker.Popover>
				</CellColorPicker>
			);
			break;
		case "cell-select":
			body = (
				<CellSelect isDisabled={variant === "disabled"} aria-label='Status' value={status} onChange={(key) => setStatus(String(key))}>
					<CellSelect.Trigger>
						<CellSelect.Label>Status</CellSelect.Label>
						<CellSelect.Value />
						<CellSelect.Indicator />
					</CellSelect.Trigger>
					<CellSelect.Popover>
						<ListBox>
							{choices.map((item) => (
								<ListBox.Item key={item.id} id={item.id}>
									{item.label}
								</ListBox.Item>
							))}
						</ListBox>
					</CellSelect.Popover>
				</CellSelect>
			);
			break;
		case "inline-select":
			body = (
				<InlineSelect isDisabled={variant === "disabled"} aria-label='Status' value={status} onChange={(key) => setStatus(String(key))}>
					<InlineSelect.Trigger>
						<InlineSelect.Value />
						<InlineSelect.Indicator />
					</InlineSelect.Trigger>
					<InlineSelect.Popover>
						<ListBox>
							{choices.map((item) => (
								<ListBox.Item key={item.id} id={item.id}>
									{item.label}
								</ListBox.Item>
							))}
						</ListBox>
					</InlineSelect.Popover>
				</InlineSelect>
			);
			break;
		case "cell-slider":
			body = (
				<CellSlider isDisabled={variant === "disabled"} aria-label='Concurrency' value={number} onChange={(value) => setNumber(Number(value))} minValue={0} maxValue={100}>
					<CellSlider.Track>
						<CellSlider.Fill />
						<CellSlider.Thumb />
						<CellSlider.Label>Concurrency</CellSlider.Label>
						<CellSlider.Output />
					</CellSlider.Track>
				</CellSlider>
			);
			break;
		case "cell-switch":
			body = (
				<CellSwitch aria-label='Enabled' defaultSelected>
					<CellSwitch.Trigger>
						<CellSwitch.Label>Enabled</CellSwitch.Label>
						<CellSwitch.Control />
					</CellSwitch.Trigger>
				</CellSwitch>
			);
			break;
		case "checkbox-button-group":
			body = (
				<CheckboxButtonGroup name='stages' defaultValue={["ingress"]} variant='secondary'>
					<Label>Stages</Label>
					{["ingress", "processing"].map((stage) => (
						<CheckboxButtonGroup.Item key={stage} value={stage}>
							<CheckboxButtonGroup.Indicator />
							<CheckboxButtonGroup.ItemContent>
								<Label>{stage === "ingress" ? "Ingress" : "Processing"}</Label>
								<Description>{stage === "ingress" ? "Incoming requests" : "Delivery handling"}</Description>
							</CheckboxButtonGroup.ItemContent>
						</CheckboxButtonGroup.Item>
					))}
				</CheckboxButtonGroup>
			);
			break;
		case "radio-button-group":
			body = (
				<RadioButtonGroup defaultValue='ingress' variant='secondary'>
					<Label>Stage</Label>
					{["ingress", "processing"].map((stage) => (
						<RadioButtonGroup.Item key={stage} value={stage}>
							<RadioButtonGroup.Indicator />
							<RadioButtonGroup.ItemContent>
								<Label>{stage === "ingress" ? "Ingress" : "Processing"}</Label>
								<Description>{stage === "ingress" ? "Incoming requests" : "Delivery handling"}</Description>
							</RadioButtonGroup.ItemContent>
						</RadioButtonGroup.Item>
					))}
				</RadioButtonGroup>
			);
			break;
		case "drop-zone":
			body = (
				<DropZone>
					<DropZone.Area>
						<DropZone.Icon />
						<DropZone.Label>Upload fixtures</DropZone.Label>
						<DropZone.Description>JSON files, up to 1 MB per file.</DropZone.Description>
						<DropZone.Trigger>Browse files</DropZone.Trigger>
					</DropZone.Area>
					<DropZone.Input accept='.json' multiple />
				</DropZone>
			);
			break;
		case "native-select":
			body = (
				<NativeSelect className={variant === "full-width" ? "w-full" : undefined}>
					<NativeSelect.Trigger className={variant === "full-width" ? "w-full" : undefined} disabled={variant === "disabled"} aria-label='Status' value={status} onChange={(event) => setStatus(event.target.value)}>
						{choices.map((item) => (
							<NativeSelect.Option key={item.id} value={item.id}>
								{item.label}
							</NativeSelect.Option>
						))}
						<NativeSelect.Indicator />
					</NativeSelect.Trigger>
				</NativeSelect>
			);
			break;
		case "number-stepper":
			body = (
				<NumberStepper isDisabled={variant === "disabled"} aria-label='Retries' value={number} onChange={setNumber} minValue={0} maxValue={30}>
					<NumberStepper.Group>
						<NumberStepper.DecrementButton />
						<NumberStepper.Value />
						<NumberStepper.IncrementButton />
					</NumberStepper.Group>
				</NumberStepper>
			);
			break;
		case "rich-text-editor":
			body = (
				<RichTextEditor defaultValue={variant === "slash-commands" ? emptyEditorDocument : editorDocument} isReadOnly={variant === "read-only"} placeholder='Type / for commands'>
					<RichTextEditor.Shell>
						<RichTextEditor.Toolbar>
							<RichTextEditor.ToolbarGroup>
								<RichTextEditor.ToggleButton command='bold' aria-label='bold'>
									<IconBold size={16} />
								</RichTextEditor.ToggleButton>
								<RichTextEditor.ToggleButton command='italic' aria-label='italic'>
									<IconItalic size={16} />
								</RichTextEditor.ToggleButton>
								<RichTextEditor.ToggleButton command='strike' aria-label='strike'>
									<IconStrikethrough size={16} />
								</RichTextEditor.ToggleButton>
								<RichTextEditor.ToggleButton command='heading-2' aria-label='Heading'>
									<IconH2 size={16} />
								</RichTextEditor.ToggleButton>
								<RichTextEditor.ToggleButton command='bulletList' aria-label='bulletList'>
									<IconList size={16} />
								</RichTextEditor.ToggleButton>
								<RichTextEditor.ToggleButton command='orderedList' aria-label='orderedList'>
									<IconListNumbers size={16} />
								</RichTextEditor.ToggleButton>
								<RichTextEditor.ToggleButton command='codeBlock' aria-label='codeBlock'>
									<IconCode size={16} />
								</RichTextEditor.ToggleButton>
								<RichTextEditor.ActionButton action='undo' aria-label='undo'>
									<IconArrowBackUp size={16} />
								</RichTextEditor.ActionButton>
								<RichTextEditor.ActionButton action='redo' aria-label='redo'>
									<IconArrowForwardUp size={16} />
								</RichTextEditor.ActionButton>
							</RichTextEditor.ToolbarGroup>
						</RichTextEditor.Toolbar>
						<RichTextEditor.Content aria-label='Notification message' />
						{variant === "slash-commands" && <RichTextEditor.SuggestionMenu items={({ query }) => editorSuggestions.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).map((item) => ({ ...item, command: ({ editor, range }) => item.command(editor, range) }))} />}
						<RichTextEditor.Footer>
							<RichTextEditor.CharacterCount />
						</RichTextEditor.Footer>
					</RichTextEditor.Shell>
				</RichTextEditor>
			);
			break;
		case "context-menu":
			body = (
				<ContextMenu>
					<ContextMenu.Trigger>
						<div className='rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted'>Right-click, long-press, or use Shift+F10</div>
					</ContextMenu.Trigger>
					<ContextMenu.Popover>
						<ContextMenu.Menu onAction={(key) => setMessage(String(key))}>
							{["Open", "Rename", "Delete"].map((label) => (
								<ContextMenu.Item key={label} id={label.toLowerCase()} textValue={label}>
									{label}
								</ContextMenu.Item>
							))}
						</ContextMenu.Menu>
					</ContextMenu.Popover>
				</ContextMenu>
			);
			break;
		case "navbar":
			body = (
				<Navbar position={variant === "floating" ? "floating" : "static"}>
					<Navbar.Header className='gap-2 px-3'>
						<Navbar.Brand>Payload Bay</Navbar.Brand>
						<Navbar.Content className='hidden md:flex'>
							<Navbar.Item href='#overview' isCurrent>
								Overview
							</Navbar.Item>
							<Navbar.Item href='#projects'>Projects</Navbar.Item>
						</Navbar.Content>
						<Navbar.Spacer />

						<Navbar.MenuToggle />
					</Navbar.Header>
					<Navbar.Menu>
						<Navbar.MenuItem href='#overview'>Overview</Navbar.MenuItem>
						<Navbar.MenuItem href='#projects'>Projects</Navbar.MenuItem>
					</Navbar.Menu>
				</Navbar>
			);
			break;
		case "segment":
			body = (
				<Segment selectedKey={status} onSelectionChange={(key) => setStatus(String(key))}>
					{choices.map((item) => (
						<Segment.Item id={item.id} key={item.id}>
							{item.label}
						</Segment.Item>
					))}
				</Segment>
			);
			break;
		case "stepper":
			body = (
				<div className='flex flex-col gap-6'>
					<Stepper currentStep={step}>
						{["Owner identity", "Verify email", "Create workspace"].map((title) => (
							<Stepper.Step key={title}>
								<Stepper.Indicator />
								<Stepper.Content>
									<Stepper.Title>{title}</Stepper.Title>
								</Stepper.Content>
								<Stepper.Separator />
							</Stepper.Step>
						))}
					</Stepper>
					<div className='flex justify-between'>
						<Button variant='secondary' isDisabled={step === 0} onPress={() => setStep(step - 1)}>
							Back
						</Button>
						<Button onPress={() => setStep(step === 2 ? 0 : step + 1)}>{step === 2 ? "Reset" : "Continue"}</Button>
					</div>
				</div>
			);
			break;
		case "sheet":
			body = (
				<Sheet>
					<Sheet.Trigger>
						<Button>Open sheet</Button>
					</Sheet.Trigger>
					<Sheet.Backdrop>
						<Sheet.Content className='mx-auto max-h-[95vh] max-w-[640px]'>
							<Sheet.Dialog>
								<Sheet.Handle />
								<Sheet.CloseTrigger />
								<Sheet.Header>
									<Sheet.Heading>Delivery details</Sheet.Heading>
								</Sheet.Header>
								<Sheet.Body>
									<p className='text-sm text-muted'>Drag the handle down to dismiss, or use the close action.</p>
								</Sheet.Body>
								<Sheet.Footer>
									<Sheet.Close>
										<Button variant='secondary'>Done</Button>
									</Sheet.Close>
								</Sheet.Footer>
							</Sheet.Dialog>
						</Sheet.Content>
					</Sheet.Backdrop>
				</Sheet>
			);
			break;
		case "emoji-picker": {
			const toneIndex = Math.max(
				0,
				EMOJI_SKIN_TONES.findIndex((tone) => tone.id === skinTone),
			);
			const emojis = Object.entries((emojiData as unknown as EmojiMartData).emojis).map(([key, entry]) => ({ id: key, label: entry.name, unicode: (entry.skins[toneIndex] ?? entry.skins[0]).native }));
			body = (
				<EmojiPicker
					aria-label='Choose emoji'
					value={selectedEmoji}
					onChange={(key) => {
						if (key != null && !Array.isArray(key)) setSelectedEmoji(String(key));
					}}
				>
					<EmojiPicker.Trigger>
						<span aria-hidden='true'>{emojis.find((emoji) => emoji.id === selectedEmoji)?.unicode ?? "😀"}</span>
					</EmojiPicker.Trigger>
					<EmojiPicker.Popover>
						<EmojiPicker.Content>
							<SearchField variant='secondary' aria-label='Search emoji'>
								<SearchField.Group className='pr-2'>
									<SearchField.Input className='min-w-0' placeholder='Search emoji…' />
									<EmojiPicker.SkinTonePicker value={skinTone} onChange={setSkinTone}>
										<EmojiPicker.SkinToneTrigger />
										<EmojiPicker.SkinToneContent>
											{EMOJI_SKIN_TONES.map((tone) => (
												<EmojiPicker.SkinToneOption key={tone.id} id={tone.id} aria-label={tone.label}>
													{tone.emoji}
												</EmojiPicker.SkinToneOption>
											))}
										</EmojiPicker.SkinToneContent>
									</EmojiPicker.SkinTonePicker>
								</SearchField.Group>
							</SearchField>
							<EmojiPicker.Grid items={emojis}>
								{(item) => (
									<EmojiPicker.Item id={item.id} textValue={item.label}>
										<span className='pb-review-emoji-glyph'>{item.unicode}</span>
									</EmojiPicker.Item>
								)}
							</EmojiPicker.Grid>
						</EmojiPicker.Content>
					</EmojiPicker.Popover>
				</EmojiPicker>
			);
			break;
		}

		case "command":
			body = (
				<>
					<Button variant='secondary' onPress={() => setOpen(true)}>
						Search pages and resources
					</Button>
					<Command>
						<Command.Backdrop isOpen={open} onOpenChange={setOpen}>
							<Command.Container size='lg'>
								<Command.Dialog aria-label='Search pages and resources'>
									<Command.Header>Pages and resources</Command.Header>
									<Command.InputGroup>
										<Command.InputGroup.Input placeholder='Search pages and resources…' />
										<Command.InputGroup.ClearButton />
									</Command.InputGroup>
									<Command.List
										onAction={(key) => {
											setMessage(String(key));
											setOpen(false);
										}}
									>
										<Command.Group heading='Jump to'>
											{gridRows.map((row) => (
												<Command.Item key={row.id} id={row.id} textValue={row.name}>
													<IconFolder size={16} />
													{row.name}
												</Command.Item>
											))}
										</Command.Group>
									</Command.List>
								</Command.Dialog>
							</Command.Container>
						</Command.Backdrop>
					</Command>
				</>
			);
			break;
		case "sidebar":
		case "app-layout": {
			const menu = (
				<>
					<Sidebar.Header>
						<p className='p-4 font-semibold'>Orders project</p>
					</Sidebar.Header>
					<Sidebar.Content>
						{reviewNavigation.map((group) => (
							<Sidebar.Group key={group.label}>
								<Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
								<Sidebar.Menu aria-label={group.label}>
									{group.items.map((item) => (
										<Sidebar.MenuItem key={item.id} id={item.id} textValue={item.label} onAction={() => setMessage(item.label)}>
											<Sidebar.MenuIcon>{item.icon}</Sidebar.MenuIcon>
											<Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
										</Sidebar.MenuItem>
									))}
								</Sidebar.Menu>
							</Sidebar.Group>
						))}
					</Sidebar.Content>
				</>
			);
			body = (
				<div className='relative isolate h-96 overflow-hidden rounded-xl [transform:translateZ(0)]'>
					<AppLayout
						sidebar={
							<>
								<Sidebar>{menu}</Sidebar>
								<Sidebar.Mobile>{menu}</Sidebar.Mobile>
							</>
						}
						navbar={
							<div className='flex items-center gap-3 border-b border-border bg-background p-3'>
								<AppLayout.MenuToggle aria-label='Open navigation' />
								<span>Payload Bay</span>
							</div>
						}
					>
						<div className='p-4'>
							<div className='p-4'>{message || "Overview"}</div>
						</div>
					</AppLayout>
				</div>
			);
			break;
		}

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

createRoot(document.getElementById("root")!).render(<CatalogPage Example={Example} reference />);
