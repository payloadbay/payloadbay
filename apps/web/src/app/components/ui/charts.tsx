"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { ResponsiveContainer, AreaChart as RAreaChart, BarChart as RBarChart, ComposedChart as RComposedChart, LineChart as RLineChart, PieChart as RPieChart, RadarChart as RRadarChart, RadialBarChart as RRadialChart, CartesianGrid, XAxis, YAxis, Area, Bar, Line, Pie, Radar, RadialBar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, Cell, Tooltip } from "recharts";
import "./catalog.css";

export type ChartProps = {
	children: ReactElement;
	label: string;
	height?: number;
	className?: string;
};

export function Chart({ children, label, height = 240, className = "" }: ChartProps) {
	return (
		<div className={`pb-chart ${className}`} style={{ height }} role='img' aria-label={label}>
			<ResponsiveContainer width='100%' height='100%'>
				{children}
			</ResponsiveContainer>
		</div>
	);
}

export function ChartTooltip({ title, children }: { title?: ReactNode; children: ReactNode }) {
	return (
		<div className='pb-chart-tooltip'>
			{title !== undefined && title !== null && title !== "" && <div className='pb-chart-tooltip-heading'>{title}</div>}
			{children}
		</div>
	);
}

export function ChartTooltipRow({ label, value, color }: { label: ReactNode; value: ReactNode; color?: string }) {
	return (
		<div className='pb-chart-tooltip-row'>
			<span className='pb-chart-dot' style={{ background: color }} />
			<span className='text-muted'>{label}</span>
			<span className='ml-auto pl-4 font-medium tabular-nums'>{value}</span>
		</div>
	);
}

function DefaultTooltip(props: ComponentProps<typeof Tooltip>) {
	return (
		<Tooltip
			cursor={{
				stroke: "var(--muted)",
				strokeDasharray: "4 4",
				fill: "var(--default)",
				fillOpacity: 0.5,
			}}
			content={({ active, label, payload }) =>
				active && payload?.length ? (
					<ChartTooltip title={label}>
						{payload.map((entry) => (
							<ChartTooltipRow key={String(entry.dataKey ?? entry.name)} label={entry.name} color={entry.color ?? entry.payload?.fill ?? entry.fill ?? entry.stroke} value={typeof entry.value === "number" ? entry.value.toLocaleString() : String(entry.value ?? "")} />
						))}
					</ChartTooltip>
				) : null
			}
			{...props}
		/>
	);
}

function Grid(props: ComponentProps<typeof CartesianGrid>) {
	return <CartesianGrid vertical={false} stroke='var(--muted)' strokeOpacity={0.15} {...props} />;
}

function HorizontalAxis(props: ComponentProps<typeof XAxis>) {
	return <XAxis tick={{ fill: "var(--muted)", fontSize: 10 }} {...props} />;
}

function VerticalAxis(props: ComponentProps<typeof YAxis>) {
	return <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} width={60} tickFormatter={(value) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(Number(value))} {...props} />;
}

type FrameOptions = { height?: number; label: string; className?: string };

function AreaRoot({ height, label, className, ...props }: ComponentProps<typeof RAreaChart> & FrameOptions) {
	return (
		<Chart label={label} height={height} className={className}>
			<RAreaChart
				margin={{
					top: 8,
					right: 8,
					bottom: 0,
					left: 0,
				}}
				{...props}
			/>
		</Chart>
	);
}

function BarRoot({ height, label, className, ...props }: ComponentProps<typeof RBarChart> & FrameOptions) {
	return (
		<Chart label={label} height={height} className={className}>
			<RBarChart
				margin={{
					top: 8,
					right: 8,
					bottom: 0,
					left: 0,
				}}
				{...props}
			/>
		</Chart>
	);
}

function ComposedRoot({ height, label, className, ...props }: ComponentProps<typeof RComposedChart> & FrameOptions) {
	return (
		<Chart label={label} height={height} className={className}>
			<RComposedChart
				margin={{
					top: 8,
					right: 8,
					bottom: 0,
					left: 0,
				}}
				{...props}
			/>
		</Chart>
	);
}

function LineRoot({ height, label, className, ...props }: ComponentProps<typeof RLineChart> & FrameOptions) {
	return (
		<Chart label={label} height={height} className={className}>
			<RLineChart
				margin={{
					top: 8,
					right: 8,
					bottom: 0,
					left: 0,
				}}
				{...props}
			/>
		</Chart>
	);
}

function PieRoot({ height, label, className, ...props }: ComponentProps<typeof RPieChart> & FrameOptions) {
	return (
		<Chart label={label} height={height} className={className}>
			<RPieChart {...props} />
		</Chart>
	);
}

function RadarRoot({ height, label, className, ...props }: ComponentProps<typeof RRadarChart> & FrameOptions) {
	return (
		<Chart label={label} height={height} className={className}>
			<RRadarChart {...props} />
		</Chart>
	);
}

function RadialRoot({ height, label, className, ...props }: ComponentProps<typeof RRadialChart> & FrameOptions) {
	return (
		<Chart label={label} height={height} className={className}>
			<RRadialChart barSize={10} innerRadius='30%' outerRadius='80%' startAngle={90} endAngle={-270} {...props} />
		</Chart>
	);
}

const cartesian = {
	Grid,
	XAxis: HorizontalAxis,
	YAxis: VerticalAxis,
	Tooltip: DefaultTooltip,
	Legend,
};

export const AreaChart = Object.assign(AreaRoot, { ...cartesian, Area });

function BarTooltip(props: ComponentProps<typeof Tooltip>) {
	return <DefaultTooltip {...props} cursor={props.cursor ?? { fill: "var(--foreground)", opacity: 0.05, stroke: "none" }} />;
}

export const BarChart = Object.assign(BarRoot, {
	...cartesian,
	Bar,
	Cell,
	Tooltip: BarTooltip,
});

export const ComposedChart = Object.assign(ComposedRoot, {
	...cartesian,
	Area,
	Bar,
	Line,
});

export const LineChart = Object.assign(LineRoot, { ...cartesian, Line });

export const PieChart = Object.assign(PieRoot, {
	Pie,
	Cell,
	Legend,
	Tooltip: DefaultTooltip,
});

export const RadarChart = Object.assign(RadarRoot, {
	Radar,
	PolarGrid,
	PolarAngleAxis,
	PolarRadiusAxis,
	Legend,
	Tooltip: DefaultTooltip,
});

export const RadialChart = Object.assign(RadialRoot, {
	RadialBar,
	PolarAngleAxis,
	Legend,
	Tooltip: DefaultTooltip,
});
