"use client";

import { useContext, type ComponentProps, type ReactNode, type SelectHTMLAttributes } from "react";
import { Button as ColorTrigger, ColorPickerStateContext, NumberFieldStateContext, composeRenderProps, useLocale } from "react-aria-components";
import { Checkbox, CheckboxGroup, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, Description, FieldError, Label, ListBox, NumberField, Radio, RadioGroup, Select, Slider, Switch } from "@heroui/react";
import { IconChevronDown, IconSelector } from "@tabler/icons-react";
import NumberFlow from "@number-flow/react";
import "./catalog.css";

export type SelectOption = { id: string; label: string; isDisabled?: boolean };

export type InlineSelectProps = Omit<ComponentProps<typeof Select>, "children"> & { label: string; options: SelectOption[] };

export function InlineSelect({ label, options, ...props }: InlineSelectProps) {
	return (
		<Select variant='primary' {...props} aria-label={label} className={composeRenderProps(props.className, (className) => `pb-inline-root ${className ?? ""}`)}>
			<Select.Trigger className='pb-inline-select'>
				<Select.Value />
				<Select.Indicator>
					<IconSelector size={12} />
				</Select.Indicator>
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item id={option.id} key={option.id} textValue={option.label} isDisabled={option.isDisabled}>
							{option.label}
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

export function CellSelect({ label, options, ...props }: InlineSelectProps) {
	return (
		<Select {...props} variant='secondary' aria-label={label} className={composeRenderProps(props.className, (className) => `pb-cell ${className ?? ""}`)}>
			<Select.Trigger className='pb-inline-select'>
				<span className='text-sm font-medium'>{label}</span>
				<Select.Value className='ml-auto text-sm text-muted' />
				<Select.Indicator>
					<IconSelector size={12} />
				</Select.Indicator>
			</Select.Trigger>
			<Select.Popover placement='bottom end'>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item id={option.id} key={option.id} textValue={option.label} isDisabled={option.isDisabled}>
							{option.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

export function NativeSelect({ label, children, fullWidth = false, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; fullWidth?: boolean }) {
	return (
		<label className='pb-native-select' style={fullWidth ? { width: "100%" } : undefined}>
			<span className='sr-only'>{label}</span>
			<select {...props} style={fullWidth ? { ...props.style, width: "100%" } : props.style} className={className}>
				{children}
			</select>
			<IconChevronDown size={16} aria-hidden='true' />
		</label>
	);
}

export function CellSlider({ label, ...props }: Omit<ComponentProps<typeof Slider>, "children"> & { label: string }) {
	return (
		<Slider {...props} aria-label={label} orientation='horizontal' className={composeRenderProps(props.className, (className) => `pb-cell-slider ${className ?? ""}`)}>
			<Slider.Track>
				<Slider.Fill />
				<Slider.Thumb />
				<span className='pb-cell-slider-label'>{label}</span>
				<Slider.Output />
			</Slider.Track>
		</Slider>
	);
}

export function CellSwitch({ label, ...props }: Omit<ComponentProps<typeof Switch>, "children"> & { label: string }) {
	return (
		<Switch {...props} className={composeRenderProps(props.className, (className) => `pb-cell-switch ${className ?? ""}`)}>
			<Switch.Content className='w-full justify-between'>
				<Label>{label}</Label>
				<Switch.Control>
					<Switch.Thumb />
				</Switch.Control>
			</Switch.Content>
		</Switch>
	);
}

function ColorValue() {
	const state = useContext(ColorPickerStateContext);

	return <span className='pb-color-value text-xs text-muted'>{state?.color.toString("hex").toUpperCase()}</span>;
}

function HexField() {
	const state = useContext(ColorPickerStateContext);

	return (
		<ColorField
			aria-label='Hex color'
			value={state?.color}
			onChange={(color) => {
				if (color) state?.setColor(color);
			}}
		>
			<Label>Hex color</Label>
			<ColorField.Group variant='secondary'>
				<ColorField.Input />
			</ColorField.Group>
		</ColorField>
	);
}

export function CellColorPicker({ label, isDisabled, ...props }: Omit<ComponentProps<typeof ColorPicker>, "children"> & { label: string; isDisabled?: boolean }) {
	return (
		<ColorPicker {...props} className={`pb-color-picker ${props.className ?? ""}`}>
			<ColorTrigger className='pb-color-trigger' aria-label={label} isDisabled={isDisabled}>
				<span className='pb-color-label'>{label}</span>
				<ColorValue />
				<ColorSwatch />
			</ColorTrigger>
			<ColorPicker.Popover placement='bottom end' className='pb-color-popover'>
				<ColorArea aria-label='Color saturation and brightness' colorSpace='hsb' xChannel='saturation' yChannel='brightness'>
					<ColorArea.Thumb />
				</ColorArea>
				<ColorSlider aria-label='Hue' channel='hue' colorSpace='hsb'>
					<ColorSlider.Track>
						<ColorSlider.Thumb />
					</ColorSlider.Track>
				</ColorSlider>
				<HexField />
			</ColorPicker.Popover>
		</ColorPicker>
	);
}

function StepperValue({ formatOptions }: { formatOptions?: Intl.NumberFormatOptions }) {
	const state = useContext(NumberFieldStateContext);

	const { locale } = useLocale();

	const { notation, ...format } = formatOptions ?? {};

	return (
		<span className='pb-stepper-value' aria-hidden='true'>
			{notation && notation !== "standard" && notation !== "compact" ? state?.inputValue : <NumberFlow value={Number.isFinite(state?.numberValue) ? state!.numberValue : 0} locales={locale} format={{ ...format, notation }} />}
		</span>
	);
}

export function NumberStepper({ label, ...props }: Omit<ComponentProps<typeof NumberField>, "children"> & { label: string }) {
	return (
		<NumberField variant='secondary' {...props} aria-label={label}>
			<NumberField.Group className='pb-number-stepper'>
				<NumberField.DecrementButton aria-label={`Decrease ${label}`} />
				<StepperValue formatOptions={props.formatOptions} />
				<NumberField.Input className='pb-stepper-input' tabIndex={-1} />
				<NumberField.IncrementButton aria-label={`Increase ${label}`} />
			</NumberField.Group>
			<FieldError />
		</NumberField>
	);
}

export type Choice = {
	value: string;
	label: string;
	description?: string;
	icon?: ReactNode;
	isDisabled?: boolean;
};

export function CheckboxButtonGroup({ label, options, ...props }: Omit<ComponentProps<typeof CheckboxGroup>, "children"> & { label: string; options: Choice[] }) {
	return (
		<CheckboxGroup variant='secondary' {...props}>
			<Label>{label}</Label>
			<div className='pb-choice-group'>
				{options.map((item) => (
					<Checkbox variant='secondary' value={item.value} key={item.value} isDisabled={item.isDisabled} className='pb-choice-root'>
						<Checkbox.Content className='pb-choice'>
							<Checkbox.Control className='pb-choice-control'>
								<Checkbox.Indicator />
							</Checkbox.Control>
							{item.icon}
							<span className='pb-choice-label'>{item.label}</span>
							{item.description && <Description>{item.description}</Description>}
						</Checkbox.Content>
					</Checkbox>
				))}
			</div>
			<FieldError />
		</CheckboxGroup>
	);
}

export function RadioButtonGroup({ label, options, ...props }: Omit<ComponentProps<typeof RadioGroup>, "children"> & { label: string; options: Choice[] }) {
	return (
		<RadioGroup variant='secondary' {...props}>
			<Label>{label}</Label>
			<div className='pb-choice-group'>
				{options.map((item) => (
					<Radio value={item.value} key={item.value} isDisabled={item.isDisabled} className='pb-choice-root'>
						<Radio.Content className='pb-choice'>
							<Radio.Control className='pb-choice-control'>
								<Radio.Indicator />
							</Radio.Control>
							{item.icon}
							<span className='pb-choice-label'>{item.label}</span>
							{item.description && <Description>{item.description}</Description>}
						</Radio.Content>
					</Radio>
				))}
			</div>
			<FieldError />
		</RadioGroup>
	);
}
