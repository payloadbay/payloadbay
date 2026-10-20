"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Button, Chip } from "@heroui/react";
import { useLocale } from "react-aria-components";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import "./catalog.css";

export interface NumberValueProps extends Omit<ComponentProps<"span">, "prefix"> {
	value: number;
	format?: Intl.NumberFormatOptions;
	locales?: Intl.LocalesArgument;
	prefix?: ReactNode;
	suffix?: ReactNode;
}

export function NumberValue({ value, format, locales, prefix, suffix, ...props }: NumberValueProps) {
	const { locale } = useLocale();

	return (
		<span {...props}>
			{prefix}
			{new Intl.NumberFormat(locales ?? locale, format).format(value)}
			{suffix}
		</span>
	);
}

export function TextShimmer({ children, className = "", active = true }: { children: ReactNode; className?: string; active?: boolean }) {
	return (
		<span className={`pb-text-shimmer ${className}`} data-active={active}>
			{children}
		</span>
	);
}

export function TrendChip({ trend, children, positive = "up", ...props }: Omit<ComponentProps<typeof Chip>, "children" | "color"> & { trend: "up" | "down" | "neutral"; children: ReactNode; positive?: "up" | "down" }) {
	const Icon = trend === "up" ? IconArrowUp : trend === "down" ? IconArrowDown : null;

	return (
		<Chip color={trend === "neutral" ? "default" : trend === positive ? "success" : "danger"} variant='soft' size='sm' {...props}>
			{Icon && <Icon size={12} />}
			<Chip.Label>{children}</Chip.Label>
		</Chip>
	);
}

export type PressableFeedbackProps = Omit<ComponentProps<typeof Button>, "onPress" | "children"> & {
	children: ReactNode;
	onPress: () => void;
	holdDuration?: number;
	progress?: number;
	feedback?: "ripple" | "highlight";
	progressDirection?: "left" | "right" | "up" | "down";
	progressDuration?: number;
	resetDelay?: number;
};

