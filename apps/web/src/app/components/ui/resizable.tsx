"use client";

import { Group, Panel, Separator, useDefaultLayout, type PanelImperativeHandle } from "react-resizable-panels";
import { createContext, useContext, useImperativeHandle, useRef, type ComponentProps } from "react";
import { IconGripVertical, IconGripHorizontal } from "@tabler/icons-react";
import "./catalog.css";

const Orientation = createContext<"horizontal" | "vertical">("horizontal");
const storage = {
	getItem(key: string) {
		try {
			return typeof window === "undefined" ? null : window.localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem(key: string, value: string) {
		try {
			window.localStorage.setItem(key, value);
		} catch {
			/* Storage can be unavailable in private or embedded contexts. */
		}
	},
};
const noStorage = { getItem: () => null, setItem: () => {} };

export interface ResizableProps extends ComponentProps<typeof Group> {
	autoSaveId?: string;
	storage?: Parameters<typeof useDefaultLayout>[0]["storage"];
}

export interface ResizablePanelProps extends ComponentProps<typeof Panel> {
	onCollapse?: () => void;
	onExpand?: () => void;
}

export interface ResizableHandleProps extends ComponentProps<typeof Separator> {
	type?: "line" | "pill" | "drag";
	withIndicator?: boolean;
}

function percent(value: string | number | undefined) {
	return typeof value === "number" ? `${value}%` : value;
}

function ResizablePanel({ defaultSize, minSize, maxSize, collapsedSize, onCollapse, onExpand, onResize, panelRef, ...props }: ResizablePanelProps) {
	const handle = useRef<PanelImperativeHandle | null>(null);
	const collapsed = useRef<boolean | undefined>(undefined);

	useImperativeHandle(
		panelRef,
		() => ({
			collapse: () => handle.current?.collapse(),
			expand: () => handle.current?.expand(),
			getSize: () => handle.current!.getSize(),
			isCollapsed: () => handle.current?.isCollapsed() ?? false,
			resize: (size) => handle.current?.resize(size),
		}),
		[],
	);

	return (
		<Panel
			{...props}
			defaultSize={percent(defaultSize)}
			minSize={percent(minSize)}
			maxSize={percent(maxSize)}
			collapsedSize={percent(collapsedSize)}
			panelRef={handle}
			onResize={(size, id, previous) => {
				const next = handle.current?.isCollapsed();
				if (next !== undefined && collapsed.current !== undefined && next !== collapsed.current) {
					if (next) onCollapse?.();
					else onExpand?.();
				}

				collapsed.current = next;
				onResize?.(size, id, previous);
			}}
		/>
	);
}

export const Resizable = Object.assign(
	function ResizableRoot({ autoSaveId, storage: customStorage, orientation = "horizontal", defaultLayout, onLayoutChanged, ...props }: ResizableProps) {
		const saved = useDefaultLayout({ id: autoSaveId ?? "pb-unpersisted", storage: autoSaveId ? (customStorage ?? storage) : noStorage });

		return (
			<Orientation value={orientation}>
				<Group
					{...props}
					orientation={orientation}
					defaultLayout={defaultLayout ?? (autoSaveId ? saved.defaultLayout : undefined)}
					onLayoutChanged={(layout, meta) => {
						if (autoSaveId) saved.onLayoutChanged(layout, meta);
						onLayoutChanged?.(layout, meta);
					}}
				/>
			</Orientation>
		);
	},
	{
		Panel: ResizablePanel,
		Handle: function Handle({ type = "line", withIndicator = type !== "line", children, className = "", ...props }: ResizableHandleProps) {
			const orientation = useContext(Orientation);

			const Icon = orientation === "horizontal" ? IconGripVertical : IconGripHorizontal;

			return (
				<Separator {...props} aria-label={props["aria-label"] ?? "Resize handle"} className={`pb-resize-handle ${className}`} data-type={type} data-orientation={orientation}>
					{children ??
						(withIndicator &&
							(type === "drag" ? (
								<span className='pb-resize-grip'>
									<Icon size={10} />
								</span>
							) : (
								<span className='pb-resize-pill' />
							)))}
				</Separator>
			);
		},
	},
);
