"use client";

import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import "./primitives.css";

export interface SetupStep {
	id: string;
	title: ReactNode;
	description?: ReactNode;
	isDisabled?: boolean;
}

export type SetupStepsProps = {
	currentStep: number;
	items: Array<string | SetupStep>;
	orientation?: "horizontal" | "vertical";
	onStepChange?: (step: number) => void;
	size?: "sm" | "md" | "lg";
	reduceMotion?: boolean;
	className?: string;
	style?: CSSProperties;
};

export function SetupSteps({ currentStep, items, size = "md", reduceMotion, className = "", style, orientation = "horizontal", onStepChange }: SetupStepsProps) {
	const systemReduced = useReducedMotion();

	const reduced = reduceMotion ?? Boolean(systemReduced);
	const duration = reduced ? 0 : 0.3;

	return (
		<ol aria-label='Setup progress' className={`pb-steps ${className}`} style={style} data-size={size} data-orientation={orientation} data-motion={reduced ? "reduced" : "enabled"}>
			{items.map((item, index) => {
				const step = typeof item === "string" ? { id: item, title: item } : item;
				const title = step.title;
				const progress = Math.min(1, Math.max(0, currentStep - index));
				const complete = index < Math.floor(currentStep);
				const active = index === Math.floor(currentStep);

				return (
					<li key={step.id} aria-current={active ? "step" : undefined} className='pb-step'>
						{index < items.length - 1 && (
							<span aria-hidden='true' className='pb-step-connector'>
								<span className='pb-step-fill' style={{ transform: `${orientation === "vertical" ? "scaleY" : "scaleX"}(${progress})` }} />
							</span>
						)}
						<motion.span
							className='pb-step-indicator'
							role={onStepChange ? "button" : undefined}
							tabIndex={onStepChange && !step.isDisabled ? 0 : undefined}
							aria-disabled={step.isDisabled || undefined}
							aria-label={onStepChange ? `Go to step ${index + 1}` : undefined}
							onClick={() => {
								if (!step.isDisabled) onStepChange?.(index);
							}}
							onKeyDown={(event) => {
								if (onStepChange && !step.isDisabled && (event.key === "Enter" || event.key === " ")) {
									event.preventDefault();
									onStepChange(index);
								}
							}}
							initial={false}
							animate={{
								backgroundColor: complete ? "var(--pb-step-accent, var(--accent))" : "var(--surface)",
								borderColor: complete || active ? "var(--pb-step-accent, var(--accent))" : "var(--border)",
								scale: complete && !reduced ? [1, 1.12, 1] : 1,
								color: complete ? "var(--pb-step-foreground, var(--accent-foreground))" : active ? "var(--pb-step-accent, var(--accent))" : "var(--muted)",
							}}
							transition={{ duration }}
						>
							<AnimatePresence mode='wait' initial={false}>
								<motion.span key={complete ? "complete" : "number"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration / 4 }}>
									{complete ? (
										<svg width='14' height='14' viewBox='0 0 16 16' aria-label='Completed'>
											<motion.path d='M3 8.5 6.5 12 13 4' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration }} />
										</svg>
									) : (
										index + 1
									)}
								</motion.span>
							</AnimatePresence>
						</motion.span>
						<span className={complete || active ? "pb-step-title text-xs font-medium text-foreground" : "pb-step-title text-xs text-muted"}>
							{title}
							{step.description && <span className='pb-step-description'>{step.description}</span>}
						</span>
					</li>
				);
			})}
		</ol>
	);
}
