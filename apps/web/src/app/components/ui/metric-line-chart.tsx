"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import "./primitives.css";

export type Metric = { key: string; label: string; color: string };

type MetricTooltipProps = Pick<TooltipContentProps<number, string>, "active" | "payload" | "label"> & { definitions: Metric[] };

function MetricTooltip({ active, payload, label, definitions }: MetricTooltipProps) {
	if (!active || !payload?.length) return null;

	return (
		<div className='pb-traffic-tooltip'>
			<p className='pb-traffic-tooltip-label'>{label}</p>
			{definitions.map((metric) => {
				const point = payload.find((item) => item.dataKey === metric.key);
				if (!point) return null;

				return (
					<div className='pb-traffic-tooltip-row' key={metric.key}>
						<span className='pb-traffic-tooltip-dot' style={{ background: metric.color }} />
						<span className='text-muted'>{metric.label}</span>
						<span className='pb-traffic-tooltip-value'>{Number(point.value).toLocaleString()}</span>
					</div>
				);
			})}
		</div>
	);
}

export type MetricLineChartProps = { points: Array<{ hour: string; [key: string]: string | number }>; definitions: Metric[] };

export function MetricLineChart({ points, definitions }: MetricLineChartProps) {
	return (
		<div className='h-56' role='img' aria-label={definitions.map((metric) => metric.label).join(", ")}>
			<ResponsiveContainer width='100%' height='100%'>
				<LineChart
					data={points}
					margin={{
						top: 8,
						right: 8,
						bottom: 0,
						left: -20,
					}}
				>
					<CartesianGrid vertical={false} stroke='var(--separator)' />
					<XAxis dataKey='hour' tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} tickMargin={8} />
					<YAxis allowDecimals={false} width={32} tickCount={4} tickFormatter={(value) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(value)} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 10 }} />
					<Tooltip content={(props) => <MetricTooltip {...props} definitions={definitions} />} cursor={{ stroke: "var(--muted)", strokeDasharray: "4 4", strokeWidth: 1 }} />
					{definitions.map((metric) => (
						<Line key={metric.key} dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} type='linear' isAnimationActive={false} />
					))}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
