"use client";

import { LoadingState } from "@components/loading-state";
import { useState } from "react";
import { Button, Modal, Select, ListBox, Label, Chip } from "@heroui/react";
import { IconFileImport } from "@tabler/icons-react";
import { api } from "@lib/api-client";
import { formatScript } from "@lib/script-document";
import { useFeedbackToast } from "@lib/feedback";

type Helper = {
	id: string;
	name: string;
	scope: { type: string };
	exports?: string[];
};

type HelperImportPickerProps = {
	scope: { type: "instance" | "organization" | "workspace" | "project"; id: string };
	body: string;
	disabled?: boolean;
	onImport: (body: string, name: string, revisionId: string) => void;
};

export function HelperImportPicker({ scope, body, disabled, onImport }: HelperImportPickerProps) {
	const [open, setOpen] = useState(false);
	const [helpers, setHelpers] = useState<Helper[]>([]);
	const [selected, setSelected] = useState<Helper | null>(null);
	const [exports, setExports] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Helper import failed" });

	async function show() {
		setError("");
		setSelected(null);
		setExports([]);
		setOpen(true);
		setBusy(true);
		try {
			setHelpers(await api("/shared-code?scopeType=" + scope.type + "&scopeId=" + scope.id));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load helpers");
		} finally {
			setBusy(false);
		}
	}

	async function choose(id: string) {
		setBusy(true);
		try {
			const helper = await api<Helper>("/shared-code/" + id);
			setSelected(helper);
			setExports(helper.exports ?? []);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not load helper");
		} finally {
			setBusy(false);
		}
	}

	async function insert() {
		if (!selected) return;
		setBusy(true);
		setError("");
		try {
			const result = await api<{ body: string; name: string; revisionId: string }>("/shared-code/" + selected.id + "/import", { method: "POST", json: { scope, body, exports } });
			onImport(await formatScript(result.body), result.name, result.revisionId);
			setOpen(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not insert import");
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<Button variant='secondary' size='sm' isDisabled={disabled} onPress={() => void show()}>
				<IconFileImport size={16} />
				Import helper
			</Button>
			<Modal
				isOpen={open}
				onOpenChange={(value) => {
					if (!busy) setOpen(value);
				}}
			>
				<Modal.Backdrop>
					<Modal.Container size='lg'>
						<Modal.Dialog aria-label='Import helper'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Import helper</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='flex flex-col gap-4'>
								<p className='text-muted text-sm'>Choose a saved helper and its exports. The import is inserted above the script; saving pins this revision.</p>
								<Select
									aria-label='Helper revision'
									value={selected?.id ?? null}
									onChange={(value) => {
										if (value) void choose(String(value));
									}}
									isDisabled={busy}
									placeholder='Choose helper'
								>
									<Label>Helper</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{helpers.map((helper) => (
												<ListBox.Item id={helper.id} key={helper.id} textValue={helper.name + " " + helper.id.slice(0, 8)}>
													<span>{helper.name}</span>
													<Chip size='sm'>{helper.scope.type}</Chip>
													<span className='text-muted text-xs'>{helper.id.slice(0, 8)}</span>
													<ListBox.ItemIndicator />
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>
								{selected && (
									<Select aria-label='Helper exports' selectionMode='multiple' value={exports} onChange={(keys) => setExports(keys.map(String))} placeholder='Select exports'>
										<Label>Exports</Label>
										<Select.Trigger>
											<Select.Value />
											<Select.Indicator />
										</Select.Trigger>
										<Select.Popover>
											<ListBox selectionMode='multiple'>
												{(selected.exports ?? []).map((name) => (
													<ListBox.Item key={name} id={name} textValue={name}>
														{name}
														<ListBox.ItemIndicator />
													</ListBox.Item>
												))}
											</ListBox>
										</Select.Popover>
									</Select>
								)}
								{busy && <LoadingState label='Loading…' />}
								{!busy && !helpers.length && <p className='text-muted'>No helpers are available in this scope. Create one in Code and middleware first.</p>}
							</Modal.Body>
							<Modal.Footer>
								<Button variant='tertiary' slot='close' isDisabled={busy}>
									Cancel
								</Button>
								<Button isDisabled={busy || !selected || !exports.length} onPress={() => void insert()}>
									Insert import
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</>
	);
}
