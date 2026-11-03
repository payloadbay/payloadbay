"use client";

import { Spinner } from "@heroui/react";

type LoadingStateProps = {
	label?: string;
	size?: "panel" | "page" | "screen";
};

export function LoadingState({ label = "Loading…", size = "panel" }: LoadingStateProps) {
	const height = size === "screen" ? "min-h-dvh" : size === "page" ? "min-h-[50dvh]" : "min-h-24";

	return (
		<div role='status' aria-live='polite' className={`flex w-full flex-col items-center justify-center gap-3 p-6 text-center ${height}`}>
			<Spinner aria-hidden='true' className='motion-reduce:animate-none' />
			<p className='text-muted text-sm'>{label}</p>
		</div>
	);
}
