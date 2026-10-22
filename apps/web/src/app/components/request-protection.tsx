"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Chip, Dropdown, FieldError, Input, Label, ListBox, Modal, Switch, Table, TextArea, TextField } from "@heroui/react";
import { IconArrowDown, IconArrowUp, IconArrowUpRight, IconFlask, IconGripVertical, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { api } from "@lib/api-client";
import { useFeedbackToast } from "@lib/feedback";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { LoadingState } from "@components/loading-state";
import { ConditionBuilder, RuleNumber, RuleSelect } from "@components/request-condition-builder";
import { useTableReorder } from "@components/ui/use-table-reorder";
import { ingressPolicy, ingressRule, ingressRateRule, filterTemplates, formatCondition, newConditionGroup, protectionTestInput, type IngressPolicy, type IngressRule, type IngressRateRule, type ProtectionScope } from "@contracts/ingress-policy";

type Inherited = {
	scope: ProtectionScope;
	name: string;
	version: number;
	enabled: boolean;
	defaultAction: "allow" | "block";
	rules: Pick<IngressRule, "id" | "name" | "enabled" | "action">[];
	rateLimits: Pick<IngressRateRule, "id" | "name" | "enabled">[];
	editable: boolean;
};
type Snapshot = {
	scope: ProtectionScope;
	name: string;
	version: number;
	policy: IngressPolicy;
	inherited: Inherited[];
};
type TestResult = {
	blocked: boolean;
	results: {
		scope: ProtectionScope;
		action: "block" | "skip" | "continue";
		rule: { id: string; name: string } | null;
		rateRules: { id: string; name: string }[];
	}[];
};

const plural = {
	organization: "organizations",
	workspace: "workspaces",
	project: "projects",
	endpoint: "endpoints",
};
const scopeLabels = {
	organization: "Organization",
	workspace: "Workspace",
	project: "Project",
	endpoint: "Ingress route",
};
const algorithms = [
	{ key: "token_bucket", label: "Token bucket" },
	{ key: "rolling", label: "Rolling window" },
	{ key: "fixed", label: "Fixed window" },
];

export function RequestProtection({ scope }: { scope: ProtectionScope }) {
	const [saved, setSaved] = useState<Snapshot | null>(null);
	const [policy, setPolicy] = useState<IngressPolicy>(ingressPolicy.parse({}));
	const [editor, setEditor] = useState<"rule" | "rate" | "templates" | "test" | null>(null);
	const [rule, setRule] = useState<IngressRule | null>(null);
	const [rate, setRate] = useState<IngressRateRule | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [retry, setRetry] = useState(0);
	const [sample, setSample] = useState({
		method: "POST",
		path: "/",
		headers: "{}",
		body: "",
	});
	const [testResult, setTestResult] = useState<TestResult | null>(null);

	const address = "/" + plural[scope.type] + "/" + scope.id + "/protection";
	const dirty = Boolean(saved && JSON.stringify(policy) !== JSON.stringify(saved.policy));

	const { dialog } = useUnsavedChanges(dirty);

	useFeedbackToast(error, notice);

	useEffect(() => {
		let active = true;
		void api<Snapshot>(address).then(
			(data) => {
				if (active) {
					setSaved(data);
					setPolicy(data.policy);
					setError("");
				}
			},
			(cause) => {
				if (active) setError(cause.message);
			},
		);

		return () => {
			active = false;
		};
	}, [address, retry]);

	async function save() {
		if (!saved) return;
		const submitted = policy;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			const data = await api<Snapshot>(address, { method: "PUT", json: { expectedVersion: saved.version, policy: submitted } });
			setSaved(data);
			setPolicy((current) => (current === submitted ? data.policy : current));
			setNotice("Request protection saved.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save request protection");
		} finally {
			setBusy(false);
		}
	}

	function openRule(value?: IngressRule) {
		setRule(
			value ?? {
				id: crypto.randomUUID(),
				name: "",
				enabled: true,
				action: "block",
				condition: newConditionGroup(),
			},
		);
		setEditor("rule");
	}

	function openRate(value?: IngressRateRule) {
		setRate(
			value ?? {
				id: crypto.randomUUID(),
				name: "",
				enabled: true,
				condition: null,
				algorithm: "token_bucket",
				requests: 100,
				windowSeconds: 60,
				burst: 20,
				groupBy: "scope",
			},
		);
		setEditor("rate");
	}

	function closeEditor() {
		setEditor(null);
		setRule(null);
		setRate(null);
		setTestResult(null);
	}

	let sampleInput: ReturnType<typeof protectionTestInput.safeParse>;
	try {
		sampleInput = protectionTestInput.safeParse({
			policy,
			request: {
				method: sample.method,
				path: sample.path,
				headers: JSON.parse(sample.headers),
				bodySize: new TextEncoder().encode(sample.body).byteLength,
			},
		});
	} catch {
		sampleInput = protectionTestInput.safeParse({});
	}

	async function runTest() {
		if (!sampleInput.success) return;
		setBusy(true);
		setError("");
		setNotice("");
		try {
			setTestResult(await api<TestResult>(address + "/test", { method: "POST", json: sampleInput.data }));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not test request protection");
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
			<header className='flex flex-wrap items-start justify-between gap-3'>
				<div>
					<h1 className='text-3xl font-semibold'>Request protection</h1>
				</div>
				<Button
					variant='secondary'
					onPress={() => {
						setTestResult(null);
						setEditor("test");
					}}
					isDisabled={busy || !ingressPolicy.safeParse(policy).success}
				>
					<IconFlask size={18} />
					Test request
				</Button>
			</header>
			{saved.inherited.length > 0 && (
				<Card>
					<Card.Header>
						<Card.Title>Inherited protection</Card.Title>
					</Card.Header>
					<Card.Content className='space-y-4'>
						{saved.inherited.map((parent) => (
							<section key={parent.scope.type + parent.scope.id} className='space-y-2 rounded-xl border border-separator p-3'>
								<div className='flex flex-wrap items-center justify-between gap-2'>
									<p className='font-medium'>
										{scopeLabels[parent.scope.type]}: {parent.name}
									</p>
									{parent.editable && (
										<Link className='button button--ghost button--sm' href={"/" + plural[parent.scope.type] + "/" + parent.scope.id + "/protection"} aria-label={"Open " + parent.name + " protection"}>
											<IconArrowUpRight size={16} />
											Edit at source
										</Link>
									)}
								</div>
								<div className='flex flex-wrap gap-2'>
									{parent.rules.map((item) => (
										<Chip key={item.id} size='sm' color={!parent.enabled || !item.enabled ? "default" : item.action === "block" ? "danger" : "accent"} variant='soft'>
											{item.name}
											{!parent.enabled || !item.enabled ? " (disabled)" : ""}
										</Chip>
									))}
									{parent.rateLimits.map((item) => (
										<Chip key={item.id} size='sm' color={item.enabled ? "warning" : "default"} variant='soft'>
											{item.name}
											{!item.enabled ? " (disabled)" : ""}
										</Chip>
									))}
									{parent.enabled && parent.defaultAction === "block" && (
										<Chip size='sm' color='danger' variant='soft'>
											Block unmatched requests
										</Chip>
									)}
								</div>
							</section>
						))}
					</Card.Content>
				</Card>
			)}
			<Card>
				<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-3'>
					<Card.Title>Request filters</Card.Title>
					<Dropdown>
						<Button variant='secondary' isDisabled={policy.rules.length >= 100 || busy}>
							<IconPlus size={16} />
							Add rule
						</Button>
						<Dropdown.Popover>
							<Dropdown.Menu aria-label='Add request filter' onAction={(key) => (key === "template" ? setEditor("templates") : openRule())}>
								<Dropdown.Item id='scratch' textValue='Create from scratch'>
									Create from scratch
								</Dropdown.Item>
								<Dropdown.Item id='template' textValue='Create from template'>
									Create from template
								</Dropdown.Item>
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown>
				</Card.Header>
				<Card.Content className='space-y-4'>
					<Switch isSelected={policy.enabled} onChange={(enabled) => setPolicy((current) => ({ ...current, enabled }))}>
						<Switch.Content>
							<Label>Enable request filters</Label>
							<Switch.Control>
								<Switch.Thumb />
							</Switch.Control>
						</Switch.Content>
					</Switch>
					{policy.enabled && (
						<RuleSelect
							label='When no rule matches'
							value={policy.defaultAction}
							items={[
								{ key: "allow", label: "Continue to the next protection checks" },
								{ key: "block", label: "Block the request" },
							]}
							onChange={(value) => setPolicy((current) => ({ ...current, defaultAction: value === "block" ? "block" : "allow" }))}
						/>
					)}
					<ProtectionRuleTable kind='filter' items={policy.rules} disabled={busy} onChange={(rules) => setPolicy((current) => ({ ...current, rules }))} onEdit={openRule} onToggle={(id, enabled) => setPolicy((current) => ({ ...current, rules: current.rules.map((item) => (item.id === id ? { ...item, enabled } : item)) }))} onDelete={(id) => setPolicy((current) => ({ ...current, rules: current.rules.filter((item) => item.id !== id) }))} />
				</Card.Content>
			</Card>
			<Card>
				<Card.Header className='flex flex-row flex-wrap items-center justify-between gap-3'>
					<Card.Title>Rate limits</Card.Title>
					<Button variant='secondary' isDisabled={policy.rateLimits.length >= 10 || busy} onPress={() => openRate()}>
						<IconPlus size={16} />
						Add rate limit
					</Button>
				</Card.Header>
				<Card.Content>
					<ProtectionRuleTable kind='rate' items={policy.rateLimits} disabled={busy} onChange={(rateLimits) => setPolicy((current) => ({ ...current, rateLimits }))} onEdit={openRate} onToggle={(id, enabled) => setPolicy((current) => ({ ...current, rateLimits: current.rateLimits.map((item) => (item.id === id ? { ...item, enabled } : item)) }))} onDelete={(id) => setPolicy((current) => ({ ...current, rateLimits: current.rateLimits.filter((item) => item.id !== id) }))} />
				</Card.Content>
			</Card>
			<div className='flex justify-center sm:justify-end'>
				<Button isDisabled={busy || !dirty || !ingressPolicy.safeParse(policy).success} onPress={() => void save()}>
					Save request protection
				</Button>
			</div>
			<Modal
				isOpen={editor !== null}
				onOpenChange={(open) => {
					if (!open) closeEditor();
				}}
			>
				<Modal.Backdrop>
					<Modal.Container placement='center' size='lg'>
						<Modal.Dialog className='flex max-h-[calc(100dvh-2rem)] flex-col'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>{editor === "rule" ? "Request filter rule" : editor === "rate" ? "Rate limit rule" : editor === "templates" ? "Choose a rule template" : "Test request protection"}</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='min-h-0 space-y-4 overflow-y-auto'>
								{editor === "templates" && (
									<ListBox
										aria-label='Rule templates'
										onAction={(key) => {
											const template = filterTemplates.find((item) => item.id === key);
											if (template) openRule(template.create());
										}}
									>
										{filterTemplates.map((template) => (
											<ListBox.Item id={template.id} key={template.id} textValue={template.name}>
												<Label>{template.name}</Label>
												<p className='mt-1 text-sm text-muted'>{template.description}</p>
											</ListBox.Item>
										))}
									</ListBox>
								)}
								{editor === "rule" && rule && (
									<>
										<TextField value={rule.name} onChange={(name) => setRule({ ...rule, name })} isRequired>
											<Label>Rule name</Label>
											<Input variant='secondary' />
										</TextField>
										<RuleSelect
											label='Action'
											value={rule.action}
											items={[
												{ key: "block", label: "Block request (403)" },
												{ key: "skip", label: "Skip remaining filters at this scope" },
											]}
											onChange={(action) => setRule({ ...rule, action: action === "skip" ? "skip" : "block" })}
										/>
										<ConditionBuilder value={rule.condition} onChange={(condition) => setRule({ ...rule, condition })} />
									</>
								)}
								{editor === "rate" && rate && (
									<>
										<TextField value={rate.name} onChange={(name) => setRate({ ...rate, name })} isRequired>
											<Label>Rate limit name</Label>
											<Input variant='secondary' />
										</TextField>
										<RuleSelect label='Algorithm' value={rate.algorithm} items={algorithms} onChange={(algorithm) => setRate({ ...rate, algorithm: algorithm as IngressRateRule["algorithm"] })} />
										<p className='text-sm text-muted'>{rate.algorithm === "token_bucket" ? "Capacity refills continuously. Burst size controls how many requests can arrive together." : rate.algorithm === "rolling" ? "Counts requests within the preceding interval, without a window-reset burst." : "Counts requests in a window that starts with its first request."}</p>
										<div className='grid gap-4 sm:grid-cols-2'>
											<RuleNumber label={rate.algorithm === "token_bucket" ? "Refill requests" : "Requests per window"} value={rate.requests} min={1} max={rate.algorithm === "rolling" ? 10000 : 1000000} onChange={(requests) => setRate({ ...rate, requests })} />
											<RuleNumber label='Interval (seconds)' value={rate.windowSeconds} min={1} max={86400} onChange={(windowSeconds) => setRate({ ...rate, windowSeconds })} />
										</div>
										{rate.algorithm === "token_bucket" && <RuleNumber label='Burst size' value={rate.burst} min={1} max={1000000} onChange={(burst) => setRate({ ...rate, burst })} />}
										<RuleSelect
											label='Count requests together'
											value={rate.groupBy}
											items={[
												{ key: "scope", label: "Share one counter across this " + (scope.type === "endpoint" ? "route" : scope.type) },
												{ key: "route", label: "Separate counter for each route" },
											]}
											onChange={(groupBy) => setRate({ ...rate, groupBy: groupBy === "route" ? "route" : "scope" })}
										/>
										<RuleSelect
											label='Requests to count'
											value={rate.condition ? "matching" : "all"}
											items={[
												{ key: "all", label: "All requests" },
												{ key: "matching", label: "Only matching requests" },
											]}
											onChange={(match) => setRate({ ...rate, condition: match === "matching" ? newConditionGroup() : null })}
										/>
										{rate.condition && <ConditionBuilder value={rate.condition} onChange={(condition) => setRate({ ...rate, condition })} />}
									</>
								)}
								{editor === "test" && (
									<>
										<p className='text-sm text-muted'>Check filters and matching limits without sending a request or consuming quota.</p>
										<div className='grid gap-3 sm:grid-cols-[10rem_1fr]'>
											<RuleSelect
												label='HTTP method'
												disabled={busy}
												value={sample.method}
												items={["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((key) => ({ key, label: key }))}
												onChange={(method) => {
													setSample({ ...sample, method });
													setTestResult(null);
												}}
											/>
											<TextField
												isDisabled={busy}
												value={sample.path}
												onChange={(path) => {
													setSample({ ...sample, path });
													setTestResult(null);
												}}
											>
												<Label>URL path</Label>
												<Input variant='secondary' />
											</TextField>
										</div>
										<TextField
											isDisabled={busy}
											value={sample.headers}
											onChange={(headers) => {
												setSample({ ...sample, headers });
												setTestResult(null);
											}}
											isInvalid={!sampleInput.success}
										>
											<Label>Request headers (JSON)</Label>
											<TextArea variant='secondary' rows={4} className='font-mono text-sm' />
											<FieldError>Enter a JSON object of header names and string values, and a valid URL path.</FieldError>
										</TextField>
										<TextField
											isDisabled={busy}
											value={sample.body}
											onChange={(body) => {
												setSample({ ...sample, body });
												setTestResult(null);
											}}
										>
											<Label>Request body</Label>
											<TextArea variant='secondary' rows={3} />
										</TextField>
										{testResult && (
											<section aria-label='Protection test result' className='space-y-3 rounded-xl border border-separator p-3'>
												<Chip color={testResult.blocked ? "danger" : "success"} variant='soft'>
													{testResult.blocked ? "Would be blocked" : "Filters permit this request"}
												</Chip>
												{testResult.results.map((result, index) => (
													<div key={result.scope.type + result.scope.id}>
														<p className='font-medium'>
															{index + 1}. {scopeLabels[result.scope.type]}
														</p>
														<p className='text-sm text-muted'>
															{result.rule?.name ?? "No matching filter"}
															{result.action === "block" ? " — Block" : result.action === "skip" ? " — Skip remaining filters here" : " — Continue"}
														</p>
														{result.rateRules.map((limit) => (
															<p key={limit.id} className='text-sm'>
																Matching limit: {limit.name}
															</p>
														))}
													</div>
												))}
											</section>
										)}
									</>
								)}
							</Modal.Body>
							<Modal.Footer className='shrink-0'>
								<Button variant='tertiary' onPress={closeEditor}>
									Cancel
								</Button>
								{editor === "rule" && rule && (
									<Button
										isDisabled={!ingressRule.safeParse(rule).success}
										onPress={() => {
											const parsed = ingressRule.parse(rule);
											setPolicy((current) => ({ ...current, rules: current.rules.some((item) => item.id === parsed.id) ? current.rules.map((item) => (item.id === parsed.id ? parsed : item)) : [...current.rules, parsed] }));
											closeEditor();
										}}
									>
										Apply rule
									</Button>
								)}
								{editor === "rate" && rate && (
									<Button
										isDisabled={!ingressRateRule.safeParse(rate).success}
										onPress={() => {
											const parsed = ingressRateRule.parse(rate);
											setPolicy((current) => ({ ...current, rateLimits: current.rateLimits.some((item) => item.id === parsed.id) ? current.rateLimits.map((item) => (item.id === parsed.id ? parsed : item)) : [...current.rateLimits, parsed] }));
											closeEditor();
										}}
									>
										Apply rate limit
									</Button>
								)}
								{editor === "test" && (
									<Button isPending={busy} isDisabled={!sampleInput.success} onPress={() => void runTest()}>
										Test request
									</Button>
								)}
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</section>
	);
}

type ProtectionRuleTableProps<T extends IngressRule | IngressRateRule> = {
	kind: "filter" | "rate";
	items: T[];
	disabled: boolean;

	onChange: (items: T[]) => void;
	onEdit: (item: T) => void;
	onDelete: (id: string) => void;
	onToggle: (id: string, enabled: boolean) => void;
};

function ProtectionRuleTable<T extends IngressRule | IngressRateRule>({ kind, items, disabled, onChange, onEdit, onDelete, onToggle }: ProtectionRuleTableProps<T>) {
	const ordering = useTableReorder(items, onChange, kind, disabled);

	function move(index: number, offset: number) {
		const next = [...items];
		[next[index], next[index + offset]] = [next[index + offset], next[index]];
		onChange(next);
	}

	return (
		<Table variant='secondary'>
			<Table.ScrollContainer>
				<Table.Content aria-label={kind === "filter" ? "Request filter rules" : "Rate limit rules"} dragAndDropHooks={ordering.dragAndDropHooks}>
					<Table.Header>
						<Table.Column className='w-8' aria-label='Order' />
						<Table.Column isRowHeader>Rule</Table.Column>
						<Table.Column className='hidden sm:table-cell'>{kind === "filter" ? "Action" : "Limit"}</Table.Column>
						<Table.Column className='w-24 text-right'>Actions</Table.Column>
					</Table.Header>
					<Table.Body items={items} dependencies={[disabled, ordering.visual, items]} renderEmptyState={() => <div className='p-4 text-center text-muted'>{kind === "filter" ? "No request filters yet." : "No rate limits yet."}</div>}>
						{(item) => {
							const summary = "action" in item ? (item.action === "block" ? "Block" : "Skip filters") : `${item.requests} / ${item.windowSeconds}s${item.algorithm === "token_bucket" ? " / burst " + item.burst : ""}`;

							return (
								<Table.Row id={item.id} data-reorder-id={item.id} data-reorder-group={kind} className={ordering.visual?.source === item.id ? "opacity-50" : ordering.visual?.target === item.id ? "outline outline-2 outline-accent" : undefined}>
									<Table.Cell className='w-8 p-1'>
										<span {...ordering.handle(item.id)} data-drag-handle className='inline-flex touch-none cursor-grab active:cursor-grabbing'>
											<Button slot='drag' isIconOnly variant='ghost' size='sm' aria-label={"Drag " + item.name} aria-description='Drag the handle to reorder, or press Enter for keyboard drag and drop' className='touch-none cursor-grab active:cursor-grabbing' isDisabled={disabled}>
												<IconGripVertical size={16} />
											</Button>
										</span>
									</Table.Cell>
									<Table.Cell className='min-w-0'>
										<strong className='break-words text-sm'>{item.name}</strong>
										{item.condition && <p className='mt-1 line-clamp-2 break-all font-mono text-xs text-muted'>{formatCondition(item.condition)}</p>}
										{"algorithm" in item && (
											<p className='mt-1 text-xs text-muted'>
												{algorithms.find((algorithm) => algorithm.key === item.algorithm)?.label}
												{item.groupBy === "route" ? " / per route" : " / shared"}
											</p>
										)}
										<p className='mt-1 text-xs sm:hidden'>{summary}</p>
										<Switch isSelected={item.enabled} onChange={(enabled) => onToggle(item.id, enabled)} isDisabled={disabled} className='mt-2'>
											<Switch.Content>
												<Label className='text-xs'>{item.enabled ? "Enabled" : "Disabled"}</Label>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
											</Switch.Content>
										</Switch>
									</Table.Cell>
									<Table.Cell className='hidden sm:table-cell'>
										<Chip size='sm' color={"action" in item && item.action === "block" ? "danger" : "accent"} variant='soft'>
											{summary}
										</Chip>
									</Table.Cell>
									<Table.Cell className='w-24 align-top'>
										<div className='ml-auto grid w-fit grid-cols-2 gap-1'>
											<Button isIconOnly size='sm' variant='ghost' aria-label={"Move " + item.name + " up"} isDisabled={disabled || items[0].id === item.id} onPress={() => move(items.indexOf(item), -1)}>
												<IconArrowUp size={15} />
											</Button>
											<Button isIconOnly size='sm' variant='ghost' aria-label={"Move " + item.name + " down"} isDisabled={disabled || items.at(-1)?.id === item.id} onPress={() => move(items.indexOf(item), 1)}>
												<IconArrowDown size={15} />
											</Button>
											<Button isIconOnly size='sm' variant='ghost' aria-label={"Edit " + item.name} isDisabled={disabled} onPress={() => onEdit(item)}>
												<IconPencil size={15} />
											</Button>
											<Button isIconOnly size='sm' variant='ghost' className='text-danger' aria-label={"Delete " + item.name} isDisabled={disabled} onPress={() => onDelete(item.id)}>
												<IconTrash size={15} />
											</Button>
										</div>
									</Table.Cell>
								</Table.Row>
							);
						}}
					</Table.Body>
				</Table.Content>
			</Table.ScrollContainer>
		</Table>
	);
}
