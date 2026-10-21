"use client";

import type { TrafficSnapshot } from "@types";
import { Card } from "@heroui/react";
import { LineChart } from "@components/ui/charts";

const metrics = [
	{ key: "ingress", label: "Ingress", color: "var(--accent)" },
	{ key: "accepted", label: "Accepted", color: "var(--success)" },
	{ key: "rejected", label: "Rejected", color: "var(--danger)" },
	{ key: "deliveries", label: "Outgoing attempts", color: "var(--warning)" },
] as const;

export function TrafficChart({ overview }: { overview: TrafficSnapshot }) {
	return (
		<Card>
			<Card.Header>
				<Card.Title>Traffic</Card.Title>
				<Card.Description>Live totals, grouped by hour. Outgoing retries are counted individually.</Card.Description>
			</Card.Header>
			<Card.Content>
				<div className='mb-4 flex flex-wrap gap-4 text-xs'>
					{metrics.map((metric) => (
						<span key={metric.key} className='flex items-center gap-2'>
							<span className='size-2 rounded-full' style={{ background: metric.color }} />
							{metric.label}
						</span>
					))}
				</div>
				<LineChart data={overview.series.map((point) => ({ ...point, hour: new Date(point.hour).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) }))} height={220} label={`24-hour traffic: ${overview.totals.ingress} incoming requests, ${overview.totals.accepted} accepted, ${overview.totals.rejected} rejected, ${overview.totals.deliveries} outgoing attempts`} className='min-w-0 [&_.recharts-cartesian-axis-tick-value]:text-xs'>
					<LineChart.Grid vertical={false} />
					<LineChart.XAxis dataKey='hour' tickMargin={8} minTickGap={32} interval='preserveStartEnd' />
					<LineChart.YAxis allowDecimals={false} width={32} tickCount={4} tickFormatter={(value: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
					{metrics.map((metric) => (
						<LineChart.Line key={metric.key} dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2} dot={false} type='linear' isAnimationActive={false} />
					))}
					<LineChart.Tooltip />
				</LineChart>
			</Card.Content>
		</Card>
	);
}
