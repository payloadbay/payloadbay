"use client";

import { useContext, useEffect, type ReactNode } from "react";

import { Dialog, Focusable, OverlayTriggerStateContext, Popover, PreviewTrigger } from "react-aria-components";
import "./catalog.css";

function EscapeDismissal() {
	const state = useContext(OverlayTriggerStateContext);

	useEffect(() => {
		if (!state?.isOpen) return;

		function dismiss(event: KeyboardEvent) {
			if (event.key === "Escape") state?.close();
		}

		document.addEventListener("keydown", dismiss);

		return () => document.removeEventListener("keydown", dismiss);
	}, [state]);

	return null;
}

function PreviewButton({ label }: { label: string }) {
	const state = useContext(OverlayTriggerStateContext);

	return (
		<Focusable>
			<button
				type='button'
				className='pb-hover-trigger'
				onPointerEnter={(event) => {
					// A first mouse hover must also open before React Aria has recorded an input modality.
					if (event.pointerType === "mouse") state?.open();
				}}
				onPointerLeave={() => {
					if (!state?.isOpen) state?.close();
				}}
			>
				{label}
			</button>
		</Focusable>
	);
}

export interface HoverCardProps {
	label: string;
	children: ReactNode;
	openDelay?: number;
	closeDelay?: number;
}

export function HoverCard({ label, children, openDelay = 700, closeDelay = 300 }: HoverCardProps) {
	return (
		<PreviewTrigger delay={openDelay} closeDelay={closeDelay}>
			<PreviewButton label={label} />
			<Popover placement='top' offset={8} className='pb-hover-popover'>
				<Dialog aria-label={`${label} details`} className='pb-hover-card'>
					<EscapeDismissal />
					{children}
				</Dialog>
			</Popover>
		</PreviewTrigger>
	);
}
