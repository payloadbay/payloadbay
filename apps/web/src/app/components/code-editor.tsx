"use client";

import { LoadingState } from "@components/loading-state";
import { useEffect, useRef, useState } from "react";
import { scriptFrame, formatScript, type ScriptStage } from "@lib/script-document";
import { api } from "@lib/api-client";
import { sdkDeclarations } from "@sdk/declarations.generated";
import type { editor as MonacoEditor } from "monaco-editor";

type CodeEditorProps = {
	value: string;
	onChange: (value: string) => void;
	label: string;
	readOnly?: boolean;
	stage?: ScriptStage;
	bindings?: Record<string, string>;
	onSave?: () => void;
	helperScope?: { type: "instance" | "workspace" | "project"; id: string };
};

export function CodeEditor({ value, onChange, label, readOnly = false, stage, bindings, onSave, helperScope }: CodeEditorProps) {
	const helperType = helperScope?.type;
	const helperId = helperScope?.id;

	const container = useRef<HTMLDivElement>(null);
	const editor = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

	const frame = scriptFrame(/^\s*(?:import|export)\s/m.test(value) ? undefined : stage, bindings);
	const prefix = frame.prefix;
	const suffix = frame.suffix;

	const current = useRef(prefix + value + suffix);
	const save = useRef(onSave);
	const changed = useRef(onChange);
	const locked = useRef(readOnly);
	const [error, setError] = useState("");
	const [ready, setReady] = useState(false);

	useEffect(() => {
		changed.current = onChange;
		save.current = onSave;
	}, [onChange, onSave]);

	useEffect(() => {
		current.current = prefix + value + suffix;
		if (editor.current && editor.current.getValue() !== current.current) editor.current.setValue(current.current);
	}, [value, prefix, suffix]);

	useEffect(() => {
		locked.current = readOnly;
		editor.current?.updateOptions({ readOnly });
	}, [readOnly]);

	useEffect(() => {
		let disposed = false;
		let subscription: { dispose(): void } | undefined;
		let observer: MutationObserver | undefined;
		const cleanups: { dispose(): void }[] = [];

		const theme = () => (document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark" ? "vs-dark" : "vs");

		async function mount() {
			try {
				const monaco = await import("monaco-editor");
				const typescript = await import("monaco-editor/languages/features/typescript/register.js");
				if (disposed || !container.current) return;
				(globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment = { getWorker: (_: string, language: string) => (language === "typescript" || language === "javascript" ? new Worker(new URL("monaco-editor/languages/features/typescript/ts.worker.js", import.meta.url), { type: "module" }) : new Worker(new URL("monaco-editor/editor/editor.worker.js", import.meta.url), { type: "module" })) };
				typescript.typescriptDefaults.setCompilerOptions({
					target: typescript.ScriptTarget.ESNext,
					module: typescript.ModuleKind.ESNext,
					moduleResolution: typescript.ModuleResolutionKind.NodeJs,
					strict: true,
					lib: ["lib.es2022.d.ts", "lib.webworker.d.ts"],
				});
				typescript.typescriptDefaults.setModeConfiguration({ ...typescript.typescriptDefaults.modeConfiguration, documentRangeFormattingEdits: false, onTypeFormattingEdits: false });
				typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
				const contextTypes = ["IngressContext", "ProcessingContext", "IngressDecision", "ProcessingDecision", "IngressMiddlewareContext", "ProcessingMiddlewareContext", "IngressMiddlewareDecision", "ProcessingMiddlewareDecision"];
				const declarations = `declare namespace PayloadBay {\n${sdkDeclarations}\n}\n` + contextTypes.map((name) => `type ${name} = PayloadBay.${name};`).join("\n");
				const sdk = typescript.typescriptDefaults.addExtraLib(declarations, "file:///payloadbay-sdk.d.ts");
				const available: { id: string; name: string; scope: { type: string } }[] = helperType && helperId ? await api("/shared-code?scopeType=" + helperType + "&scopeId=" + helperId) : [];
				const ranks: Record<string, number> = { instance: 0, workspace: 1, project: 2 };
				const modules = new Map<string, string>();
				for (const helper of [...available].sort((a, b) => ranks[b.scope.type] - ranks[a.scope.type])) if (!modules.has(helper.name)) modules.set(helper.name, helper.id);
				for (const [name, id] of Object.entries(bindings ?? {})) modules.set(name, id);
				await Promise.all(
					[...modules.entries()].map(async ([name, id]) => {
						const helper = await api<{ source: string }>("/shared-code/" + encodeURIComponent(id));
						if (disposed) return;
						cleanups.push(typescript.typescriptDefaults.addExtraLib(helper.source, "file:///node_modules/@shared/" + name + "/index.ts"));
					}),
				);
				cleanups.push(sdk);
				cleanups.push(
					monaco.languages.registerCompletionItemProvider("typescript", {
						triggerCharacters: ["/", '"', "'"],
						provideCompletionItems: (model, position) => {
							if (model.uri.toString() !== editor.current?.getModel()?.uri.toString()) return { suggestions: [] };
							const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
							const match = /(?:from\s*|import\s*)["']([^"']*)$/.exec(line);
							if (!match) return { suggestions: [] };

							return {
								suggestions: [...modules.keys()].map((name) => ({
									label: "@shared/" + name,
									insertText: "@shared/" + name,
									kind: monaco.languages.CompletionItemKind.Module,
									detail: "Saved helper module",
									range: new monaco.Range(position.lineNumber, position.column - match[1].length, position.lineNumber, position.column),
								})),
							};
						},
					}),
				);
				const instance = monaco.editor.create(container.current, {
					model: monaco.editor.createModel(current.current, "typescript", monaco.Uri.parse("file:///scripts/" + crypto.randomUUID() + ".ts")),
					theme: theme(),
					ariaLabel: label,
					readOnly: locked.current,
					automaticLayout: true,
					minimap: { enabled: false },
					fontSize: 14,
					tabSize: 4,
					insertSpaces: false,
					scrollBeyondLastLine: false,
					scrollbar: { alwaysConsumeMouseWheel: false },
					wordWrap: "off",
				});
				editor.current = instance;
				cleanups.push(
					monaco.languages.registerDocumentFormattingEditProvider(
						{ language: "typescript", pattern: instance.getModel()!.uri.path },
						{
							provideDocumentFormattingEdits: async (model) => {
								if (locked.current) return [];
								const text = model.getValue();
								const body = prefix ? text.slice(prefix.length, -suffix.length) : text;

								return [{ range: model.getFullModelRange(), text: prefix + (await formatScript(body, stage, bindings)) + suffix }];
							},
						},
					),
				);
				let restoring = false;
				let accepted = instance.getValue();
				subscription = instance.onDidChangeModelContent(() => {
					if (restoring) return;
					const next = instance.getValue();
					if (prefix && (!next.startsWith(prefix) || !next.endsWith(suffix))) {
						restoring = true;
						instance.setValue(accepted);
						instance.setPosition({ lineNumber: prefix.split("\n").length, column: 1 });
						restoring = false;

						return;
					}

					accepted = next;
					changed.current(prefix ? next.slice(prefix.length, -suffix.length) : next);
				});
				if (prefix) {
					instance.setPosition({ lineNumber: prefix.split("\n").length, column: 1 });
					instance.createDecorationsCollection([{ range: new monaco.Range(1, 1, prefix.split("\n").length - 1, 1000), options: { isWholeLine: true, className: "bg-default/40" } }]);
				}

				cleanups.push(
					instance.onKeyDown((event) => {
						if (prefix && (event.ctrlKey || event.metaKey) && event.keyCode === monaco.KeyCode.KeyA) {
							event.preventDefault();
							event.stopPropagation();
							const model = instance.getModel()!;
							const start = model.getPositionAt(prefix.length);
							const end = model.getPositionAt(model.getValueLength() - suffix.length);
							instance.setSelection(new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column));
						}
					}),
				);
				cleanups.push(
					instance.addAction({
						id: "payloadbay.save",
						label: "Save draft",
						keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
						run: () => save.current?.(),
					}),
				);
				cleanups.push(
					instance.addAction({
						id: "payloadbay.format",
						label: "Format document",
						keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
						run: async () => {
							if (locked.current) return;
							try {
								const text = instance.getValue();
								const body = prefix ? text.slice(prefix.length, -suffix.length) : text;
								changed.current(await formatScript(body, stage, bindings));
							} catch {
								setError("Fix the TypeScript syntax before formatting.");
							}
						},
					}),
				);
				observer = new MutationObserver(() => monaco.editor.setTheme(theme()));
				observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
				const getWorker = await typescript.getTypeScriptWorker();
				const languageWorker = await getWorker(instance.getModel()!.uri);
				await languageWorker.getQuickInfoAtPosition(instance.getModel()!.uri.toString(), Math.max(0, prefix.indexOf("ctx")));
				if (!disposed) setReady(true);
			} catch {
				if (!disposed) setError("Could not load the code editor. Reload this page to retry.");
			}
		}

		void mount();

		return () => {
			disposed = true;
			subscription?.dispose();
			for (const cleanup of cleanups) cleanup.dispose();
			observer?.disconnect();
			const model = editor.current?.getModel();
			editor.current?.dispose();
			model?.dispose();
			editor.current = null;
		};
	}, [label, prefix, suffix, stage, bindings, helperType, helperId]);

	return (
		<div className='min-w-0 w-full'>
			{error && (
				<p role='alert' className='text-danger'>
					{error}
				</p>
			)}
			{prefix && <p className='text-muted mb-2 text-xs'>The shaded signature stays fixed. Edit the code below; hover ctx to explore the available methods.</p>}
			<div className='relative'>
				{!ready && !error && (
					<div className='bg-background absolute inset-0 z-10 flex items-center justify-center rounded-lg'>
						<LoadingState label='Loading code editor…' />
					</div>
				)}
				<div ref={container} className='border-border h-96 min-w-0 w-full overflow-hidden rounded-lg border' />
			</div>
		</div>
	);
}
