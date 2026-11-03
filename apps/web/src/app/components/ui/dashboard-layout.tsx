"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button, Drawer } from "@heroui/react";
import { IconMenu2 } from "@tabler/icons-react";
import { useReducedMotion } from "motion/react";
import "./primitives.css";

export type DashboardLayoutProps = {
	fullscreen?: boolean;
	className?: string;
	navigation: (collapsed: boolean) => ReactNode;
	children: ReactNode;
	brand: ReactNode;
	header?: (toggleNavigation: () => void) => ReactNode;
	navigationLabel: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onClosed: () => void;
	side?: "left" | "right";
	width?: number;
	mobileWidth?: string;
	background?: string;
	reduceMotion?: boolean;
};

export function DashboardLayout({ navigation, children, brand, header, navigationLabel, open, onClosed, onOpenChange: setOpen, fullscreen = true, side = "left", width = 240, mobileWidth = "min(80vw, 500px)", background = "var(--surface)", reduceMotion, className = "" }: DashboardLayoutProps) {
	const [collapsed, setCollapsed] = useState(false);

	const systemReduced = useReducedMotion();

	const reduced = reduceMotion ?? Boolean(systemReduced);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === "b") {
				event.preventDefault();
				if (window.matchMedia("(min-width: 769px)").matches) setCollapsed((value) => !value);
				else setOpen(!open);
			}
		};

		window.addEventListener("keydown", onKey);

		return () => window.removeEventListener("keydown", onKey);
	}, [setOpen, open]);

	useEffect(() => {
		const media = window.matchMedia("(max-width: 768px)");

		const onChange = () => {
			if (!media.matches) setOpen(false);
		};

		media.addEventListener("change", onChange);

		return () => media.removeEventListener("change", onChange);
	}, [setOpen]);

	function animateNavigation(overlay: HTMLElement, entering: boolean) {
		if (reduced) return;
		const dialog = overlay.querySelector<HTMLElement>('[data-slot="drawer-dialog"]');
		if (!dialog) return;
		const edge = side === "left" ? "-100%" : "100%";
		const from = entering ? `translateX(${edge})` : getComputedStyle(dialog).transform;
		const opacity = entering ? "0" : getComputedStyle(overlay).opacity;
		overlay.getAnimations().forEach((animation) => animation.cancel());
		dialog.getAnimations().forEach((animation) => animation.cancel());
		const timing = { duration: entering ? 280 : 200, easing: "cubic-bezier(.22,1,.36,1)" };
		const panelAnimation = dialog.animate([{ transform: from }, { transform: entering ? "translateX(0)" : `translateX(${edge})` }], timing);
		const backdropAnimation = overlay.animate([{ opacity }, { opacity: entering ? "1" : "0" }], timing);

		return Promise.all([panelAnimation.finished, backdropAnimation.finished])
			.then(() => {})
			.catch(() => {});
	}

	const content = navigation(collapsed);

	function toggleNavigation() {
		if (window.matchMedia("(min-width: 769px)").matches) setCollapsed((value) => !value);
		else setOpen(!open);
	}

	return (
		<div className={`pb-layout ${className ?? ""} ${collapsed ? "pb-layout-collapsed" : ""} ${fullscreen ? "pb-layout-fullscreen" : ""}`} data-side={side} data-motion={reduced ? "reduced" : "enabled"} style={{ "--pb-navigation-width": `${width}px`, "--pb-navigation-background": background } as CSSProperties}>
			<aside className='pb-desktop-sidebar'>{content}</aside>
			<header className='pb-layout-header'>
				{header ? (
					header(toggleNavigation)
				) : (
					<>
						<Button isIconOnly variant='ghost' size='sm' aria-label='Open navigation' className='pb-layout-toggle' onPress={toggleNavigation}>
							<IconMenu2 size={18} />
						</Button>
						<span className='font-medium'>{brand}</span>
					</>
				)}
			</header>
			<div className='pb-layout-body'>
				<div className='pb-layout-page'>{children}</div>
			</div>
			<Drawer.Backdrop
				isOpen={open}
				onOpenChange={setOpen}
				className='pb-navigation-backdrop'
				onEnter={(element) => animateNavigation(element, true)}
				onExit={async (element) => {
					await animateNavigation(element, false);
					onClosed();
				}}
			>
				<Drawer.Content placement={side} className='pb-navigation-sheet' data-motion={reduced ? "reduced" : "enabled"}>
					<Drawer.Dialog style={{ "--pb-navigation-mobile-width": mobileWidth, "--pb-navigation-background": background } as CSSProperties} className='pb-navigation-dialog' aria-label={navigationLabel}>
						<Drawer.Heading className='sr-only'>{navigationLabel}</Drawer.Heading>
						<Drawer.Body className='pb-navigation-body'>
							{navigation(false)}
							<Drawer.CloseTrigger aria-label='Close navigation' className='absolute right-3 top-3' />
						</Drawer.Body>
					</Drawer.Dialog>
				</Drawer.Content>
			</Drawer.Backdrop>
		</div>
	);
}
