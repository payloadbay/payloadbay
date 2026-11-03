"use client";

import { Children, isValidElement, useEffect, useState, type ReactNode } from "react";
import { Button, Tooltip, toast } from "@heroui/react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { Streamdown } from "streamdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { BundledLanguage, ThemedToken } from "shiki/bundle/web";
import "./catalog.css";

export interface CodeBlockProps {
	code: string;
	language?: BundledLanguage | "text";
	title?: ReactNode;
	lineNumbers?: boolean;
}

export function CodeBlock({ code, language = "text", title, lineNumbers = false }: CodeBlockProps) {
	const [highlight, setHighlight] = useState<{ code: string; language: string; lines: ThemedToken[][] } | null>(null);
	const [copied, setCopied] = useState(false);

	const reduced = useReducedMotion();

	useEffect(() => {
		let active = true;
		let request = 0;

		function highlightCode() {
			const revision = ++request;
			const dark = document.documentElement.dataset.theme === "dark" || getComputedStyle(document.documentElement).colorScheme.includes("dark");
			import("shiki/bundle/web")
				.then(({ codeToTokens }) => codeToTokens(code, { lang: language, theme: dark ? "github-dark" : "github-light" }))
				.then((result) => {
					if (active && revision === request) setHighlight({ code, language, lines: result.tokens });
				})
				.catch(() => {
					/* Unsupported languages remain escaped plain text. */
				});
		}

		highlightCode();
		const observer = new MutationObserver(highlightCode);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

		return () => {
			active = false;
			observer.disconnect();
		};
	}, [code, language]);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 2000);

		return () => clearTimeout(timer);
	}, [copied]);

	const lines = highlight?.code === code && highlight.language === language ? highlight.lines : code.split("\n").map((content) => [{ content }]);

	const displayed = code.endsWith("\n") && lines.at(-1)?.every((token) => token.content === "") ? lines.slice(0, -1) : lines;

	return (
		<figure className='pb-code-block'>
			<figcaption>
				<span>{title ?? language}</span>
				<Tooltip>
					<Button
						isIconOnly
						variant='ghost'
						size='sm'
						aria-label={copied ? "Copied code" : "Copy code"}
						onPress={async () => {
							try {
								await navigator.clipboard.writeText(code);
								setCopied(true);
							} catch {
								toast.danger("Could not copy code");
							}
						}}
					>
						<AnimatePresence mode='wait' initial={false}>
							<motion.span key={copied ? "copied" : "copy"} className='inline-flex' initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.25, filter: "blur(4px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.25, filter: "blur(4px)" }} transition={reduced ? { duration: 0.12 } : { type: "spring", bounce: 0, duration: 0.3 }}>
								{copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
							</motion.span>
						</AnimatePresence>
					</Button>
					<Tooltip.Content>{copied ? "Copied" : "Copy code"}</Tooltip.Content>
				</Tooltip>
			</figcaption>
			<pre tabIndex={0} aria-label={`${language} code`}>
				<code>
					{displayed.map((line, index) => (
						<span className='pb-code-line' key={index}>
							{lineNumbers && (
								<span className='pb-line-number' aria-hidden='true'>
									{index + 1}
								</span>
							)}
							{line.map((token, part) => (
								<span key={part} style={{ color: "color" in token && typeof token.color === "string" ? token.color : undefined }}>
									{token.content}
								</span>
							))}
							{"\n"}
						</span>
					))}
				</code>
			</pre>
		</figure>
	);
}

export function Markdown({ children, streaming = false, isAnimating = false }: { children: string; streaming?: boolean; isAnimating?: boolean }) {
	if (streaming)
		return (
			<div className='pb-markdown'>
				<Streamdown mode='streaming' isAnimating={isAnimating} skipHtml controls={false} remarkPlugins={[remarkGfm, remarkBreaks]}>
					{children}
				</Streamdown>
			</div>
		);

	return (
		<div className='pb-markdown'>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				skipHtml
				components={{
					pre: ({ children: contents }) => {
						const code = Children.toArray(contents).find((child) => isValidElement<{ className?: string; children?: ReactNode }>(child));
						if (!isValidElement<{ className?: string; children?: ReactNode }>(code)) return <pre>{contents}</pre>;
						const language = /\blanguage-([\w+-]+)/.exec(code.props.className ?? "")?.[1] ?? "text";

						return <CodeBlock code={String(code.props.children ?? "")} language={language as BundledLanguage} />;
					},
				}}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
}
