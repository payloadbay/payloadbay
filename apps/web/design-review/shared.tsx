import { useState, type ReactNode } from "react";
import { Button, Card, Chip, Input, Label, TextField } from "@heroui/react";

export const steps = ["Owner identity", "Verify email"];

export const destinations = ["Overview", "Workspaces", "Projects", "Event log", "Shared code"];

export const data = [
	{
		hour: "08:00",
		ingress: 12,
		accepted: 10,
		deliveries: 15,
	},
	{
		hour: "09:00",
		ingress: 28,
		accepted: 24,
		deliveries: 32,
	},
	{
		hour: "10:00",
		ingress: 20,
		accepted: 18,
		deliveries: 25,
	},
	{
		hour: "11:00",
		ingress: 46,
		accepted: 40,
		deliveries: 52,
	},
	{
		hour: "12:00",
		ingress: 34,
		accepted: 30,
		deliveries: 38,
	},
].map((point) => ({ ...point, rejected: point.ingress - point.accepted }));

export type Metric = { key: string; label: string; color: string };

export const metrics: Metric[] = [
	{ key: "ingress", label: "Ingress", color: "var(--accent)" },
	{ key: "accepted", label: "Accepted", color: "var(--success)" },
	{ key: "rejected", label: "Rejected", color: "var(--danger)" },
	{ key: "deliveries", label: "Outgoing attempts", color: "var(--warning)" },
];

export const chartFixtures = [
	{ name: "Traffic", points: data, metrics },
	{
		name: "Jobs",
		points: [
			{ hour: "08:00", succeeded: 0, failed: 0 },
			{ hour: "09:00", succeeded: 1, failed: 0 },
			{ hour: "10:00", succeeded: 1, failed: 1 },
		],
		metrics: [
			{ key: "succeeded", label: "Succeeded", color: "var(--success)" },
			{ key: "failed", label: "Failed", color: "var(--danger)" },
		],
	},
	{
		name: "Low-count traffic",
		points: data.map((point, i) => ({
			...point,
			ingress: i % 2,
			accepted: i % 2,
			rejected: 0,
			deliveries: i % 2,
		})),
		metrics,
	},
];

type GalleryProps = {
	stepper: (step: number) => ReactNode;
	controls?: ReactNode;
	empty: ReactNode;
	chart: ReactNode;
	navigation: ReactNode;
	search: ReactNode;
};

export const emptyFixtures = [
	{
		key: "projects",
		title: "No projects yet",
		description: "Create a project to start receiving and delivering webhooks.",
		action: "Create project",
		icon: true,
		dashed: false,
	},
	{
		key: "retry",
		title: "Events unavailable",
		description: "Try loading events again.",
		action: "Retry",
		icon: true,
		dashed: false,
	},
	{
		key: "middleware",
		title: "No middleware yet",
		description: "Create middleware to process incoming requests.",
		action: "Create middleware",
		icon: false,
		dashed: true,
	},
	{
		key: "notifications",
		title: "No notification rules",
		description: "Create a rule to be notified of delivery failures.",
		action: "Create rule",
		icon: true,
		dashed: true,
	},
];

export function ChartLegend({ definitions }: { definitions: Metric[] }) {
	return (
		<div className='my-4 flex flex-wrap gap-4 text-xs'>
			{definitions.map((metric) => (
				<span key={metric.key} className='flex items-center gap-2'>
					<span className='size-2 rounded-full' style={{ background: metric.color }} />
					{metric.label}
				</span>
			))}
		</div>
	);
}

export function EmptyFixtures({ render }: { render: (fixture: (typeof emptyFixtures)[number], onAction: () => void) => ReactNode }) {
	const [result, setResult] = useState("");

	return (
		<div className='flex flex-col gap-6'>
			{emptyFixtures.map((fixture) => (
				<section key={fixture.key} aria-label={fixture.title} className={fixture.dashed ? "rounded-xl border border-dashed border-border" : ""}>
					{render(fixture, () => setResult(fixture.key === "retry" ? "Events loaded" : fixture.action + " selected"))}
				</section>
			))}
			{result && (
				<p role='status' className='text-center text-sm text-muted'>
					{result}
				</p>
			)}
		</div>
	);
}

export function Gallery({ stepper, empty, chart, navigation, search, controls }: GalleryProps) {
	const [step, setStep] = useState(0);

	return (
		<main className='mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:p-6'>
			{controls}
			<section aria-labelledby='setup-title' className='flex flex-col gap-3'>
				<h2 id='setup-title' className='text-lg font-semibold'>
					01 / Setup stepper
				</h2>
				<Card>
					<Card.Header>
						<Card.Title>Set up your instance</Card.Title>
						<Card.Description>A safe landing place for every event.</Card.Description>
					</Card.Header>
					<Card.Content className='flex flex-col gap-6'>
						{stepper(step)}
						<TextField>
							<Label>{step === 0 ? "Owner email" : "Sign-in code"}</Label>
							<Input variant='secondary' placeholder={step === 0 ? "you@company.com" : "123456"} />
						</TextField>
					</Card.Content>
					<Card.Footer className='justify-between'>
						<Button variant='tertiary' isDisabled={step === 0} onPress={() => setStep(0)}>
							Back
						</Button>
						<Button onPress={() => setStep(step === 0 ? 1 : 0)}>{step === 0 ? "Continue" : "Reset demo"}</Button>
					</Card.Footer>
				</Card>
			</section>
			<section className='flex flex-col gap-3'>
				<h2 className='text-lg font-semibold'>02 / Empty state</h2>
				<Card className='min-h-64 justify-center'>{empty}</Card>
			</section>
			<section className='flex flex-col gap-3'>
				<h2 className='text-lg font-semibold'>03 / Traffic chart</h2>
				<Card>
					<Card.Header>
						<Card.Title>Traffic</Card.Title>
						<Card.Description>Incoming requests and outgoing attempts.</Card.Description>
					</Card.Header>
					<Card.Content>{chart}</Card.Content>
				</Card>
			</section>
			<section className='flex flex-col gap-3'>
				<h2 className='text-lg font-semibold'>04 / Command search</h2>
				<Card>
					<Card.Header>
						<Card.Title>Find a page or resource</Card.Title>
						<Card.Description>Search, clear, select with the keyboard, or dismiss.</Card.Description>
					</Card.Header>
					<Card.Content>{search}</Card.Content>
				</Card>
			</section>
			<section className='flex flex-col gap-3'>
				<h2 className='text-lg font-semibold'>05 / Sidebar and mobile navigation</h2>
				{navigation}
			</section>
			<Chip variant='soft' className='self-start'>
				Synthetic data only
			</Chip>
		</main>
	);
}
