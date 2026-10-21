"use client";

import { use, useEffect, useState } from "react";
import { Button, Card, Switch, Label, NumberField, Table, Chip, Modal, TextField, Input, Select, ListBox } from "@heroui/react";
import { IconPlus, IconPencil, IconTrash, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { LoadingState } from "@components/loading-state";
import { ingressPolicy, ingressRule, browserBlockingRules, type IngressPolicy } from "@contracts/ingress-policy";

type Rule = IngressPolicy["rules"][number];
type Snapshot = { version: number; policy: IngressPolicy };

export default function RequestProtectionPage({ params }: { params: Promise<{ endpointId: string }> }) {
	const { endpointId } = use(params);

	const [saved, setSaved] = useState<Snapshot | null>(null);
	const [policy, setPolicy] = useState<IngressPolicy>(ingressPolicy.parse({}));
	const [rule, setRule] = useState<Rule | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [retry, setRetry] = useState(0);

	const dirty = Boolean(saved && JSON.stringify(policy) !== JSON.stringify(saved.policy));

	const { dialog } = useUnsavedChanges(dirty);

	useFeedbackToast(error, notice);

	useEffect(() => {
		let active = true;
		void api<Snapshot>("/endpoints/" + endpointId + "/protection").then(
			(data) => {
				if (!active) return;
				setSaved(data);
				setPolicy(data.policy);
				setError("");
			},
			(cause) => {
				if (active) setError(cause.message);
			},
		);

		return () => {
			active = false;
		};
	}, [endpointId, retry]);

	function reorder(index: number, direction: number) {
		setPolicy((current) => {
			const rules = [...current.rules];
			[rules[index], rules[index + direction]] = [rules[index + direction], rules[index]];

			return { ...current, rules };
		});
	}

	async function save() {
		if (!saved) return;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const data = await api<Snapshot>("/endpoints/" + endpointId + "/protection", { method: "PUT", json: { expectedVersion: saved.version, policy } });
			setSaved(data);
			setPolicy((current) => (JSON.stringify(current) === JSON.stringify(policy) ? data.policy : current));
			setNotice("Request protection saved.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save request protection");
		} finally {
			setBusy(false);
		}
	}

	if (!saved)
		return error ? (
			<div className='flex min-h-48 flex-col items-center justify-center gap-3'>
				<p>Request protection is unavailable.</p>
				<Button onPress={() => setRetry((value) => value + 1)}>Retry</Button>
			</div>
		) : (
			<LoadingState label='Loading request protection…' size='page' />
		);

	return (
		<section className='flex min-w-0 flex-col gap-6'>
			{dialog}
			<header>
				<h1 className='text-3xl font-semibold'>Request protection</h1>
				<p className='mt-2 text-muted'>Filter incoming requests before your ingress script runs. Blocked requests remain in the event log.</p>
			</header>
			<Card>
				<Card.Header>
					<Card.Title>Rate limit</Card.Title>
				</Card.Header>
				<Card.Content className='flex flex-col gap-4'>
					<Switch isSelected={policy.rateLimit.enabled} onChange={(enabled) => setPolicy((current) => ({ ...current, rateLimit: { ...current.rateLimit, enabled } }))} isDisabled={busy}>
						<Switch.Content>
							<Label>Limit incoming requests</Label>
							<Switch.Control>
								<Switch.Thumb />
							</Switch.Control>
						</Switch.Content>
					</Switch>
					{policy.rateLimit.enabled && (
						<div className='grid gap-4 sm:grid-cols-2'>
							<NumberField variant='secondary' value={policy.rateLimit.requests} minValue={1} maxValue={1000000} onChange={(requests) => setPolicy((current) => ({ ...current, rateLimit: { ...current.rateLimit, requests } }))}>
								<Label>Requests per window</Label>
								<NumberField.Group>
									<NumberField.Input />
								</NumberField.Group>
							</NumberField>
							<NumberField variant='secondary' value={policy.rateLimit.windowSeconds} minValue={1} maxValue={86400} onChange={(windowSeconds) => setPolicy((current) => ({ ...current, rateLimit: { ...current.rateLimit, windowSeconds } }))}>
								<Label>Window in seconds</Label>
								<NumberField.Group>
									<NumberField.Input />
								</NumberField.Group>
							</NumberField>
						</div>
					)}
					<p className='text-sm text-muted'>The limit applies to this route across all senders. Requests over the limit receive HTTP 429.</p>
				</Card.Content>
			</Card>
			<Card>
				<Card.Header>
					<Card.Title>Request filters</Card.Title>
				</Card.Header>
				<Card.Content className='flex flex-col gap-4'>
					<Switch isSelected={policy.enabled} onChange={(enabled) => setPolicy((current) => ({ ...current, enabled }))} isDisabled={busy}>
						<Switch.Content>
							<Label>Enable request filters</Label>
							<Switch.Control>
								<Switch.Thumb />
							</Switch.Control>
						</Switch.Content>
					</Switch>
					{policy.enabled && (
						<>
							<div className='flex flex-wrap gap-3'>
								<Button
									variant='secondary'
									isDisabled={policy.rules.length >= 100}
									onPress={() =>
										setRule({
											id: crypto.randomUUID(),
											name: "",
											enabled: true,
											header: "",
											operator: "equals",
											value: "",
											action: "block",
										})
									}
								>
									<IconPlus size={18} />
									Add rule
								</Button>
								<Button variant='secondary' isDisabled={policy.rules.length > 98} onPress={() => setPolicy((current) => ({ ...current, rules: [...current.rules, ...browserBlockingRules()] }))}>
									Add browser-request template
								</Button>
							</div>
							<p className='text-sm text-muted'>Rules run from top to bottom. The first match blocks the request or skips the remaining filters. Skipping does not bypass the rate limit or script validation. Browser headers can be spoofed.</p>
							<Select variant='secondary' aria-label='When no rule matches' value={policy.defaultAction} onChange={(key) => setPolicy((current) => ({ ...current, defaultAction: key as "allow" | "block" }))}>
								<Label>When no rule matches</Label>
								<Select.Trigger>
									<Select.Value />
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										<ListBox.Item id='allow'>
											Continue to ingress script
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id='block'>
											Block request
											<ListBox.ItemIndicator />
										</ListBox.Item>
									</ListBox>
								</Select.Popover>
							</Select>
							<Table>
								<Table.ScrollContainer>
									<Table.Content aria-label='Request filter rules' className='w-full'>
										<Table.Header>
											<Table.Column isRowHeader>Rule</Table.Column>
											<Table.Column className='hidden sm:table-cell'>Match</Table.Column>
											<Table.Column>Action</Table.Column>
											<Table.Column className='text-right'>Actions</Table.Column>
										</Table.Header>
										<Table.Body renderEmptyState={() => <p className='p-6 text-center text-muted'>No request filters yet.</p>}>
											{policy.rules.map((item, index) => (
												<Table.Row key={item.id} id={item.id}>
													<Table.Cell>
														<strong>{item.name}</strong>
														<div className='mt-1 max-w-40 break-words text-xs text-muted sm:hidden'>
															<code className='break-all'>{item.header}</code> {item.operator}
															{!["present", "missing"].includes(item.operator) && <span className='block break-all'>{item.value}</span>}
														</div>
														{!item.enabled && <Chip size='sm'>Disabled</Chip>}
													</Table.Cell>
													<Table.Cell className='hidden sm:table-cell'>
														<code>{item.header}</code> {item.operator}
														{!["present", "missing"].includes(item.operator) && <span className='block max-w-48 break-words'>{item.value}</span>}
													</Table.Cell>
													<Table.Cell>
														<Chip color={item.action === "block" ? "danger" : "accent"}>{item.action === "block" ? "Block" : "Skip filters"}</Chip>
													</Table.Cell>
													<Table.Cell className='text-right'>
														<div className='ml-auto grid w-fit grid-cols-2 gap-1 sm:flex'>
															<Button isIconOnly size='sm' variant='ghost' aria-label={"Move " + item.name + " up"} isDisabled={index === 0} onPress={() => reorder(index, -1)}>
																<IconArrowUp size={16} />
															</Button>
															<Button isIconOnly size='sm' variant='ghost' aria-label={"Move " + item.name + " down"} isDisabled={index === policy.rules.length - 1} onPress={() => reorder(index, 1)}>
																<IconArrowDown size={16} />
															</Button>
															<Button isIconOnly size='sm' variant='ghost' aria-label={"Edit " + item.name} onPress={() => setRule({ ...item })}>
																<IconPencil size={16} />
															</Button>
															<Button isIconOnly size='sm' variant='danger-soft' aria-label={"Delete " + item.name} onPress={() => setPolicy((current) => ({ ...current, rules: current.rules.filter((candidate) => candidate.id !== item.id) }))}>
																<IconTrash size={16} />
															</Button>
														</div>
													</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table.Content>
								</Table.ScrollContainer>
							</Table>
						</>
					)}
				</Card.Content>
			</Card>
			<div className='flex justify-end'>
				<Button isDisabled={busy || !dirty || !ingressPolicy.safeParse(policy).success} onPress={() => void save()}>
					Save request protection
				</Button>
			</div>
			<Modal
				isOpen={Boolean(rule)}
				onOpenChange={(open) => {
					if (!open) setRule(null);
				}}
			>
				<Modal.Backdrop>
					<Modal.Container size='lg'>
						<Modal.Dialog>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>Request filter rule</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='flex flex-col gap-4'>
								{rule && (
									<>
										<TextField value={rule.name} onChange={(name) => setRule({ ...rule, name })} maxLength={100}>
											<Label>Rule name</Label>
											<Input variant='secondary' />
										</TextField>
										<TextField value={rule.header} onChange={(header) => setRule({ ...rule, header })} maxLength={100}>
											<Label>Header name</Label>
											<Input variant='secondary' placeholder='user-agent' />
										</TextField>
										<Select variant='secondary' aria-label='Match condition' value={rule.operator} onChange={(key) => setRule({ ...rule, operator: key as Rule["operator"] })}>
											<Label>Match condition</Label>
											<Select.Trigger>
												<Select.Value />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													{["equals", "contains", "present", "missing"].map((operator) => (
														<ListBox.Item key={operator} id={operator}>
															{operator}
															<ListBox.ItemIndicator />
														</ListBox.Item>
													))}
												</ListBox>
											</Select.Popover>
										</Select>
										{!["present", "missing"].includes(rule.operator) && (
											<TextField value={rule.value} onChange={(value) => setRule({ ...rule, value })} maxLength={1024}>
												<Label>Header value</Label>
												<Input variant='secondary' />
											</TextField>
										)}
										<Select variant='secondary' aria-label='Rule action' value={rule.action} onChange={(key) => setRule({ ...rule, action: key as Rule["action"] })}>
											<Label>Rule action</Label>
											<Select.Trigger>
												<Select.Value />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													<ListBox.Item id='block'>
														Block request
														<ListBox.ItemIndicator />
													</ListBox.Item>
													<ListBox.Item id='skip'>
														Skip remaining filters
														<ListBox.ItemIndicator />
													</ListBox.Item>
												</ListBox>
											</Select.Popover>
										</Select>
										<Switch isSelected={rule.enabled} onChange={(enabled) => setRule({ ...rule, enabled })}>
											<Switch.Content>
												<Label>Enable rule</Label>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
											</Switch.Content>
										</Switch>
									</>
								)}
							</Modal.Body>
							<Modal.Footer>
								<Button variant='secondary' onPress={() => setRule(null)}>
									Cancel
								</Button>
								<Button
									isDisabled={!ingressRule.safeParse(rule).success}
									onPress={() => {
										const parsed = ingressRule.parse(rule);
										setPolicy((current) => ({ ...current, rules: current.rules.some((item) => item.id === parsed.id) ? current.rules.map((item) => (item.id === parsed.id ? parsed : item)) : [...current.rules, parsed] }));
										setRule(null);
									}}
								>
									Apply rule
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}
