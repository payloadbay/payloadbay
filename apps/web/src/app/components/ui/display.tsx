"use client";

import { useId, type ComponentProps, type HTMLAttributes, type ReactNode } from "react";
import { AreaChart as SparklineChart, Area, ResponsiveContainer } from "recharts";
import { Card, Checkbox, ProgressBar } from "@heroui/react";
import { Virtualizer, ListLayout } from "react-aria-components/Virtualizer";
import { GridList, GridListItem, composeRenderProps, type GridListProps } from "react-aria-components";
import { NumberValue, TrendChip } from "./feedback";
import "./catalog.css";

export function ItemCard({
	icon,
	title,
	description,
	action,
	children,
	className = "",
	...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div {...props} className={`pb-item-card ${className}`}>
			{icon && <span className='pb-item-icon'>{icon}</span>}
			<div className='min-w-0 flex-1'>
				<h3 className='text-sm font-medium'>{title}</h3>
				{description && <p className='text-sm text-muted'>{description}</p>}
				{children}
			</div>
			{action && <div className='shrink-0'>{action}</div>}
		</div>
	);
}

export interface ItemCardGroupProps {
	title?: ReactNode;
	description?: ReactNode;
	children: ReactNode;
	layout?: "list" | "grid";
}

export function ItemCardGroup({ title, description, children, layout = "list" }: ItemCardGroupProps) {
	return (
		<section className='pb-item-group' data-layout={layout}>
			{title && (
				<header className='mb-3'>
					<h2 className='font-medium'>{title}</h2>
					{description && <p className='text-sm text-muted'>{description}</p>}
				</header>
			)}
			<div className={layout === "grid" ? "grid gap-3 sm:grid-cols-2" : "divide-y divide-separator overflow-hidden rounded-xl border border-border"}>{children}</div>
		</section>
	);
}

export interface KPIRootProps {
	title: string;
	value: number;
	description?: ReactNode;
	trend?: { direction: "up" | "down" | "neutral"; label: string; positive?: "up" | "down" };
	progress?: number;
	icon?: ReactNode;
	format?: ComponentProps<typeof NumberValue>["format"];
	chart?: ReactNode;
}

function KPIRoot({ title, value, description, trend, progress, icon, format, chart }: KPIRootProps) {
	return (
		<Card className='pb-kpi'>
			<div className='pb-kpi-header'>
				<h3 className='pb-kpi-title'>{title}</h3>
				{icon}
			</div>
			<div className='pb-kpi-content'>
				<NumberValue value={value} format={format} className='pb-kpi-value' />
				{trend && (
					<TrendChip trend={trend.direction} positive={trend.positive}>
						{trend.label}
					</TrendChip>
				)}
			</div>
			{chart}
			{(description || progress !== undefined) && (
				<div className='pb-kpi-footer flex flex-col items-stretch gap-2'>
					{description && <p className='text-xs text-muted'>{description}</p>}
					{progress !== undefined && (
						<ProgressBar aria-label={`${title} progress`} value={progress}>
							<ProgressBar.Track>
								<ProgressBar.Fill />
							</ProgressBar.Track>
						</ProgressBar>
					)}
				</div>
			)}
		</Card>
	);
}

export interface KPISparklineProps {
	data: Record<string, unknown>[];
	dataKey?: string;
	color?: string;
	height?: number;
	label?: string;
}

