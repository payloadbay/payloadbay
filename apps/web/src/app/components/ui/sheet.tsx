"use client";

import { createContext, useContext, useEffect, useRef, useState, type RefObject, type ReactNode } from "react";
import { Button, Drawer } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { useReducedMotion } from "motion/react";
import "./catalog.css";

const ParentSheet = createContext<RefObject<HTMLElement | null> | null>(null);

export interface SheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	placement?: "top" | "bottom" | "left" | "right";
	snapPoints?: number[];
	activeSnapPoint?: number;
	onActiveSnapPointChange?: (point: number) => void;
	isDismissable?: boolean;
	isDetached?: boolean;
	backgroundRef?: RefObject<HTMLElement | null>;
	shouldScaleBackground?: boolean;
}

export function Sheet({ open, onOpenChange, title, children, footer, placement = "bottom", snapPoints = [], activeSnapPoint, onActiveSnapPointChange, isDismissable = true, isDetached = false, backgroundRef, shouldScaleBackground = false }: SheetProps) {
	const reduced = useReducedMotion();
	const parent = useContext(ParentSheet);

	const [localSnap, setLocalSnap] = useState(snapPoints.at(-1) ?? 1);

	const snap = activeSnapPoint ?? localSnap;
	const horizontal = placement === "left" || placement === "right";
	const sign = placement === "left" || placement === "top" ? -1 : 1;
	const axis = horizontal ? "X" : "Y";

	const transform = (distance: string) => `translate${axis}(${distance})`;

	function changeSnap(point: number) {
		const bounded = Math.max(0.1, Math.min(1, point));
		setLocalSnap(bounded);
		onActiveSnapPointChange?.(bounded);
	}

	const dragged = useRef(false);
	const pointer = useRef<{ coordinate: number; time: number } | null>(null);
	const panel = useRef<HTMLElement>(null);

	useEffect(() => {
		if (!open || !window.visualViewport) return;
		const viewport = window.visualViewport;

		function resize() {
			panel.current?.style.setProperty("--pb-sheet-viewport", `${viewport.height}px`);
		}

		resize();
		viewport.addEventListener("resize", resize);

		return () => viewport.removeEventListener("resize", resize);
	}, [open]);

	useEffect(() => {
		const background = parent?.current ?? (shouldScaleBackground ? backgroundRef?.current : null);
		if (!open || !background) return;
		const previous = getComputedStyle(background).transform;
		const animation = background.animate([{ transform: previous }, { transform: "scale(.96) translateY(-8px)", borderRadius: "8px", overflow: "hidden" }], { duration: reduced ? 0 : 500, easing: "cubic-bezier(.32,.72,0,1)", fill: "forwards" });

		return () => {
			const current = getComputedStyle(background).transform;
			animation.cancel();
			background.animate([{ transform: current }, { transform: previous }], { duration: reduced ? 0 : 500, easing: "cubic-bezier(.32,.72,0,1)" });
		};
	}, [open, parent, backgroundRef, shouldScaleBackground, reduced]);

	async function animate(overlay: HTMLElement, entering: boolean) {
		if (reduced) return;
		const dialog = overlay.querySelector<HTMLElement>('[data-slot="drawer-dialog"]');
		if (!dialog) return;
		const animation = dialog.animate([{ transform: entering ? transform(`${sign * 100}%`) : getComputedStyle(dialog).transform }, { transform: entering ? transform("0") : transform(`${sign * 100}%`) }], { duration: 500, easing: "cubic-bezier(.32,.72,0,1)" });
		await animation.finished.catch(() => {});
	}

	function settle() {
		if (!panel.current) return;
		const element = panel.current;
		element.animate([{ transform: element.style.transform || transform("0") }, { transform: transform("0") }], { duration: reduced ? 0 : 500, easing: "cubic-bezier(.32,.72,0,1)" });
		element.style.transform = "";
	}

	return (
		<Drawer.Backdrop isOpen={open} isDismissable={isDismissable} onOpenChange={onOpenChange} onEnter={(element) => animate(element, true)} onExit={(element) => animate(element, false)}>
			<Drawer.Content placement={placement} className={`pb-sheet-position ${horizontal ? "pb-sheet-side" : ""} ${isDetached ? "pb-sheet-detached" : ""}`}>
				<Drawer.Dialog className='pb-sheet-dialog' aria-label={title} style={snapPoints.length ? (horizontal ? { width: `${snap * 100}vw` } : { height: `${snap * 100}dvh` }) : undefined}>
					<div
						className='pb-sheet-panel'
						ref={(element) => {
							panel.current = element?.closest<HTMLElement>('[data-slot="drawer-dialog"]') ?? null;
						}}
					>
						<button
							type='button'
							aria-label='Drag down or press to close sheet'
							onKeyDown={(event) => {
								if (snapPoints.length && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
									event.preventDefault();
									const ordered = [...snapPoints].sort((a, b) => a - b);
									const index = ordered.indexOf(snap);
									changeSnap(ordered[Math.max(0, Math.min(ordered.length - 1, index + (event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1)))]);
								}
							}}
							className='pb-sheet-handle'
							onClick={(event) => {
								if (isDismissable && (event.detail === 0 || !dragged.current)) onOpenChange(false);
							}}
							onPointerDown={(event) => {
								if (event.button !== 0 || !event.isPrimary) return;
								panel.current?.getAnimations().forEach((animation) => animation.finish());
								dragged.current = false;
								pointer.current = { coordinate: horizontal ? event.clientX : event.clientY, time: performance.now() };
								event.currentTarget.setPointerCapture(event.pointerId);
							}}
							onPointerMove={(event) => {
								if (pointer.current && panel.current) {
									const distance = ((horizontal ? event.clientX : event.clientY) - pointer.current.coordinate) * sign;
									if (Math.abs(distance) > 8) dragged.current = true;
									panel.current.style.transform = transform(`${Math.max(snapPoints.length ? -2000 : 0, distance) * sign}px`);
								}
							}}
							onPointerCancel={() => {
								pointer.current = null;
								settle();
							}}
							onPointerUp={(event) => {
								if (!pointer.current) return;
								const distance = ((horizontal ? event.clientX : event.clientY) - pointer.current.coordinate) * sign;
								const velocity = distance / Math.max(1, performance.now() - pointer.current.time);
								pointer.current = null;
								if (snapPoints.length) {
									const viewport = horizontal ? innerWidth : innerHeight;
									const projected = snap - (distance + velocity * 120) / viewport;
									const points = isDismissable ? [0, ...snapPoints] : snapPoints;
									const closest = points.reduce((best, point) => (Math.abs(point - projected) < Math.abs(best - projected) ? point : best), points[0]);
									if (closest === 0) onOpenChange(false);
									else {
										changeSnap(closest);
										settle();
									}
								} else if (isDismissable && (distance > (horizontal ? (panel.current?.offsetWidth ?? 400) : (panel.current?.offsetHeight ?? 400)) * 0.25 || (distance > 8 && velocity > 0.4))) onOpenChange(false);
								else settle();
							}}
						>
							<span />
						</button>
						<Drawer.Header className='pb-sheet-header'>
							<Drawer.Heading className='min-w-0 flex-1 text-start'>{title}</Drawer.Heading>
							<Button isIconOnly variant='ghost' size='sm' aria-label='Close sheet' onPress={() => onOpenChange(false)}>
								<IconX size={18} />
							</Button>
						</Drawer.Header>
						<Drawer.Body className='pb-sheet-body'>
							<ParentSheet value={panel}>{children}</ParentSheet>
						</Drawer.Body>
						{footer && <Drawer.Footer>{footer}</Drawer.Footer>}
					</div>
				</Drawer.Dialog>
			</Drawer.Content>
		</Drawer.Backdrop>
	);
}
