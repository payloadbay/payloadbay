"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import type { AnyApiReferenceConfiguration } from "@scalar/api-reference-react";
import { LoadingState } from "@components/loading-state";
import { PreviewNotice } from "@components/preview-notice";
import "@scalar/api-reference-react/style.css";

const ApiReference = dynamic(() => import("@scalar/api-reference-react").then((module) => module.ApiReferenceReact), {
	ssr: false,
	loading: () => <LoadingState label='Loading API documentation…' size='page' />,
});

const configuration: AnyApiReferenceConfiguration = {
	url: "/api/openapi.json",
	withDefaultFonts: false,
	darkMode: true,
	persistAuth: false,
	telemetry: false,
	hideClientButton: false,
	agent: { disabled: true },
	proxyUrl: "",
	authentication: { preferredSecurityScheme: "apiToken" },
	customCss: ':root { --scalar-font: "Inter Variable", Inter, sans-serif; }',
	customFetch: (input, init) => {
		const target = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
		if (target.origin !== window.location.origin) throw Error("The Payload Bay API console sends requests only to this installation.");
		const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
		const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
		if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("x-payloadbay-csrf", "1");

		return fetch(input, {
			...init,
			headers,
			credentials: "same-origin",
			redirect: "error",
		});
	},
};

export default function ApiDocumentationPage() {
	const header = useRef<HTMLElement>(null);

	useEffect(() => {
		const element = header.current;
		const container = element?.parentElement;
		if (!element || !container) return;

		const update = () => container.style.setProperty("--scalar-custom-header-height", `${element.getBoundingClientRect().height}px`);

		const observer = new ResizeObserver(update);
		observer.observe(element);
		update();

		return () => observer.disconnect();
	}, []);

	return (
		<main className='min-w-0 flex-1'>
			<header ref={header} className='border-border bg-background sticky top-0 z-20 border-b'>
				<div className='hidden [[data-preview=true]_&]:block'>
					<PreviewNotice />
				</div>
				<div className='flex min-h-12 items-center px-4'>
					<Link href='/' className='text-accent inline-flex min-h-11 items-center gap-2 text-sm font-medium'>
						<IconArrowLeft size={18} aria-hidden='true' />
						Back to Payload Bay
					</Link>
				</div>
			</header>
			<ApiReference configuration={configuration} />
		</main>
	);
}
