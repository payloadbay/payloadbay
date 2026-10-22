"use client";

import { Button, Checkbox, FieldError, Input, Label, ListBox, NumberField, Select, TextArea, TextField } from "@heroui/react";
import { IconBrackets, IconPlus, IconTrash } from "@tabler/icons-react";
import { conditionNodes, formatCondition, newCondition, newConditionGroup, operatorsFor, requestCondition, type ConditionField, type ConditionOperator, type RequestCondition } from "@contracts/ingress-policy";

type RuleSelectProps = {
	label: string;
	value: string;
	items: readonly { key: string; label: string }[];

	onChange: (value: string) => void;
	disabled?: boolean;
};

export function RuleSelect({ label, value, items, onChange, disabled = false }: RuleSelectProps) {
	return (
		<Select
			variant='secondary'
			className='min-w-0 w-full'
			value={value}
			onChange={(key) => {
				if (key !== null) onChange(String(key));
			}}
			isDisabled={disabled}
		>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{items.map((item) => (
						<ListBox.Item key={item.key} id={item.key} textValue={item.label}>
							{item.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

type RuleNumberProps = {
	label: string;
	value: number;

	onChange: (value: number) => void;
	min?: number;
	max?: number;
};

export function RuleNumber({ label, value, onChange, min = 0, max = 1000000000 }: RuleNumberProps) {
	return (
		<NumberField variant='secondary' value={value} onChange={onChange} minValue={min} maxValue={max}>
			<Label>{label}</Label>
			<NumberField.Group>
				<NumberField.Input />
			</NumberField.Group>
		</NumberField>
	);
}

const fields = [
	{ key: "header", label: "Request header" },
	{ key: "method", label: "HTTP method" },
	{ key: "path", label: "URL path" },
	{ key: "content_type", label: "Content type" },
	{ key: "body_size", label: "Body size (bytes)" },
];
const labels: Record<ConditionOperator, string> = {
	equals: "Equals",
	not_equals: "Does not equal",
	contains: "Contains",
	not_contains: "Does not contain",
	starts_with: "Starts with",
	not_starts_with: "Does not start with",
	ends_with: "Ends with",
	not_ends_with: "Does not end with",
	wildcard: "Matches wildcard",
	not_wildcard: "Does not match wildcard",
	regex: "Matches regex",
	not_regex: "Does not match regex",
	in: "Is one of",
	not_in: "Is not one of",
	present: "Is present",
	missing: "Is missing",
	gt: "Greater than",
	gte: "Greater than or equal",
	lt: "Less than",
	lte: "Less than or equal",
};

export function ConditionBuilder({ value, onChange }: { value: RequestCondition; onChange: (value: RequestCondition) => void }) {
	const count = conditionNodes(value).length;

	return (
		<section className='min-w-0 space-y-3' aria-label='Request conditions'>
			<ConditionNode value={value} onChange={onChange} count={count} depth={0} />
			<details className='rounded-xl border border-separator p-3 text-sm'>
				<summary className='cursor-pointer text-muted'>Expression preview</summary>
				<pre className='mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs' aria-label='Expression preview'>
					<code>{formatCondition(value)}</code>
				</pre>
			</details>
		</section>
	);
}

type ConditionNodeProps = {
	value: RequestCondition;

	onChange: (value: RequestCondition) => void;
	onRemove?: () => void;
	count: number;
	depth: number;
};

function ConditionNode({ value, onChange, onRemove, count, depth }: ConditionNodeProps) {
	if (value.kind === "group")
		return (
			<fieldset aria-label='Condition group' data-condition-group className='min-w-0 space-y-3 rounded-xl border border-separator p-3'>
				<div className='flex min-w-0 items-end gap-2'>
					<div className='min-w-0 flex-1'>
						<RuleSelect
							label='Match conditions'
							value={value.join}
							items={[
								{ key: "all", label: "All (AND)" },
								{ key: "any", label: "Any (OR)" },
							]}
							onChange={(join) => onChange({ ...value, join: join === "any" ? "any" : "all" })}
						/>
					</div>
					<Checkbox variant='secondary' isSelected={value.negate} onChange={(negate) => onChange({ ...value, negate })} aria-label='Negate this group' className='pb-3'>
						<Checkbox.Content>
							<Checkbox.Control>
								<Checkbox.Indicator />
							</Checkbox.Control>
							<Label>NOT</Label>
						</Checkbox.Content>
					</Checkbox>
					{onRemove && (
						<Button size='sm' variant='ghost' isIconOnly aria-label='Remove group' onPress={onRemove}>
							<IconTrash size={16} />
						</Button>
					)}
				</div>
				{value.children.map((child, index) => (
					<div key={child.id} className='min-w-0 space-y-3'>
						{index > 0 && <p className='text-xs font-semibold text-accent'>{value.join === "all" ? "AND" : "OR"}</p>}
						<ConditionNode value={child} count={count} depth={depth + 1} onChange={(next) => onChange({ ...value, children: value.children.map((item) => (item.id === child.id ? next : item)) })} onRemove={() => onChange({ ...value, children: value.children.length === 1 ? [newCondition()] : value.children.filter((item) => item.id !== child.id) })} />
					</div>
				))}
				<div className='flex flex-wrap gap-2'>
					<Button size='sm' variant='secondary' isDisabled={count >= 64 || value.children.length >= 16} onPress={() => onChange({ ...value, children: [...value.children, newCondition()] })}>
						<IconPlus size={16} />
						Add condition
					</Button>
					<Button size='sm' variant='secondary' isDisabled={count >= 63 || depth >= 3 || value.children.length >= 16} onPress={() => onChange({ ...value, children: [...value.children, newConditionGroup()] })}>
						<IconBrackets size={16} />
						Add group
					</Button>
				</div>
			</fieldset>
		);
	const exists = value.operator === "present" || value.operator === "missing";
	const set = value.operator === "in" || value.operator === "not_in";
	const invalid = requestCondition.safeParse(value);
	const headerError = !invalid.success ? invalid.error.issues.find((issue) => issue.path[0] === "header")?.message : undefined;
	const valueError = !invalid.success ? invalid.error.issues.find((issue) => issue.path[0] === "value")?.message : undefined;

	return (
		<fieldset aria-label='Condition' data-condition-id={value.id} className='min-w-0 space-y-3 rounded-xl bg-surface-secondary/50 p-3'>
			<div className='flex min-w-0 items-end gap-2'>
				<div className='min-w-0 flex-1'>
					<RuleSelect label='Request field' value={value.field} items={fields} onChange={(field) => onChange({ ...newCondition(field as ConditionField), id: value.id })} />
				</div>
				{onRemove && (
					<Button size='sm' variant='ghost' isIconOnly aria-label='Remove condition' onPress={onRemove}>
						<IconTrash size={16} />
					</Button>
				)}
			</div>
			{value.field === "header" && (
				<TextField isInvalid={Boolean(headerError && value.header)} value={value.header ?? ""} onChange={(header) => onChange({ ...value, header })}>
					<Label>Header name</Label>
					<Input variant='secondary' placeholder='x-event-type' autoComplete='off' />
					<FieldError>{headerError}</FieldError>
				</TextField>
			)}
			<RuleSelect
				label='Operator'
				value={value.operator}
				items={operatorsFor(value.field).map((key) => ({ key, label: labels[key] }))}
				onChange={(operator) => onChange({ ...value, operator: operator as ConditionOperator, value: operator === "present" || operator === "missing" ? undefined : operator === "in" || operator === "not_in" ? (Array.isArray(value.value) ? value.value : typeof value.value === "string" && value.value ? [value.value] : []) : value.field === "body_size" ? (typeof value.value === "number" ? value.value : 0) : typeof value.value === "string" ? value.value : "" })}
			/>
			{!exists &&
				(value.field === "body_size" ? (
					<RuleNumber label='Comparison size (bytes)' value={typeof value.value === "number" ? value.value : 0} onChange={(number) => onChange({ ...value, value: number })} />
				) : set ? (
					<TextField value={Array.isArray(value.value) ? value.value.join("\n") : ""} onChange={(text) => onChange({ ...value, value: text.split("\n") })}>
						<Label>Values (one per line)</Label>
						<TextArea variant='secondary' rows={3} />
					</TextField>
				) : (
					<TextField value={typeof value.value === "string" ? value.value : ""} onChange={(text) => onChange({ ...value, value: text })} isInvalid={Boolean(valueError && value.value)}>
						<Label>{value.operator.endsWith("regex") ? "Regular expression" : value.operator.endsWith("wildcard") ? "Wildcard pattern" : "Comparison value"}</Label>
						<Input variant='secondary' autoComplete='off' />
						<FieldError>{valueError}</FieldError>
					</TextField>
				))}
			{!exists && value.field !== "body_size" && (
				<Checkbox variant='secondary' isSelected={value.ignoreCase} onChange={(ignoreCase) => onChange({ ...value, ignoreCase })}>
					<Checkbox.Content>
						<Checkbox.Control>
							<Checkbox.Indicator />
						</Checkbox.Control>
						<Label>Ignore case</Label>
					</Checkbox.Content>
				</Checkbox>
			)}
		</fieldset>
	);
}
