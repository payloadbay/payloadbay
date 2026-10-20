"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, Dropdown, Label } from "@heroui/react";
import "./catalog.css";

export type ContextMenuAction = {
	id: string;
	label: string;
	icon?: ReactNode;
	isDisabled?: boolean;
	danger?: boolean;
	children?: ContextMenuAction[];
};

export interface ContextMenuProps {
	children: ReactNode;
	items: ContextMenuAction[];
	onAction: (id: string) => void;
	label?: string;
}

export function ContextMenu({ children, items, onAction, label = "Actions" }: ContextMenuProps) {
	const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
	const target = useRef<HTMLDivElement>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const origin = useRef({ x: 0, y: 0 });

	function cancelHold() {
		clearTimeout(timer.current);
	}

	useEffect(() => () => clearTimeout(timer.current), []);

	function open(x: number, y: number) {
		setPosition({ x: Math.min(innerWidth - 16, Math.max(8, x)), y: Math.min(innerHeight - 16, Math.max(8, y)) });
	}

	function renderActions(actions: ContextMenuAction[]): ReactNode {
		return actions.map((item) => {
			const content = (
				<Dropdown.Item id={item.id} textValue={item.label} isDisabled={item.isDisabled} variant={item.danger ? "danger" : undefined}>
					{item.icon}
					<Label>{item.label}</Label>
					{item.children?.length ? <Dropdown.SubmenuIndicator /> : null}
				</Dropdown.Item>
			);

			return item.children?.length ? (
				<Dropdown.SubmenuTrigger key={item.id}>
					{content}
					<Dropdown.Popover placement='right top'>
						<Dropdown.Menu aria-label={item.label} onAction={(id) => onAction(String(id))}>
							{renderActions(item.children)}
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown.SubmenuTrigger>
			) : (
				<Dropdown.Item id={item.id} key={item.id} textValue={item.label} isDisabled={item.isDisabled} variant={item.danger ? "danger" : undefined}>
					{item.icon}
					<Label>{item.label}</Label>
				</Dropdown.Item>
			);
		});
	}

	return (
		<>
			<div
				ref={target}
				className='pb-context-target'
				tabIndex={0}
				aria-haspopup='menu'
				aria-label={label}
				onContextMenu={(event) => {
					event.preventDefault();
					cancelHold();
					open(event.clientX, event.clientY);
				}}
				onKeyDown={(event) => {
					if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
						event.preventDefault();
						const bounds = event.currentTarget.getBoundingClientRect();
						open(bounds.x + 16, bounds.y + 16);
					}
				}}
				onPointerDown={(event) => {
					if (event.pointerType !== "touch") return;
					origin.current = { x: event.clientX, y: event.clientY };
					timer.current = setTimeout(() => open(event.clientX, event.clientY), 550);
				}}
				onPointerMove={(event) => {
					if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) cancelHold();
				}}
				onPointerUp={cancelHold}
				onPointerCancel={cancelHold}
				onPointerLeave={cancelHold}
			>
				{children}
			</div>
			{position &&
				createPortal(
					<Dropdown
						isOpen
						onOpenChange={(next) => {
							if (!next) {
								setPosition(null);
								target.current?.focus();
							}
						}}
					>
						<Button aria-label={label} excludeFromTabOrder className='pb-context-anchor' style={{ left: position.x, top: position.y }} />
						<Dropdown.Popover placement='bottom start' className='pb-context-popover'>
							<Dropdown.Menu aria-label={label} onAction={(id) => onAction(String(id))}>
								{renderActions(items)}
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown>,
					document.body,
				)}
		</>
	);
}
