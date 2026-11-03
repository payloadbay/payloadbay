"use client";

import { SelectionIndicator, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import "./catalog.css";

export interface SegmentProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	items: Array<{ id: string; label: string; isDisabled?: boolean }>;
}

export function Segment({ label, value, onChange, items }: SegmentProps) {
	return (
		<ToggleButtonGroup
			aria-label={label}
			selectedKeys={[value]}
			selectionMode='single'
			disallowEmptySelection
			orientation='horizontal'
			className='pb-segment'
			onSelectionChange={(keys) => {
				const next = keys.values().next().value;
				if (next !== undefined) onChange(String(next));
			}}
		>
			{items.map((item) => (
				<ToggleButton key={item.id} id={item.id} isDisabled={item.isDisabled} className='pb-segment-item'>
					<SelectionIndicator className='pb-segment-indicator' />
					<span className='relative'>{item.label}</span>
				</ToggleButton>
			))}
		</ToggleButtonGroup>
	);
}
