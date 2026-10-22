import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Button, Card } from "@heroui/react";
import { IconFolder, IconHome, IconWebhook, IconUsers, IconCode, IconActivity } from "@tabler/icons-react";
import { useReducedMotion } from "motion/react";
import { SidebarNavigation } from "@components/ui/sidebar-navigation";
import { useNavigationSearch } from "@components/ui/use-navigation-search";
import { SetupSteps } from "@components/ui/setup-steps";
import { CommandSearch, type CommandSearchProps } from "@components/ui/command-search";
import { DashboardLayout, type DashboardLayoutProps } from "@components/ui/dashboard-layout";
import { MetricLineChart } from "@components/ui/metric-line-chart";
import { ResourceEmptyState } from "@components/ui/resource-empty-state";
import "./replacement.css";
import { ReviewControls, useReviewOptions } from "./review-options";
import { Gallery, destinations, steps, chartFixtures, EmptyFixtures, ChartLegend } from "./shared";

function Navigation({ fullscreen = false, side = "left", ...props }: Omit<DashboardLayoutProps, "navigation" | "children" | "brand" | "navigationLabel">) {
	const [active, setActive] = useState("Overview");
	const [context, setContext] = useState("project");
	const [dirty, setDirty] = useState(false);

	const setOpen = props.onOpenChange;

	function renderNavigation(collapsed: boolean) {
		const items =
			context === "project"
				? [
						{ name: "Overview", icon: IconHome },
						{ name: "Destinations", icon: IconFolder },
						{ name: "Ingress routes", icon: IconWebhook },
						{ name: "Members", icon: IconUsers },
						{ name: "Shared code", icon: IconCode },
						{ name: "Event log", icon: IconActivity },
					]
				: [
						{ name: "Projects", icon: IconFolder },
						{ name: "Workspace members", icon: IconUsers },
					];

		function navigate(event: React.MouseEvent, name: string) {
			if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
			event.preventDefault();
			const href = `#${name.toLowerCase().replaceAll(" ", "-")}`;
			if (!window.dispatchEvent(new CustomEvent("payloadbay:before-navigate", { detail: { href }, cancelable: true }))) return;
			if (dirty && !window.confirm("Discard unsaved changes?")) return;
			setDirty(false);
			setActive(name);
			history.pushState(null, "", href);
			setOpen(false);
		}

		const entries = items.map(({ name, icon: Icon }) => ({
			id: name,
			label: name,
			href: `#${name.toLowerCase().replaceAll(" ", "-")}`,
			icon: <Icon size={16} />,
		}));

		return (
			<SidebarNavigation
				label='Project navigation'
				title={context === "project" ? "Demo integrations" : "Preview Demo"}
				collapsed={collapsed}
				side={side}
				activeId={active}
				groups={
					context === "project"
						? [
								{ label: "Settings", items: entries.slice(0, -1) },
								{ label: "Observe and troubleshoot", items: entries.slice(-1) },
							]
						: [{ label: "Settings", items: entries }]
				}
				back={{ label: context === "project" ? "Workspace menu" : "Demo integrations", accessibleLabel: context === "project" ? "Back to workspace menu" : "Open project menu", onPress: () => setContext(context === "project" ? "workspace" : "project") }}
				onNavigate={(event, item) => navigate(event, item.label)}
			/>
		);
	}

	return (
		<DashboardLayout {...props} fullscreen={fullscreen} side={side} navigation={renderNavigation} brand='Payload Bay' navigationLabel='Project navigation'>
			<Card>
				<Card.Header>
					<Card.Title>{active}</Card.Title>
					<Card.Description>Use the menu to explore project navigation.</Card.Description>
					<Button variant='secondary' onPress={() => setDirty(!dirty)}>
						{dirty ? "Discard demo edit" : "Make unsaved demo edit"}
					</Button>
				</Card.Header>
			</Card>
		</DashboardLayout>
	);
}

function Search({ open, onOpenChange, hideLauncher = false, reduceMotion }: Pick<CommandSearchProps, "open" | "onOpenChange" | "hideLauncher" | "reduceMotion">) {
	const [selected, setSelected] = useState("");

	return (
		<>
			<CommandSearch open={open} onOpenChange={onOpenChange} hideLauncher={hideLauncher} reduceMotion={reduceMotion} items={destinations.map((name) => ({ id: name, label: name, icon: <IconFolder size={16} /> }))} onAction={setSelected} />
			{selected && (
				<p role='status' className='mt-3 text-sm text-muted'>
					Selected: {selected}
				</p>
			)}
		</>
	);
}

function Review() {
	const { options, setOptions, style } = useReviewOptions();

	const { searchOpen, navigationOpen, onSearchOpenChange, onNavigationOpenChange, onNavigationClosed } = useNavigationSearch();

	const navigation = <Navigation onClosed={onNavigationClosed} fullscreen={new URLSearchParams(location.search).has("navigation")} open={navigationOpen} onOpenChange={onNavigationOpenChange} side={options.side === "right" ? "right" : "left"} background={`var(--${options.surface})`} reduceMotion={options.motion === "reduced" || (options.motion === "system" && matchMedia("(prefers-reduced-motion: reduce)").matches)} />;

	const systemReduced = useReducedMotion();

	const reduced = options.motion === "reduced" || (options.motion === "system" && Boolean(systemReduced));
	const fullscreen = new URLSearchParams(window.location.search).has("navigation");

	if (fullscreen)
		return (
			<div style={style}>
				{navigation}
				<Search hideLauncher open={searchOpen} onOpenChange={onSearchOpenChange} reduceMotion={reduced} />
			</div>
		);

	return (
		<div style={style}>
			<Gallery
				controls={<ReviewControls options={options} onChange={setOptions} />}
				stepper={(step) => <SetupSteps items={steps} currentStep={step} reduceMotion={reduced} />}
				empty={<EmptyFixtures render={(fixture, onAction) => <ResourceEmptyState title={fixture.title} description={fixture.description} icon={fixture.icon ? <IconFolder size={20} /> : undefined} action={<Button onPress={onAction}>{fixture.action}</Button>} />} />}
				chart={
					<div className='flex flex-col gap-8'>
						{chartFixtures.map((fixture) => (
							<section key={fixture.name} aria-label={fixture.name}>
								<h3 className='font-medium'>{fixture.name}</h3>
								<ChartLegend definitions={fixture.metrics} />
								<MetricLineChart points={fixture.points} definitions={fixture.metrics} />
							</section>
						))}
					</div>
				}
				search={<Search open={searchOpen} onOpenChange={onSearchOpenChange} reduceMotion={reduced} />}
				navigation={navigation}
			/>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(<Review />);
