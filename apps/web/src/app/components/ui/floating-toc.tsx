"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Popover } from "@heroui/react";
import "./catalog.css";

export type TocItem = { id: string; label: string; level?: number };

export interface FloatingTocProps {
	items: TocItem[];
	activeId?: string;
	onNavigate?: (id: string) => void;
	trigger?: "hover" | "click";
	openDelay?: number;
	closeDelay?: number;
	placement?: "left" | "right";
}

export function FloatingToc({ items, activeId, onNavigate, trigger = "hover", openDelay = 200, closeDelay = 300, placement = "right" }: FloatingTocProps) {
	const [visible, setVisible] = useState("");
	const [open, setOpen] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	function schedule(value: boolean) {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setOpen(value), value ? openDelay : closeDelay);
	}

	useEffect(() => () => clearTimeout(timer.current), []);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const candidate = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
				if (candidate) setVisible(candidate.target.id);
			},
			{ rootMargin: "-5% 0px -65% 0px" },
		);
		items.forEach((item) => {
			const target = document.getElementById(item.id);
			if (target) observer.observe(target);
		});

		return () => observer.disconnect();
	}, [items]);

	const active = activeId ?? visible;

	useEffect(() => {
		if (!open || !active) return;
		const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>(".pb-toc-content [aria-current='location']")?.scrollIntoView({ block: "nearest" }));

		return () => cancelAnimationFrame(frame);
	}, [open, active]);

	return (
		<Popover isOpen={open} onOpenChange={setOpen}>
			<Button
				aria-label='Table of contents'
				variant='ghost'
				className='pb-toc-trigger'
				onFocus={() => {
					if (trigger === "hover") schedule(true);
				}}
			>
				<span
					className='pb-toc-bars'
					aria-hidden='true'
					onPointerEnter={(event) => {
						if (trigger === "hover" && event.pointerType === "mouse") schedule(true);
					}}
					onPointerLeave={(event) => {
						if (trigger === "hover" && event.pointerType === "mouse") schedule(false);
					}}
				>
					{items.map((item) => (
						<span key={item.id} data-active={active === item.id} style={{ width: Math.max(7, (active === item.id ? 24 : 16) - Math.max(0, (item.level ?? 1) - 1) * 3) }} />
					))}
				</span>
			</Button>
			<Popover.Content placement={placement === "left" ? "right" : "left"} className='pb-toc-popover' isNonModal onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={() => schedule(false)}>
				<Popover.Dialog className='pb-toc-content'>
					<nav aria-label='Table of contents'>
						{items.map((item) => (
							<a
								key={item.id}
								href={`#${encodeURIComponent(item.id)}`}
								aria-current={active === item.id ? "location" : undefined}
								style={{ paddingInlineStart: 12 + Math.max(0, (item.level ?? 1) - 1) * 12 }}
								onClick={(event) => {
									event.preventDefault();
									if (onNavigate) onNavigate(item.id);
									else {
										document.getElementById(item.id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
										history.replaceState(null, "", `#${encodeURIComponent(item.id)}`);
									}

									setVisible(item.id);
									setOpen(false);
								}}
							>
								{item.label}
							</a>
						))}
					</nav>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
