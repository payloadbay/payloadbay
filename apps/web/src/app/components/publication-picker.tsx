"use client";

import { useEffect, useState } from "react";
import { Select, ListBox, Label, Chip } from "@heroui/react";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";

export type PublicationVersion = {
	id: string;
	version_number: number;
	active: boolean;
	created_at: string;
};

type PublicationPickerProps = {
	endpointId: string;
	value: string;
	onChange: (id: string) => void;
	originalId?: string;
	allowAll?: boolean;
	label?: string;
	disabled?: boolean;
};

export function PublicationPicker({ endpointId, value, onChange, originalId, allowAll = false, label = "Script version", disabled = false }: PublicationPickerProps) {
	const [versions, setVersions] = useState<PublicationVersion[]>([]);
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Versions unavailable" });

	useEffect(() => {
		let active = true;
		api<PublicationVersion[]>("/endpoints/" + endpointId + "/publications").then(
			(rows) => {
				if (active) {
					setVersions(rows);
					setError("");
				}
			},
			(cause) => {
				if (active) setError(cause instanceof Error ? cause.message : "Could not load versions");
			},
		);

		return () => {
			active = false;
		};
	}, [endpointId]);

	return (
		<Select variant='secondary' aria-label={label} value={value || (allowAll ? "all" : null)} onChange={(key) => onChange(key === "all" ? "" : String(key))} isDisabled={disabled} placeholder='Choose version' fullWidth>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{allowAll && (
						<ListBox.Item id='all' textValue='All versions'>
							All versions
							<ListBox.ItemIndicator />
						</ListBox.Item>
					)}
					{originalId && !versions.some((version) => version.id === originalId) && (
						<ListBox.Item id={originalId} textValue='Original version'>
							Original version<Chip size='sm'>Original</Chip>
							<ListBox.ItemIndicator />
						</ListBox.Item>
					)}
					{versions.map((version, index) => (
						<ListBox.Item key={version.id} id={version.id} textValue={"v" + version.version_number}>
							<span>v{version.version_number}</span>
							{version.active && (
								<Chip size='sm' color='success' variant='soft'>
									Active
								</Chip>
							)}
							{index === 0 && (
								<Chip size='sm' variant='soft'>
									Latest
								</Chip>
							)}
							{version.id === originalId && (
								<Chip size='sm' variant='soft'>
									Original
								</Chip>
							)}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}
