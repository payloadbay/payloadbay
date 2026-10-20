import { createRoot } from "react-dom/client";
import { useState, type CSSProperties } from "react";
import { Button, Card } from "@heroui/react";
import { AppLayout, Command, EmptyState, Sidebar, Stepper } from "@heroui-pro/react";
import { LineChart } from "@heroui-pro/react/line-chart";
import { IconFolder, IconSearch } from "@tabler/icons-react";
import { ReviewControls, useReviewOptions, defaultOptions, type ReviewOptions } from "./review-options";
import { Gallery, destinations, steps, chartFixtures, EmptyFixtures, ChartLegend } from "./shared";

function Search() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("");

	return (
		<>
			<Button variant='secondary' className='w-full justify-start' onPress={() => setOpen(true)}>
				<IconSearch size={18} />
				Search pages and resources
			</Button>
			{selected && (
				<p className='mt-3 text-sm text-muted' role='status'>
					Selected: {selected}
				</p>
			)}
			<Command>
				<Command.Backdrop isOpen={open} onOpenChange={setOpen}>
					<Command.Container size='lg'>
						<Command.Dialog aria-label='Search pages and resources' inputValue={query} onInputChange={setQuery}>
							<Command.Header>All accessible pages and resources</Command.Header>
							<Command.InputGroup>
								<Command.InputGroup.Input placeholder='Search pages and resources…' />
								<Command.InputGroup.ClearButton aria-label='Clear search' />
							</Command.InputGroup>
							<Command.List
								onAction={(key) => {
									setSelected(String(key));
									setOpen(false);
								}}
								renderEmptyState={() => <p className='p-4 text-muted'>No matching pages or resources.</p>}
							>
								<Command.Group heading='Jump to'>
									{destinations.map((name) => (
										<Command.Item key={name} id={name} textValue={name}>
											<IconFolder size={18} />
											<span>{name}</span>
											<span className='ml-auto text-xs text-muted'>Jump to</span>
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
}

function Navigation({ fullscreen = false, options = defaultOptions }: { fullscreen?: boolean; options?: ReviewOptions }) {
	const [active, setActive] = useState("Overview");

	const content = (
		<>
			<Sidebar.Header>
				<p className='p-4 text-lg font-semibold'>Demo integrations</p>
			</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.GroupLabel>Settings</Sidebar.GroupLabel>
					<Sidebar.Menu aria-label='Project navigation'>
						{["Overview", "Destinations", "Ingress routes", "Members", "Shared code"].map((name) => (
							<Sidebar.MenuItem key={name} id={name} textValue={name} isCurrent={active === name} onAction={() => setActive(name)}>
								<Sidebar.MenuIcon>
									<IconFolder size={18} />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>{name}</Sidebar.MenuLabel>
							</Sidebar.MenuItem>
						))}
					</Sidebar.Menu>
				</Sidebar.Group>
				<Sidebar.Group>
					<Sidebar.GroupLabel>Observe and troubleshoot</Sidebar.GroupLabel>
					<Sidebar.Menu aria-label='Observation'>
						<Sidebar.MenuItem id='events' textValue='Event log' isCurrent={active === "Event log"} onAction={() => setActive("Event log")}>
							Event log
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>
		</>
	);

	return (
		<div className={fullscreen ? "h-dvh overflow-hidden" : "relative isolate h-96 overflow-hidden rounded-2xl border border-border [transform:translateZ(0)]"}>
			<AppLayout
				reduceMotion={options.motion === "reduced"}
				sidebarSide={options.side === "right" ? "right" : "left"}
				sidebar={
					<>
						<Sidebar style={{ background: `var(--${options.surface})` }}>{content}</Sidebar>
						<Sidebar.Mobile aria-label='Project navigation'>{content}</Sidebar.Mobile>
					</>
				}
				navbar={
					<div className='flex items-center gap-3 border-b border-border bg-background p-3'>
						<AppLayout.MenuToggle aria-label='Open navigation' />
						<span className='font-medium'>Payload Bay</span>
					</div>
				}
			>
				<div className='p-4'>
					<Card>
						<Card.Header>
							<Card.Title>{active}</Card.Title>
							<Card.Description>Use the menu to explore project navigation.</Card.Description>
						</Card.Header>
					</Card>
				</div>
			</AppLayout>
		</div>
	);
}

function Review() {
	const { options, setOptions, style } = useReviewOptions();

	const fullscreen = new URLSearchParams(window.location.search).has("navigation");

	if (fullscreen)
		return (
			<div style={style}>
				<Navigation fullscreen options={options} />
			</div>
		);

	return (
		<div style={style}>
			<Gallery
				controls={<ReviewControls options={options} onChange={setOptions} />}
				stepper={(step) => (
					<Stepper currentStep={step} data-reduce-motion={options.motion === "reduced" ? "true" : undefined} style={{ "--stepper-active-color": "var(--pb-step-accent)", "--stepper-complete-color": "var(--pb-step-accent)", "--stepper-complete-fg": "var(--pb-step-foreground)" } as CSSProperties}>
						{steps.map((title) => (
							<Stepper.Step key={title}>
								<Stepper.Indicator />
								<Stepper.Content>
									<Stepper.Title>{title}</Stepper.Title>
								</Stepper.Content>
								<Stepper.Separator />
							</Stepper.Step>
						))}
					</Stepper>
				)}
				empty={
					<EmptyFixtures
						render={(fixture, onAction) => (
							<EmptyState>
								<EmptyState.Header>
									{fixture.icon && (
										<EmptyState.Media variant='icon'>
											<IconFolder size={24} />
										</EmptyState.Media>
									)}
									<EmptyState.Title>{fixture.title}</EmptyState.Title>
									<EmptyState.Description>{fixture.description}</EmptyState.Description>
								</EmptyState.Header>
								<Button onPress={onAction}>{fixture.action}</Button>
							</EmptyState>
						)}
					/>
				}
				chart={
					<div className='flex flex-col gap-8'>
						{chartFixtures.map((fixture) => (
							<section key={fixture.name} aria-label={fixture.name}>
								<h3 className='font-medium'>{fixture.name}</h3>
								<ChartLegend definitions={fixture.metrics} />
								<LineChart data={fixture.points} height={224}>
									<LineChart.Grid vertical={false} />
									<LineChart.XAxis dataKey='hour' />
									<LineChart.YAxis width={32} allowDecimals={false} tickCount={4} tickFormatter={(value) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(value)} />
									{fixture.metrics.map((metric) => (
										<LineChart.Line key={metric.key} dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2} dot={false} type='linear' isAnimationActive={false} />
									))}
									<LineChart.Tooltip content={<LineChart.TooltipContent />} />
								</LineChart>
							</section>
						))}
					</div>
				}
				search={<Search />}
				navigation={<Navigation options={options} />}
			/>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(<Review />);
