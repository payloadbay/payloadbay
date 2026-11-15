"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button, Tooltip } from "@heroui/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "react-aria-components";
import "./primitives.css";

export type SidebarItem = {
	id: string;
	label: string;
	href: string;
	pageId?: string;
	icon: ReactNode;
};

export type SidebarNavigationProps = {
	label: string;
	title: string;
	collapsed: boolean;
	side?: "left" | "right";
	groups: Array<{ label: string; items: SidebarItem[] }>;
	activeId?: string;
	back?: { label: string; accessibleLabel: string; onPress: () => void };
	onNavigate?: (event: MouseEvent, item: SidebarItem) => void;
};

export function SidebarNavigation({ label, title, collapsed, side = "left", groups, activeId, back, onNavigate }: SidebarNavigationProps) {
	return (
		<nav aria-label={label} className='pb-navigation'>
			{back && (
				<Button variant='ghost' className='pb-scope-back' aria-label={back.accessibleLabel} onPress={back.onPress}>
					<IconArrowLeft size={16} />
					<span>{back.label}</span>
				</Button>
			)}
			{title && <h3 className='pb-navigation-title'>{title}</h3>}
			{groups.map((group) => (
				<section key={group.label} aria-label={group.label}>
					{group.label && <p className='pb-navigation-group'>{group.label}</p>}
					<div className='pb-navigation-items'>
						{group.items.map((item) => (
							<Tooltip key={item.id} delay={0} isDisabled={!collapsed}>
								<Link href={item.href} aria-label={item.label} aria-current={activeId === item.id ? "page" : undefined} className='pb-navigation-item' onClick={(event) => onNavigate?.(event, item)}>
									{item.icon}
									<span className='pb-navigation-label'>{item.label}</span>
								</Link>
								<Tooltip.Content placement={side === "left" ? "right" : "left"}>{item.label}</Tooltip.Content>
							</Tooltip>
						))}
					</div>
				</section>
			))}
		</nav>
	);
}

export interface SidebarPage {
	id: string;
	title: string;
	parentId?: string;
	groups: SidebarNavigationProps["groups"];
}

export interface ContextualSidebarProps extends Omit<SidebarNavigationProps, "groups" | "title" | "back"> {
	pages: SidebarPage[];
	defaultPageId: string;
	pageId?: string;
	onPageChange?: (id: string) => void;
}

export function ContextualSidebar({ pages, defaultPageId, pageId, onPageChange, onNavigate, ...props }: ContextualSidebarProps) {
	const [localPage, setLocalPage] = useState(defaultPageId);
	const [backwards, setBackwards] = useState(false);

	const reduced = useReducedMotion();

	const current = pages.find((page) => page.id === (pageId ?? localPage)) ?? pages[0];
	if (!current) return null;
	const parent = pages.find((page) => page.id === current.parentId);

	function change(id: string, back: boolean) {
		setBackwards(back);
		setLocalPage(id);
		onPageChange?.(id);
	}

	return (
		<AnimatePresence mode='wait' initial={false}>
			<motion.div key={current.id} initial={reduced ? { opacity: 0 } : { opacity: 0, x: backwards ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, x: backwards ? 16 : -16 }} transition={{ duration: reduced ? 0 : 0.2 }}>
				<SidebarNavigation
					{...props}
					title={current.title}
					groups={current.groups}
					back={parent ? { label: parent.title, accessibleLabel: `Back to ${parent.title}`, onPress: () => change(parent.id, true) } : undefined}
					onNavigate={(event, item) => {
						if (item.pageId && pages.some((page) => page.id === item.pageId)) {
							event.preventDefault();
							change(item.pageId, false);
						} else onNavigate?.(event, item);
					}}
				/>
			</motion.div>
		</AnimatePresence>
	);
}
