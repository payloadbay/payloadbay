"use client";

import { useMemo, useState } from "react";
import { Autocomplete, ListBox, ListBoxItem, Select, Button, Popover, useFilter } from "react-aria-components";
import { Virtualizer, GridLayout, Size } from "react-aria-components/Virtualizer";
import { Label, ToggleButtonGroup, ToggleButton, SearchField, Popover as TonePopover } from "@heroui/react";
import data from "@emoji-mart/data";
import "./catalog.css";

export interface EmojiOption {
	id: string;
	name: string;
	keywords?: string[];
	skins: Array<{ native: string }>;
}

export interface EmojiPickerProps {
	value: string;
	onChange: (value: string) => void;
	label?: string;
	items?: EmojiOption[];
}

const dataset = data as unknown as { emojis: Record<string, EmojiOption>; categories: Array<{ id: string; emojis: string[] }> };
const emojiData = Object.values(dataset.emojis);
const categoryLabels: Record<string, string> = {
	people: "Smileys & people",
	nature: "Animals & nature",
	foods: "Food & drink",
	activity: "Activities",
	places: "Travel & places",
	objects: "Objects",
	symbols: "Symbols",
	flags: "Flags",
};
const categoryGlyphs: Record<string, string> = {
	people: "😀",
	nature: "🌿",
	foods: "🍎",
	activity: "⚽",
	places: "🚗",
	objects: "💡",
	symbols: "💟",
	flags: "🏁",
};
const skinNames = ["Default", "Light", "Medium light", "Medium", "Medium dark", "Dark"];

export function EmojiPicker({ value, onChange, label = "Choose emoji", items = emojiData }: EmojiPickerProps) {
	const [open, setOpen] = useState(false);
	const [tone, setTone] = useState(0);
	const [toneOpen, setToneOpen] = useState(false);
	const [category, setCategory] = useState("all");
	const [query, setQuery] = useState("");

	const categories = useMemo(() => {
		const available = new Set(items.map((item) => item.id));

		return dataset.categories.filter((entry) => entry.emojis.some((id) => available.has(id)));
	}, [items]);

	const activeCategory = categories.find((entry) => entry.id === category);

	const visibleItems = useMemo(() => {
		if (query.trim() || !activeCategory) return items;

		const ids = new Set(activeCategory.emojis);

		return items.filter((item) => ids.has(item.id));
	}, [items, activeCategory, query]);

	const { contains } = useFilter({ sensitivity: "base" });

	const selected = useMemo(() => items.find((item) => item.skins.some((skin) => skin.native === value))?.id ?? null, [items, value]);

	return (
		<Select
			aria-label={label}
			selectedKey={selected}
			isOpen={open}
			onOpenChange={setOpen}
			onSelectionChange={(key) => {
				const item = items.find((entry) => entry.id === key);
				if (item) onChange((item.skins[tone] ?? item.skins[0]).native);
			}}
		>
			<Button className='pb-emoji-trigger' aria-label={label}>
				<span className='pb-emoji-glyph'>{value || "😀"}</span>
			</Button>
			<Popover className='pb-emoji-popover' placement='bottom' offset={4}>
				<Autocomplete filter={contains} inputValue={query} onInputChange={setQuery}>
					<div className='pb-emoji-content'>
						<SearchField aria-label='Search emoji' variant='secondary'>
							<SearchField.Group className='pr-2'>
								<SearchField.Input className='min-w-0' placeholder='Search emoji…' />
								<TonePopover isOpen={toneOpen} onOpenChange={setToneOpen}>
									<Button slot={null} className='pb-emoji-tone' aria-label='Select skin tone'>
										<span className='pb-emoji-glyph'>{["✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿"][tone]}</span>
									</Button>
									<TonePopover.Content placement='bottom end'>
										<TonePopover.Dialog aria-label='Skin tone' className='pb-emoji-tone-options'>
											<ToggleButtonGroup
												aria-label='Skin tone'
												selectionMode='single'
												disallowEmptySelection
												selectedKeys={new Set([String(tone)])}
												className='pb-emoji-tones'
												onSelectionChange={(keys) => {
													const next = [...keys][0];
													if (next !== undefined) {
														setTone(Number(next));
														setToneOpen(false);
													}
												}}
											>
												{skinNames.map((name, index) => (
													<ToggleButton variant='ghost' id={String(index)} key={name} aria-label={`${name} skin tone`}>
														<span className='pb-emoji-glyph'>{["✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿"][index]}</span>
													</ToggleButton>
												))}
											</ToggleButtonGroup>
										</TonePopover.Dialog>
									</TonePopover.Content>
								</TonePopover>
							</SearchField.Group>
						</SearchField>
						<ToggleButtonGroup
							aria-label='Emoji category'
							selectionMode='single'
							disallowEmptySelection
							selectedKeys={new Set([query.trim() ? "all" : (activeCategory?.id ?? "all")])}
							className='pb-emoji-categories'
							onSelectionChange={(keys) => {
								const next = [...keys][0];
								if (next !== undefined) {
									setCategory(String(next));
									setQuery("");
								}
							}}
						>
							<ToggleButton id='all' variant='ghost' aria-label='All emoji'>
								▦
							</ToggleButton>
							{categories.map((entry) => (
								<ToggleButton key={entry.id} id={entry.id} variant='ghost' aria-label={categoryLabels[entry.id]}>
									<span className='pb-emoji-glyph'>{categoryGlyphs[entry.id]}</span>
								</ToggleButton>
							))}
						</ToggleButtonGroup>
						<Label className='sr-only'>Emoji</Label>
						<Virtualizer
							layout={GridLayout}
							layoutOptions={{
								minItemSize: new Size(36, 36),
								maxItemSize: new Size(36, 36),
								minSpace: new Size(2, 2),
								preserveAspectRatio: true,
							}}
						>
							<ListBox aria-label='Emoji grid' layout='grid' className='pb-emoji-grid' dependencies={[tone]} items={visibleItems} renderEmptyState={() => <p className='p-4 text-sm text-muted'>No emoji found</p>}>
								{(item) => (
									<ListBoxItem id={item.id} textValue={`${item.name} ${item.keywords?.join(" ") ?? ""}`} aria-label={(item.skins[tone] ?? item.skins[0]).native} className='pb-emoji-option'>
										<span className='pb-emoji-glyph'>{(item.skins[tone] ?? item.skins[0]).native}</span>
									</ListBoxItem>
								)}
							</ListBox>
						</Virtualizer>
					</div>
				</Autocomplete>
			</Popover>
		</Select>
	);
}
