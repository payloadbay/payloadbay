"use client";

import type { ReactElement, ReactNode } from "react";
import { Card } from "@heroui/react";

export type AppSectionProps = {
	icon: ReactElement;
	title: string;
	description: string;
	children: ReactNode;
	actions?: ReactNode;
	footer?: ReactNode;
	className?: string;
};

export function AppSection({ icon, title, description, children, actions, footer, className }: AppSectionProps) {
	return (
		<Card className={className} data-app-section>
			<Card.Header className='flex flex-row flex-wrap items-start gap-4' data-slot='app-section-header'>
				<span aria-hidden='true' data-slot='app-section-icon' className='text-accent flex h-7 w-5 shrink-0 items-center justify-center [&>svg]:size-5'>
					{icon}
				</span>
				<div className='min-w-0 flex-[1_1_180px]'>
					<h2 className='text-xl leading-7 font-semibold'>{title}</h2>
					<Card.Description data-slot='app-section-description' className='mt-2 text-sm leading-5'>
						{description}
					</Card.Description>
				</div>
				{actions && (
					<div className='flex flex-wrap items-center gap-2' data-slot='app-section-actions'>
						{actions}
					</div>
				)}
			</Card.Header>
			<Card.Content className='flex min-w-0 flex-col gap-4'>{children}</Card.Content>
			{footer && <Card.Footer className='border-border flex flex-wrap justify-end gap-3 border-t pt-4'>{footer}</Card.Footer>}
		</Card>
	);
}
