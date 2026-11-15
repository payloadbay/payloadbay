"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { EmptyState } from "@heroui/react";

export interface ResourceEmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	title: ReactNode;
	description: ReactNode;
	icon?: ReactNode;
	action?: ReactNode;
}

export function ResourceEmptyState({ title, description, icon, action, className = "", ...props }: ResourceEmptyStateProps) {
	return (
		<EmptyState {...props} className={`flex flex-col items-center gap-3 px-4 py-8 text-center ${className}`}>
			{icon && (
				<span aria-hidden='true' className='flex size-12 items-center justify-center rounded-full bg-default text-foreground'>
					{icon}
				</span>
			)}
			<h3 className='text-base font-semibold text-foreground'>{title}</h3>
			<p className='text-sm text-muted'>{description}</p>
			{action}
		</EmptyState>
	);
}
