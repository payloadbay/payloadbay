"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import { createPortal } from "react-dom";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { Extension, type Editor, type Extensions, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import StarterKit from "@tiptap/starter-kit";
import { Button, Tooltip } from "@heroui/react";
import { IconBold, IconItalic, IconStrikethrough, IconList, IconListNumbers, IconH2, IconCode, IconArrowBackUp, IconArrowForwardUp } from "@tabler/icons-react";
import "./catalog.css";

export interface EditorSuggestion {
	id: string;
	title: string;
	keywords?: string[];
	command: (editor: Editor, range: Range) => void;
}

export type RichTextEditorProps = {
	value: JSONContent;
	onChange: (value: JSONContent) => void;
	label: string;
	isReadOnly?: boolean;
	placeholder?: string;
	maxLength?: number;
	extensions?: Extensions;
	bubbleMenu?: ReactNode;
	floatingMenu?: ReactNode;
	suggestions?: EditorSuggestion[];
};

export function RichTextEditor({ value, onChange, label, isReadOnly = false, placeholder = "Write something…", maxLength, extensions = [], bubbleMenu, floatingMenu, suggestions = [] }: RichTextEditorProps) {
	const [suggestion, setSuggestion] = useState<SuggestionProps<EditorSuggestion> | null>(null);
	const [selected, setSelected] = useState(0);
	const activeSuggestion = useRef<SuggestionProps<EditorSuggestion> | null>(null);
	const selectedIndex = useRef(0);

	const slash = useMemo(
		() =>
			Extension.create({
				name: "pbSuggestions",
				addProseMirrorPlugins() {
					return [
						Suggestion<EditorSuggestion>({
							editor: this.editor,
							char: "/",
							items: ({ query }) => suggestions.filter((item) => [item.title, ...(item.keywords ?? [])].some((text) => text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))),
							command: ({ editor: current, range, props }) => props.command(current, range),
							render: () => ({
								onStart: (props) => {
									activeSuggestion.current = props;
									selectedIndex.current = 0;
									setSelected(0);
									setSuggestion(props);
								},
								onUpdate: (props) => {
									activeSuggestion.current = props;
									selectedIndex.current = 0;
									setSelected(0);
									setSuggestion(props);
								},
								onExit: () => {
									activeSuggestion.current = null;
									setSuggestion(null);
								},
								onKeyDown: ({ event }) => {
									const current = activeSuggestion.current;
									if (!current) return false;
									if (event.key === "Escape") {
										activeSuggestion.current = null;
										setSuggestion(null);

										return true;
									}

									if (!current.items.length) return false;
									if (event.key === "ArrowDown" || event.key === "ArrowUp") {
										selectedIndex.current = (selectedIndex.current + (event.key === "ArrowDown" ? 1 : -1) + current.items.length) % current.items.length;
										setSelected(selectedIndex.current);

										return true;
									}

									if (event.key === "Enter") {
										current.command(current.items[selectedIndex.current]);

										return true;
									}

									return false;
								},
							}),
						}),
					];
				},
			}),
		[suggestions],
	);

	const editor = useEditor({
		extensions: [StarterKit.configure({ link: { openOnClick: false } }), Placeholder.configure({ placeholder }), CharacterCount.configure({ limit: maxLength }), ...(suggestions.length ? [slash] : []), ...extensions],
		content: value,
		editable: !isReadOnly,
		immediatelyRender: false,
		editorProps: { attributes: { "aria-label": label, role: "textbox", "aria-multiline": "true" } },
		onUpdate: ({ editor: current }) => onChange(current.getJSON()),
	});
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) =>
			current
				? {
						characters: current.storage.characterCount.characters(),
						canUndo: current.can().undo(),
						canRedo: current.can().redo(),
						bold: current.isActive("bold"),
						italic: current.isActive("italic"),
						strike: current.isActive("strike"),
						bullet: current.isActive("bulletList"),
						ordered: current.isActive("orderedList"),
						heading: current.isActive("heading", { level: 2 }),
						code: current.isActive("codeBlock"),
					}
				: null,
	});

	useEffect(() => {
		if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false });
	}, [editor, value]);

	useEffect(() => {
		editor?.setEditable(!isReadOnly);
	}, [editor, isReadOnly]);

	const actions = [
		{
			label: "Bold",
			Icon: IconBold,
			active: state?.bold,
			run: () => editor?.chain().focus().toggleBold().run(),
		},
		{
			label: "Italic",
			Icon: IconItalic,
			active: state?.italic,
			run: () => editor?.chain().focus().toggleItalic().run(),
		},
		{
			label: "Strike through",
			Icon: IconStrikethrough,
			active: state?.strike,
			run: () => editor?.chain().focus().toggleStrike().run(),
		},
		{
			label: "Heading",
			Icon: IconH2,
			active: state?.heading,
			run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
		},
		{
			label: "Bullet list",
			Icon: IconList,
			active: state?.bullet,
			run: () => editor?.chain().focus().toggleBulletList().run(),
		},
		{
			label: "Ordered list",
			Icon: IconListNumbers,
			active: state?.ordered,
			run: () => editor?.chain().focus().toggleOrderedList().run(),
		},
		{
			label: "Code block",
			Icon: IconCode,
			active: state?.code,
			run: () => editor?.chain().focus().toggleCodeBlock().run(),
		},
		{
			label: "Undo",
			Icon: IconArrowBackUp,
			active: false,
			run: () => editor?.chain().focus().undo().run(),
		},
		{
			label: "Redo",
			Icon: IconArrowForwardUp,
			active: false,
			run: () => editor?.chain().focus().redo().run(),
		},
	];

	return (
		<div className='pb-rich-editor'>
			{!isReadOnly && (
				<div role='toolbar' aria-label={`${label} formatting`} className='pb-editor-toolbar'>
					{actions.map(({ label: action, Icon, active, run }) => (
						<Tooltip key={action}>
							<Button size='sm' isIconOnly variant={active ? "secondary" : "ghost"} aria-label={action} aria-pressed={active} isDisabled={!editor || (action === "Undo" && !state?.canUndo) || (action === "Redo" && !state?.canRedo)} onPress={run}>
								<Icon size={18} />
							</Button>
							<Tooltip.Content>{action}</Tooltip.Content>
						</Tooltip>
					))}
				</div>
			)}
			{editor && !isReadOnly && bubbleMenu && (
				<BubbleMenu editor={editor}>
					<div className='pb-editor-toolbar rounded-xl border border-border bg-surface p-1'>{bubbleMenu}</div>
				</BubbleMenu>
			)}
			{editor && !isReadOnly && floatingMenu && (
				<FloatingMenu editor={editor}>
					<div className='pb-editor-toolbar rounded-xl border border-border bg-surface p-1'>{floatingMenu}</div>
				</FloatingMenu>
			)}
			<EditorContent editor={editor} />
			{suggestion &&
				suggestion.items.length > 0 &&
				createPortal(
					<div role='listbox' aria-label='Editor commands' className='pb-editor-suggestions' style={{ left: Math.max(8, Math.min(innerWidth - 248, suggestion.clientRect?.()?.left ?? 0)), top: Math.max(8, Math.min(innerHeight - 200, (suggestion.clientRect?.()?.bottom ?? 0) + 6)) }}>
						{suggestion.items.map((item, index) => (
							<button key={item.id} type='button' role='option' aria-selected={selected === index} onMouseDown={(event) => event.preventDefault()} onClick={() => suggestion.command(item)}>
								{item.title}
							</button>
						))}
					</div>,
					document.body,
				)}
			<div className='pb-editor-footer'>
				{state?.characters ?? 0}
				{maxLength ? ` / ${maxLength}` : ""} characters
			</div>
		</div>
	);
}