export function PressableFeedback({ children, onPress, holdDuration, isDisabled, onPressStart, onPressEnd, progress: controlledProgress, feedback = "ripple", progressDirection = "right", progressDuration, resetDelay = 1500, ...props }: PressableFeedbackProps) {
	const reduced = useReducedMotion();

	const [progress, setProgress] = useState(0);
	const [timedProgress, setTimedProgress] = useState(0);
	const progressing = useRef(false);
	const progressFrame = useRef(0);
	const [holding, setHolding] = useState(false);
	const [ripples, setRipples] = useState<
		Array<{
			id: number;
			x: number;
			y: number;
			size: number;
			started: number;
			released: boolean;
		}>
	>([]);
	const serial = useRef(0);
	const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const touchPending = useRef<(() => void) | null>(null);
	const pendingRipples = useRef(new Map<number, number>());
	const releaseTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const started = useRef(0);
	const frame = useRef(0);

	function stop() {
		clearTimeout(touchTimer.current);
		for (const [id, time] of pendingRipples.current) {
			const timer = setTimeout(
				() => {
					releaseTimers.current.delete(timer);
					setRipples((items) => items.map((item) => (item.id === id ? { ...item, released: true } : item)));
				},
				Math.max(0, 225 - (performance.now() - time)),
			);
			releaseTimers.current.add(timer);
		}

		pendingRipples.current.clear();
		cancelAnimationFrame(frame.current);
		setHolding(false);
		setProgress(0);
	}

	useEffect(
		() => () => {
			cancelAnimationFrame(frame.current);
			cancelAnimationFrame(progressFrame.current);
			clearTimeout(touchTimer.current);
			for (const timer of releaseTimers.current) clearTimeout(timer);
		},
		[],
	);

	function start(event: Parameters<NonNullable<ComponentProps<typeof Button>["onPressStart"]>>[0]) {
		clearTimeout(touchTimer.current);
		touchPending.current = null;
		if (!isDisabled) setHolding(true);
		if (!holdDuration && !isDisabled && feedback === "ripple") {
			const rect = event.target.getBoundingClientRect();
			const ripple = {
				id: ++serial.current,
				x: event.pointerType === "keyboard" ? rect.width / 2 : event.x,
				y: event.pointerType === "keyboard" ? rect.height / 2 : event.y,
				size: Math.hypot(rect.width, rect.height) * 2,
				started: performance.now(),
				released: false,
			};

			const add = () => {
				const now = { ...ripple, started: performance.now() };
				pendingRipples.current.set(now.id, now.started);
				setRipples((current) => [...current.slice(-2), now]);
			};

			if (event.pointerType === "touch") {
				touchPending.current = add;
				touchTimer.current = setTimeout(() => {
					touchPending.current = null;
					add();
				}, 150);
			} else add();
		}

		if (!holdDuration || !Number.isFinite(holdDuration) || isDisabled) return;
		setHolding(true);
		started.current = performance.now();

		const tick = () => {
			const next = Math.min(1, (performance.now() - started.current) / Math.max(300, holdDuration));
			setProgress(next);
			if (next === 1) {
				onPress();
			} else frame.current = requestAnimationFrame(tick);
		};

		frame.current = requestAnimationFrame(tick);
	}

	return (
		<motion.span className='pb-pressable' whileTap={reduced ? undefined : { scale: 0.97 }}>
			<Button
				{...props}
				isDisabled={isDisabled}
				onPressStart={(event) => {
					start(event);
					onPressStart?.(event);
				}}
				onPressEnd={(event) => {
					stop();
					onPressEnd?.(event);
				}}
				onPress={() => {
					if (touchPending.current) {
						const add = touchPending.current;
						touchPending.current = null;
						add();
						stop();
					}

					if (holdDuration) return;
					if (!progressDuration) {
						onPress();

						return;
					}

					if (progressing.current) return;
					progressing.current = true;
					const beginning = performance.now();

					function tick() {
						const next = Math.min(1, (performance.now() - beginning) / Math.max(1, progressDuration ?? 1));
						setTimedProgress(next);
						if (next < 1) progressFrame.current = requestAnimationFrame(tick);
						else {
							onPress();
							const timer = setTimeout(() => {
								releaseTimers.current.delete(timer);
								progressing.current = false;
								setTimedProgress(0);
							}, resetDelay);
							releaseTimers.current.add(timer);
						}
					}

					progressFrame.current = requestAnimationFrame(tick);
				}}
				className={(state) => `relative overflow-hidden ${typeof props.className === "function" ? props.className(state) : (props.className ?? "")}`}
			>
				{ripples.map((ripple) => (
					<motion.span
						key={ripple.id}
						aria-hidden='true'
						className='pb-press-ripple'
						style={{
							width: ripple.size,
							height: ripple.size,
							left: ripple.x - ripple.size / 2,
							top: ripple.y - ripple.size / 2,
						}}
						initial={{ scale: 0, opacity: 0 }}
						animate={{ scale: 1, opacity: ripple.released ? 0 : 0.12 }}
						transition={{ scale: { duration: 0.15, ease: "easeOut" }, opacity: { duration: ripple.released ? 0.375 : 0.075 } }}
						onAnimationComplete={() => {
							if (ripple.released) setRipples((current) => current.filter((item) => item.id !== ripple.id));
						}}
					/>
				))}
				{holdDuration && <span aria-hidden='true' className='pb-hold-progress' data-holding={holding || undefined} style={{ width: `${progress * 100}%` }} />}
				{feedback === "highlight" && <motion.span aria-hidden='true' className='absolute inset-0 bg-current' animate={{ opacity: holding ? 0.12 : 0 }} transition={{ duration: 0.15 }} />}
				{(controlledProgress !== undefined || progressDuration !== undefined) && (
					<motion.span aria-hidden='true' className='pb-hold-progress' style={{ width: "100%", transformOrigin: progressDirection === "right" ? "left" : progressDirection === "left" ? "right" : progressDirection === "up" ? "bottom" : "top", height: "100%" }} initial={false} animate={{ [progressDirection === "up" || progressDirection === "down" ? "scaleY" : "scaleX"]: Math.max(0, Math.min(1, controlledProgress ?? timedProgress)) }} transition={{ duration: reduced ? 0 : 0.2 }} />
				)}
				<span className='relative'>{children}</span>
			</Button>
		</motion.span>
	);
}
