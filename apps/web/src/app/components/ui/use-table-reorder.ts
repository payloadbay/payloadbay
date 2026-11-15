"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useDragAndDrop } from "react-aria-components";

/** Pointer dragging is handle-only; React Aria supplies keyboard drag/drop. */
export function useTableReorder<T extends { id: string }>(items: T[], onChange: (items: T[]) => void, group: string, disabled = false) {
	const gesture = useRef<{
		pointer: number;
		source: string;
		x: number;
		y: number;
		active: boolean;
		target: string | null;
		after: boolean;
	} | null>(null);
	const [visual, setVisual] = useState<{ source: string; target: string | null } | null>(null);

	function place(keys: ReadonlySet<string | number>, target: string, after: boolean) {
		if (disabled || !items.some((item) => item.id === target) || keys.has(target)) return;
		const moved = items.filter((item) => keys.has(item.id));
		if (!moved.length) return;
		const next = items.filter((item) => !keys.has(item.id));
		next.splice(next.findIndex((item) => item.id === target) + (after ? 1 : 0), 0, ...moved);
		onChange(next);
	}

	const { dragAndDropHooks } = useDragAndDrop({ isDisabled: disabled, getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })), onReorder: (event) => place(event.keys, String(event.target.key), event.target.dropPosition === "after") });

	function start(event: PointerEvent<HTMLSpanElement>, source: string) {
		if (disabled || (event.pointerType !== "touch" && event.button !== 0)) return;
		event.preventDefault();
		event.stopPropagation();
		event.currentTarget.querySelector("button")?.focus({ preventScroll: true });
		event.currentTarget.setPointerCapture(event.pointerId);
		gesture.current = {
			pointer: event.pointerId,
			source,
			x: event.clientX,
			y: event.clientY,
			active: false,
			target: null,
			after: false,
		};
	}

	function move(event: PointerEvent<HTMLSpanElement>) {
		const drag = gesture.current;
		if (!drag || drag.pointer !== event.pointerId || (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8)) return;
		event.preventDefault();
		drag.active = true;
		const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-reorder-id]");
		drag.target = row?.dataset.reorderGroup === group && items.some((item) => item.id === row.dataset.reorderId) && row.dataset.reorderId !== drag.source ? row.dataset.reorderId! : null;
		drag.after = Boolean(row && event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
		setVisual({ source: drag.source, target: drag.target });
	}

	function end(event: PointerEvent<HTMLSpanElement>, cancelled = false) {
		const drag = gesture.current;
		if (!drag || drag.pointer !== event.pointerId) return;
		gesture.current = null;
		setVisual(null);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
		if (!cancelled && drag.active && drag.target) place(new Set([drag.source]), drag.target, drag.after);
	}

	return {
		dragAndDropHooks,
		visual,
		handle: (id: string) => ({
			onPointerDownCapture: (event: PointerEvent<HTMLSpanElement>) => start(event, id),
			onPointerMoveCapture: move,
			onPointerUpCapture: (event: PointerEvent<HTMLSpanElement>) => end(event),
			onPointerCancelCapture: (event: PointerEvent<HTMLSpanElement>) => end(event, true),
			onDragStartCapture: (event: { preventDefault(): void }) => {
				if (gesture.current) event.preventDefault();
			},
		}),
	};
}
