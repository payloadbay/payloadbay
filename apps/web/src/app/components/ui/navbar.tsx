"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@heroui/react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import "./catalog.css";

export interface NavbarProps {
	brand: ReactNode;
	links: Array<{ label: string; href: string }>;
	actions?: ReactNode;
	activeHref?: string;
	hideOnScroll?: boolean;
	scrollRef?: RefObject<HTMLElement | null>;
	className?: string;
	navigate?: (href: string) => void;
	position?: "static" | "floating";
}

export function Navbar({ brand, links, actions, activeHref, hideOnScroll = false, scrollRef, className = "", navigate, position = "static" }: NavbarProps) {
	const [open, setOpen] = useState(false);
	const [hidden, setHidden] = useState(false);
	const header = useRef<HTMLElement>(null);
	const menu = useRef<HTMLElement>(null);
	const toggle = useRef<HTMLButtonElement>(null);

	const menuId = useId();

	useEffect(() => {
		if (!open) return;
		const overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const fit = () => {
			if (header.current) header.current.style.setProperty("--pb-navbar-menu-height", `${Math.max(0, innerHeight - header.current.getBoundingClientRect().bottom)}px`);
		};

		fit();
		window.addEventListener("resize", fit);
		const frame = requestAnimationFrame(() => menu.current?.querySelector("a")?.focus());

		return () => {
			document.body.style.overflow = overflow;
			window.removeEventListener("resize", fit);
			cancelAnimationFrame(frame);
		};
	}, [open]);

	const reduced = useReducedMotion();

	useEffect(() => {
		if (!hideOnScroll) return;
		const parent = scrollRef?.current;
		const target = parent ?? window;
		let previous = parent?.scrollTop ?? window.scrollY;

		function scroll() {
			const next = parent?.scrollTop ?? window.scrollY;
			setHidden(next > previous && next > (header.current?.offsetHeight ?? 64));
			previous = next;
		}

		target.addEventListener("scroll", scroll, { passive: true });

		return () => target.removeEventListener("scroll", scroll);
	}, [hideOnScroll, scrollRef]);

	useEffect(() => {
		const query = matchMedia("(min-width: 768px)");

		function resize() {
			if (query.matches) setOpen(false);
		}

		query.addEventListener("change", resize);

		return () => query.removeEventListener("change", resize);
	}, []);

	function Links() {
		return (
			<>
				{links.map((link) => (
					<a
						key={link.href}
						href={link.href}
						aria-current={link.href === activeHref ? "page" : undefined}
						onClick={(event) => {
							setOpen(false);
							if (navigate && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
								event.preventDefault();
								navigate(link.href);
							}
						}}
					>
						{link.label}
					</a>
				))}
			</>
		);
	}

	return (
		<motion.header ref={header} className={`pb-navbar ${className}`} data-position={position} animate={{ y: hideOnScroll && hidden && !open ? "-100%" : 0 }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 40 }}>
			<div className='font-semibold'>{brand}</div>
			<nav className='pb-navbar-links' aria-label='Primary navigation'>
				{Links()}
			</nav>
			<div className='ml-auto flex items-center gap-2'>
				{actions}
				<Button ref={toggle} className='pb-navbar-toggle' isIconOnly variant='ghost' aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls={menuId} onPress={() => setOpen((current) => !current)}>
					{open ? <IconX size={18} /> : <IconMenu2 size={18} />}
				</Button>
			</div>
			<AnimatePresence>
				{open && (
					<motion.nav
						ref={menu}
						id={menuId}
						className='pb-navbar-mobile'
						aria-label='Mobile navigation'
						initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
						transition={{ duration: reduced ? 0 : 0.2 }}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								setOpen(false);
								toggle.current?.focus();
							}

							if (event.key === "Tab") {
								const links = [...event.currentTarget.querySelectorAll<HTMLElement>("a")];
								if (!event.shiftKey && document.activeElement === links.at(-1)) {
									event.preventDefault();
									toggle.current?.focus();
								}

								if (event.shiftKey && document.activeElement === links[0]) {
									event.preventDefault();
									toggle.current?.focus();
								}
							}
						}}
					>
						{Links()}
					</motion.nav>
				)}
			</AnimatePresence>
		</motion.header>
	);
}