export function KPISparkline({ data, dataKey = "value", color = "var(--accent)", height = 80, label = "Recent trend" }: KPISparklineProps) {
	const gradient = `pb-kpi-${useId().replace(/[^a-z0-9]/gi, "")}`;

	return (
		<div className='pb-kpi-chart' role='img' aria-label={label} style={{ height }}>
			<ResponsiveContainer width='100%' height='100%'>
				<SparklineChart
					data={data}
					margin={{
						top: 4,
						right: 0,
						bottom: 0,
						left: 0,
					}}
				>
					<defs>
						<linearGradient id={gradient} x1='0' x2='0' y1='0' y2='1'>
							<stop offset='0%' stopColor={color} stopOpacity={0.2} />
							<stop offset='100%' stopColor={color} stopOpacity={0.02} />
						</linearGradient>
					</defs>
					<Area dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradient})`} type='monotone' isAnimationActive={false} />
				</SparklineChart>
			</ResponsiveContainer>
		</div>
	);
}

export const KPI = Object.assign(KPIRoot, { Chart: KPISparkline });

export const KPIGroup = Object.assign(
	function KPIGroupRoot({ children, className = "", orientation = "horizontal" }: { children: ReactNode; className?: string; orientation?: "horizontal" | "vertical" }) {
		return (
			<div className={`pb-kpi-group ${className}`} data-orientation={orientation}>
				{children}
			</div>
		);
	},
	{
		Separator: function Separator() {
			return <span aria-hidden='true' className='pb-kpi-separator' />;
		},
	},
);

export const Widget = Object.assign(
	function WidgetRoot(props: ComponentProps<typeof Card>) {
		return <Card {...props} className={`pb-widget ${props.className ?? ""}`} />;
	},
	{
		Header: function Header(props: ComponentProps<typeof Card.Header>) {
			return <Card.Header {...props} className={`pb-widget-header ${props.className ?? ""}`} />;
		},
		Title: Card.Title,
		Description: Card.Description,
		Content: function Content(props: ComponentProps<typeof Card.Content>) {
			return <Card.Content {...props} className={`pb-widget-content ${props.className ?? ""}`} />;
		},
		Footer: function Footer(props: ComponentProps<typeof Card.Footer>) {
			return <Card.Footer {...props} className={`pb-widget-footer ${props.className ?? ""}`} />;
		},
		Legend: function Legend({ children }: { children: ReactNode }) {
			return <div className='flex flex-wrap gap-3 text-xs'>{children}</div>;
		},
		LegendItem: function LegendItem({ color, children }: { color: string; children: ReactNode }) {
			return (
				<span className='inline-flex items-center gap-2'>
					<span className='size-2 rounded-full' style={{ background: color }} />
					{children}
				</span>
			);
		},
	},
);

export interface ListViewProps<T extends object> extends GridListProps<T> {
	virtualized?: boolean;
	rowHeight?: number;
	height?: number;
}

export const ListView: {
	<T extends object>(props: ListViewProps<T>): ReactNode;
	Item: (props: ComponentProps<typeof GridListItem>) => ReactNode;
} = Object.assign(
	function ListViewRoot<T extends object>({ virtualized = false, rowHeight = 56, height = 320, ...props }: ListViewProps<T>) {
		const list = (
			<GridList
				{...props}
				className={composeRenderProps(props.className, (className) => `pb-list-view ${className ?? ""}`)}
				style={composeRenderProps(props.style, (style) =>
					virtualized
						? {
								...style,
								height,
								overflow: "auto",
								display: "block",
								padding: 0,
							}
						: style,
				)}
			/>
		);

		return virtualized ? (
			<Virtualizer layout={ListLayout} layoutOptions={{ rowHeight }}>
				{list}
			</Virtualizer>
		) : (
			list
		);
	},
	{
		Item: function Item(props: ComponentProps<typeof GridListItem>) {
			return (
				<GridListItem {...props} className={composeRenderProps(props.className, (className) => `pb-list-view-item ${className ?? ""}`)}>
					{(state) => (
						<>
							{state.selectionMode !== "none" && state.selectionBehavior === "toggle" && (
								<Checkbox slot='selection' variant='secondary' aria-label='Select row'>
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
									</Checkbox.Content>
								</Checkbox>
							)}
							{typeof props.children === "function" ? props.children(state) : props.children}
						</>
					)}
				</GridListItem>
			);
		},
	},
);

export type TimelineEntry = {
	id: string;
	title: ReactNode;
	description?: ReactNode;
	dateTime?: string;
	time?: ReactNode;
	icon?: ReactNode;
	color?: string;
	status?: "complete" | "current" | "default" | "success" | "warning" | "danger" | "muted";
	oppositeContent?: ReactNode;
	content?: ReactNode;
};

export interface TimelineProps {
	items: TimelineEntry[];
	label?: string;
	placement?: "start" | "end" | "alternate";
	axis?: "start" | "center";
	density?: "compact" | "comfortable";
	size?: "sm" | "md" | "lg";
}

export function Timeline({ items, label = "Timeline", placement = "end", axis = placement === "alternate" ? "center" : "start", density = "comfortable", size = "md" }: TimelineProps) {
	return (
		<ol className='pb-timeline' aria-label={label} data-axis={axis} data-density={density} data-size={size}>
			{items.map((item, index) => {
				const side = placement === "alternate" ? (index % 2 === 0 ? "end" : "start") : placement;

				return (
					<li key={item.id} data-status={item.status ?? "default"} data-side={side} aria-current={item.status === "current" ? "true" : undefined}>
						<div className='pb-timeline-rail' aria-hidden='true'>
							<span className='pb-timeline-marker' style={{ color: item.color }}>
								{item.icon ?? <span className='size-1.5 rounded-full bg-current' />}
							</span>
							{index < items.length - 1 && <span className='pb-timeline-connector' />}
						</div>
						<div className='pb-timeline-content'>
							{item.content ?? (
								<>
									<h3 className='text-sm font-medium'>{item.title}</h3>
									{item.time && (
										<time dateTime={item.dateTime} className='text-xs text-muted'>
											{item.time}
										</time>
									)}
									{item.description && <div className='mt-2 text-sm text-muted'>{item.description}</div>}
								</>
							)}
						</div>
						{item.oppositeContent && <div className='pb-timeline-opposite'>{item.oppositeContent}</div>}
					</li>
				);
			})}
		</ol>
	);
}
