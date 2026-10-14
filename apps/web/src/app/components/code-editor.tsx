"use client";

import { useEffect, useRef, useState } from "react";
import type { editor as MonacoEditor } from "monaco-editor";

type CodeEditorProps = {
	value: string;
	onChange: (value: string) => void;
	label: string;
	readOnly?: boolean;
};

export function CodeEditor({ value, onChange, label, readOnly = false }: CodeEditorProps) {
	const container = useRef<HTMLDivElement>(null);
	const editor = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
	const current = useRef(value);
	const changed = useRef(onChange);
	const locked = useRef(readOnly);
	const [error, setError] = useState("");
	const [ready, setReady] = useState(false);

	useEffect(() => {
		changed.current = onChange;
	}, [onChange]);

	useEffect(() => {
		current.current = value;
		if (editor.current && editor.current.getValue() !== value) editor.current.setValue(value);
	}, [value]);

	useEffect(() => {
		locked.current = readOnly;
		editor.current?.updateOptions({ readOnly });
	}, [readOnly]);

	useEffect(() => {
		let disposed = false;
		let subscription: { dispose(): void } | undefined;
		let observer: MutationObserver | undefined;

		const theme = () => (document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark" ? "vs-dark" : "vs");

		async function mount() {
			try {
				const monaco = await import("monaco-editor/editor/editor.api.js");
				await import("monaco-editor/languages/definitions/typescript/register.js");
				if (disposed || !container.current) return;
				(globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment = { getWorker: () => new Worker(new URL("monaco-editor/editor/editor.worker.js", import.meta.url), { type: "module" }) };
				const instance = monaco.editor.create(container.current, {
					value: current.current,
					language: "typescript",
					theme: theme(),
					ariaLabel: label,
					readOnly: locked.current,
					automaticLayout: true,
					minimap: { enabled: false },
					fontSize: 14,
					tabSize: 2,
					scrollBeyondLastLine: false,
					wordWrap: "on",
				});
				editor.current = instance;
				subscription = instance.onDidChangeModelContent(() => changed.current(instance.getValue()));
				observer = new MutationObserver(() => monaco.editor.setTheme(theme()));
				observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
				setReady(true);
			} catch {
				if (!disposed) setError("Could not load the code editor. Reload this page to retry.");
			}
		}

		void mount();

		return () => {
			disposed = true;
			subscription?.dispose();
			observer?.disconnect();
			const model = editor.current?.getModel();
			editor.current?.dispose();
			model?.dispose();
			editor.current = null;
		};
	}, [label]);

	return (
		<div>
			{error && (
				<p role='alert' className='text-danger'>
					{error}
				</p>
			)}
			{!ready && !error && (
				<p role='status' className='text-muted mb-2 text-sm'>
					Loading code editor…
				</p>
			)}
			<div ref={container} className='border-border h-96 overflow-hidden rounded-lg border' />
		</div>
	);
}
