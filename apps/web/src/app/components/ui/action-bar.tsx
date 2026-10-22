"use client";

import type { ReactNode } from "react";
import { Button, Toolbar } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import "./catalog.css";

export interface ActionBarProps {
	count: number;
	children: ReactNode;
	onClear: () => void;
	label?: string;
}

export function ActionBar({ count, children, onClear, label = "Selection actions" }: ActionBarProps) {
	return (
		<div className='pb-action-bar-position'>
			<AnimatePresence>
				{count > 0 && (
					<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}>
						<Toolbar aria-label={label} className='pb-action-bar'>
							<span className='text-sm font-medium whitespace-nowrap'>{count} selected</span>
							<div className='pb-action-bar-content'>{children}</div>
							<Button size='sm' variant='ghost' aria-label='Clear selection' onPress={onClear}>
								Clear
							</Button>
						</Toolbar>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
