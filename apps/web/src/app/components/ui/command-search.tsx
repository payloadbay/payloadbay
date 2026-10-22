"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, Modal, SearchField } from "@heroui/react";
import { IconSearch } from "@tabler/icons-react";
import { Autocomplete, Menu, MenuItem, useFilter } from "react-aria-components";
import { useReducedMotion } from "motion/react";
import "./primitives.css";

export type CommandItem = { id: string; label: string; icon?: ReactNode };

export type CommandSearchProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: CommandItem[];
	onAction: (id: string) => void;
	hideLauncher?: boolean;
	reduceMotion?: boolean;
};

export function CommandSearch({ open, onOpenChange, items, onAction, hideLauncher = false, reduceMotion }: CommandSearchProps) {
	const setOpen = onOpenChange;

	const [query, setQuery] = useState("");

	const systemReduced = useReducedMotion();

	const reduced = reduceMotion ?? Boolean(systemReduced);

	const { contains } = useFilter({ sensitivity: "base" });

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === "k") {
				event.preventDefault();
				setOpen(!open);
				setQuery("");
			}
		};

		window.addEventListener("keydown", handler);

		return () => window.removeEventListener("keydown", handler);
	}, [setOpen, open]);

	return (
		<>
			{!hideLauncher && (
				<Button variant='secondary' className='w-full justify-start' onPress={() => setOpen(true)}>
					<IconSearch size={18} />
					Search pages and resources<span className='ml-auto text-xs text-muted'>⌘ / Ctrl K</span>
				</Button>
			)}
			<Modal.Backdrop
				className='pb-command-backdrop'
				data-motion={reduced ? "reduced" : "enabled"}
				isOpen={open}
				onOpenChange={(value) => {
					setOpen(value);
					if (!value) setQuery("");
				}}
			>
				<Modal.Container placement='top' size='lg' className='pb-command-container'>
					<Modal.Dialog className='pb-command' aria-label='Search pages and resources'>
						<Modal.Heading className='sr-only'>Search pages and resources</Modal.Heading>
						<p className='pb-command-caption'>Pages and resources</p>
						<Autocomplete inputValue={query} onInputChange={setQuery} filter={contains}>
							<SearchField aria-label='Search pages and resources' variant='secondary' autoFocus className='pb-command-search'>
								<SearchField.Group>
									<SearchField.Input
										placeholder='Search pages and resources…'
										onKeyDownCapture={(event) => {
											if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) event.stopPropagation();
										}}
									/>
									<SearchField.ClearButton aria-label='Clear search' />
								</SearchField.Group>
							</SearchField>
							<div className='pb-command-results'>
								<p className='pb-command-group'>Jump to</p>
								<Menu
									aria-label='Search results'
									onAction={(key) => {
										onAction(String(key));
										setOpen(false);
										setQuery("");
									}}
									renderEmptyState={() => <p className='p-3 text-sm text-muted'>No matching pages or resources.</p>}
								>
									{items.map((item) => (
										<MenuItem key={item.id} id={item.id} textValue={item.label} className='pb-command-item'>
											{item.icon}
											<span>{item.label}</span>
											<span className='ml-auto text-xs text-muted'>Jump to</span>
										</MenuItem>
									))}
								</Menu>
							</div>
						</Autocomplete>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</>
	);
}
