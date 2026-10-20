"use client";

import { useDragAndDrop, Collection, Tree, TreeItem, TreeItemContent, type Selection, type Key } from "react-aria-components";
import { Button, Checkbox } from "@heroui/react";
import { IconChevronRight, IconGripVertical } from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useReducedMotion } from "motion/react";
import "./catalog.css";

export type FileTreeNode = {
	id: string;
	name: string;
	icon?: ReactNode;
	children?: FileTreeNode[];
};

function Node({ item }: { item: FileTreeNode }) {
	return (
		<TreeItem id={item.id} textValue={item.name} className='pb-tree-item' data-file-key={item.id}>
			<TreeItemContent>
				{({ isExpanded, hasChildItems, level, allowsDragging, selectionMode }) => (
					<div className='pb-tree-row'>
						{allowsDragging && (
							<Button slot='drag' isIconOnly size='sm' variant='ghost' aria-label={`Move ${item.name}`}>
								<IconGripVertical size={14} />
							</Button>
						)}
						{selectionMode === "multiple" && (
							<Checkbox slot='selection' variant='secondary' aria-label={`Select ${item.name}`}>
								<Checkbox.Content>
									<Checkbox.Control>
										<Checkbox.Indicator />
									</Checkbox.Control>
								</Checkbox.Content>
							</Checkbox>
						)}
						{Array.from({ length: Math.max(0, level - 1) }, (_, index) => (
							<span key={index} aria-hidden='true' className='pb-tree-guide' style={{ insetInlineStart: 14 + index * 12 }} />
						))}
						{hasChildItems ? (
							<Button slot='chevron' size='sm' isIconOnly variant='ghost' aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.name}`} className='pb-tree-chevron'>
								<IconChevronRight size={14} className={isExpanded ? "rotate-90" : ""} />
							</Button>
						) : (
							<span className='pb-tree-spacer' />
						)}
						{item.icon}
						<span className='truncate'>{item.name}</span>
					</div>
				)}
			</TreeItemContent>
			{item.children && <Collection items={item.children}>{(child) => <Node item={child} />}</Collection>}
		</TreeItem>
	);
}

export interface FileTreeProps {
	items: FileTreeNode[];
	label: string;
	defaultExpandedKeys?: string[];
	selectedKeys?: Selection;
	onSelectionChange?: (keys: Selection) => void;
	onAction?: (id: string) => void;
	selectionMode?: "none" | "single" | "multiple";
	showGuideLines?: boolean | "hover";
	onReorder?: (keys: string[], target: string, position: "before" | "after" | "on") => void;
}

export function FileTree({ items, label, defaultExpandedKeys, selectedKeys, onSelectionChange, onAction, selectionMode = "single", showGuideLines = true, onReorder }: FileTreeProps) {
	const { dragAndDropHooks } = useDragAndDrop({ getItems: onReorder ? (keys) => [...keys].map((key) => ({ "text/plain": String(key) })) : undefined, onReorder: onReorder ? (event) => onReorder([...event.keys].map(String), String(event.target.key), event.target.dropPosition) : undefined });

	const tree = useRef<HTMLDivElement>(null);
	const animations = useRef<Animation[]>([]);

	useEffect(() => () => animations.current.forEach((animation) => animation.cancel()), []);

	const [expanded, setExpanded] = useState<Set<Key>>(() => new Set(defaultExpandedKeys));

	const reduced = useReducedMotion();

	function changeExpanded(keys: Set<Key>) {
		const element = tree.current;
		animations.current.forEach((animation) => animation.finish());
		if (!element || reduced) {
			setExpanded(keys);

			return;
		}

		const before = element.getBoundingClientRect();
		const snapshot = element.cloneNode(true) as HTMLElement;
		const previous = new Set([...element.querySelectorAll<HTMLElement>("[data-file-key]")].map((row) => row.dataset.fileKey));
		flushSync(() => setExpanded(keys));
		const after = element.getBoundingClientRect();
		const growing = after.height > before.height;
		const animation = element.animate(
			[
				{ height: `${before.height}px`, overflow: "hidden" },
				{ height: `${after.height}px`, overflow: "hidden" },
			],
			{ duration: growing ? 240 : 180, easing: growing ? "cubic-bezier(.16,1,.3,1)" : "cubic-bezier(.4,0,1,1)" },
		);
		animations.current = [animation];
		if (growing) {
			for (const row of element.querySelectorAll<HTMLElement>("[data-file-key]")) {
				if (!previous.has(row.dataset.fileKey)) animations.current.push(row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "cubic-bezier(.16,1,.3,1)" }));
			}
		} else {
			snapshot.setAttribute("aria-hidden", "true");
			snapshot.inert = true;
			snapshot.style.cssText = "position:absolute;inset:0;pointer-events:none;background:var(--surface);";
			element.parentElement?.append(snapshot);
			const fade = snapshot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: "forwards" });
			animations.current.push(fade);
			animation.finished.catch(() => {}).finally(() => snapshot.remove());
		}
	}

	return (
		<div className='relative' data-guide-lines={String(showGuideLines)}>
			<Tree dragAndDropHooks={onReorder ? dragAndDropHooks : undefined} ref={tree} aria-label={label} className='pb-file-tree' selectionMode={selectionMode} expandedKeys={expanded} onExpandedChange={changeExpanded} selectedKeys={selectedKeys} onSelectionChange={onSelectionChange} onAction={onAction ? (key) => onAction(String(key)) : undefined} renderEmptyState={() => <p className='p-4 text-sm text-muted'>No files</p>}>
				<Collection items={items}>{(item) => <Node item={item} />}</Collection>
			</Tree>
		</div>
	);
}
