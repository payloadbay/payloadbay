"use client";

import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import { use, useEffect, useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useDragAndDrop } from "react-aria-components";
import { Button, Card, Form, TextField, Label, Input, FieldError, Tabs, NumberField, Checkbox, Table, Modal } from "@heroui/react";
import { EmptyState, NativeSelect } from "@heroui-pro/react";
import { IconCode, IconPlus, IconCopy, IconLock, IconArrowLeft, IconCheck, IconGripVertical, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import { formatScript, formatScriptForDisplay, scriptDocument } from "@lib/script-document";
import { useUnsavedChanges } from "@components/unsaved-changes";
import { ScriptingGuide } from "@components/scripting-guide";
import { HelperImportPicker } from "@components/helper-import-picker";
import { CodeEditor } from "@components/code-editor";
import { api, ApiFailure } from "@lib/api-client";
import { useDashboard } from "@components/dashboard-shell";
import type { Permission } from "@contracts/permissions";
import type { CompilationDiagnostic } from "@contracts/compilation";

type Scope = { type: "instance" | "organization" | "workspace" | "project" | "endpoint"; id: string };
type Module = {
	id: string;
	name: string;
	scope: Scope;
	originRevisionId: string | null;
	createdAt: string;
	source?: string;
};
type Binding = {
	id: string;
	name: string;
	scope: Scope;
	stage: "ingress" | "processing";
	position: number;
	failurePolicy: "required" | "optional";
	overridePolicy: "allowed" | "forbidden";
	requiredAction: "retry" | "fail";
	enabled: boolean;
	version: number;
	editable: boolean;
	originBindingId: string | null;
	sharedBindings?: Record<string, string>;
	secretBindings?: Record<string, string>;
	body?: string;
};

function middlewareStarter(name = "", stage: "ingress" | "processing" = "processing") {
	const identifier = name.replace(/[^A-Za-z0-9_$]/g, "_") || "middleware";
	const functionName = /^[A-Za-z_$]/.test(identifier) ? identifier : "middleware_" + identifier;

	return scriptDocument("\treturn ctx.continue();", stage === "ingress" ? "ingress_middleware" : "processing_middleware").replace("function middleware(", "function " + functionName + "(");
}

export default function CodePage({ params }: { params: Promise<{ scopeType: string; scopeId: string }> }) {
	const { scopeType, scopeId } = use(params);

	const { me, organizations, workspaces, projects } = useDashboard();

	const scopes = [
		...(me.permissions.includes("code.read")
			? [
					{
						type: "instance",
						id: me.instanceId,
						name: "Instance",
						permissions: me.permissions,
					},
				]
			: []),
		...organizations.filter((scope) => scope.permissions.includes("code.read")).map((scope) => ({ type: "organization", ...scope })),
		...workspaces.filter((scope) => scope.permissions.includes("code.read")).map((scope) => ({ type: "workspace", ...scope })),
		...projects.filter((scope) => scope.permissions.includes("code.read")).map((scope) => ({ type: "project", ...scope })),
	];
	const selectedScope = scopes.find((scope) => scope.type === scopeType && scope.id === scopeId);
	const valid = ["instance", "organization", "workspace", "project", "endpoint"].includes(scopeType);
	const scope: Scope = { type: valid ? (scopeType as Scope["type"]) : "project", id: scopeId };

	const [endpointScope, setEndpointScope] = useState<{ name: string; permissions: Permission[]; projectId: string } | null>(null);
	const [modules, setModules] = useState<Module[]>([]);
	const [bindings, setBindings] = useState<Binding[]>([]);
	const [tab, setTab] = useState<"modules" | "middleware">(scopeType === "endpoint" ? "middleware" : "modules");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [name, setName] = useState("");
	const [body, setBody] = useState("");
	const [editingModule, setEditingModule] = useState<Module | null>(null);
	const [editingBinding, setEditingBinding] = useState<Binding | null>(null);
	const [stage, setStage] = useState<"ingress" | "processing">("processing");
	const [position, setPosition] = useState("0");
	const [failure, setFailure] = useState<"required" | "optional">("required");
	const [override, setOverride] = useState<"allowed" | "forbidden">("allowed");
	const [action, setAction] = useState<"retry" | "fail">("retry");
	const [enabled, setEnabled] = useState(true);
	const [notice, setNotice] = useState("");
	const [diagnostics, setDiagnostics] = useState<CompilationDiagnostic[]>([]);
	const [origin, setOrigin] = useState<string | null>(null);
	const [sharedBindings, setSharedBindings] = useState<Record<string, string>>({});
	const [secretBindings, setSecretBindings] = useState<Record<string, string>>({});
	const [savedEditor, setSavedEditor] = useState("");

	const editorSnapshot = JSON.stringify({
		name,
		body,
		stage,
		position,
		failure,
		override,
		action,
		enabled,
	});

	const { dialog: unsavedDialog, confirmDiscard } = useUnsavedChanges(open && Boolean(savedEditor) && editorSnapshot !== savedEditor);

	useFeedbackToast(error, notice, { error: "Code error", success: "Code status" });

	const rights = selectedScope?.permissions ?? endpointScope?.permissions ?? [];
	const canEdit = rights.includes("code.edit");
	const canPublish = rights.includes("code.publish");

	const fetchData = useCallback(async () => {
		const query = "?scopeType=" + scopeType + "&scopeId=" + encodeURIComponent(scopeId);
		const [nextModules, nextBindings, endpoint] = await Promise.all([scopeType === "endpoint" ? Promise.resolve([] as Module[]) : api<Module[]>("/shared-code" + query), api<Binding[]>("/middleware" + query), scopeType === "endpoint" ? api<{ name: string; permissions: Permission[]; projectId: string }>("/endpoints/" + scopeId) : Promise.resolve(null)]);

		return { nextModules, nextBindings, endpoint };
	}, [scopeType, scopeId]);

	const receive = useCallback(({ nextModules, nextBindings, endpoint }: Awaited<ReturnType<typeof fetchData>>) => {
		setModules(nextModules);
		setBindings(nextBindings);
		setEndpointScope(endpoint);
		setLoading(false);
	}, []);

	const failed = useCallback((cause: unknown) => {
		setError(cause instanceof Error ? cause.message : "Code unavailable");
		setLoading(false);
		if (cause instanceof ApiFailure) setDiagnostics(cause.diagnostics ?? []);
	}, []);

	const load = useCallback(async () => {
		try {
			receive(await fetchData());
			setError("");
		} catch (cause) {
			failed(cause);
		}
	}, [fetchData, receive, failed]);

	async function reorder(items: Binding[]) {
		if (!items.length || busy) return;
		setBusy(true);
		setError("");
		try {
			await api("/middleware/reorder", { method: "POST", json: { scope, stage: items[0].stage, items: items.map((item) => ({ id: item.id, version: item.version })) } });
			await load();
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	function move(binding: Binding, offset: number) {
		const items = bindings.filter((item) => item.editable && item.stage === binding.stage);
		const index = items.findIndex((item) => item.id === binding.id);
		const target = index + offset;
		if (target < 0 || target >= items.length) return;
		[items[index], items[target]] = [items[target], items[index]];
		void reorder(items);
	}

	const { dragAndDropHooks } = useDragAndDrop({
		isDisabled: busy || !canEdit || !canPublish,
		getItems: (keys) => [...keys].filter((key) => bindings.some((item) => item.id === key && item.editable)).map((key) => ({ "text/plain": String(key) })),
		onReorder: (event) => {
			const target = bindings.find((item) => item.id === event.target.key);
			const moved = bindings.filter((item) => event.keys.has(item.id));
			if (!target?.editable || moved.some((item) => !item.editable || item.stage !== target.stage)) return;
			const items = bindings.filter((item) => item.editable && item.stage === target.stage && !event.keys.has(item.id));
			const index = items.findIndex((item) => item.id === target.id);
			if (index < 0) return;
			items.splice(index + (event.target.dropPosition === "after" ? 1 : 0), 0, ...moved);
			void reorder(items);
		},
	});

	useEffect(() => {
		if (!valid) return;
		let active = true;
		fetchData().then(
			(data) => {
				if (active) receive(data);
			},
			(cause) => {
				if (active) failed(cause);
			},
		);

		return () => {
			active = false;
		};
	}, [fetchData, receive, failed, valid]);

	function start() {
		setOrigin(null);
		setSharedBindings({});
		setSecretBindings({});
		setEditingModule(null);
		setEditingBinding(null);
		setName("");
		setBody(tab === "modules" ? "export function example(value: string) {\n\treturn value;\n}" : middlewareStarter());
		setStage("processing");
		setPosition("0");
		setFailure("required");
		setOverride("allowed");
		setAction("retry");
		setEnabled(true);
		setDiagnostics([]);
		setError("");
		setSavedEditor(
			JSON.stringify({
				name: "",
				body: tab === "modules" ? "export function example(value: string) {\n\treturn value;\n}" : middlewareStarter(),
				stage: "processing",
				position: "0",
				failure: "required",
				override: "allowed",
				action: "retry",
				enabled: true,
			}),
		);
		setOpen(true);
	}

	async function editModule(module: Module) {
		try {
			const full = await api<Module & { source: string }>("/shared-code/" + module.id);
			full.source = await formatScriptForDisplay(full.source);
			setEditingModule(full);
			setEditingBinding(null);
			setName(full.name);
			setBody(full.source);
			setSavedEditor(
				JSON.stringify({
					name: full.name,
					body: full.source,
					stage,
					position,
					failure,
					override,
					action,
					enabled,
				}),
			);
			setDiagnostics([]);
			setError("");
			setOpen(true);
		} catch (cause) {
			failed(cause);
		}
	}

	async function copy(module: Module) {
		setBusy(true);
		setNotice("");
		try {
			await api("/shared-code/" + module.id + "/copy", { method: "POST", json: { scope, name: module.name } });
			setNotice("Copied into this scope. The original version stays unchanged.");
			await load();
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	async function editBinding(binding: Binding, asCopy = false) {
		try {
			const full = await api<Binding & { body: string }>("/middleware/" + binding.id);
			full.body = await formatScriptForDisplay(scriptDocument(full.body, full.stage === "ingress" ? "ingress_middleware" : "processing_middleware", full.sharedBindings));
			setEditingBinding(asCopy ? null : full);
			setOrigin(asCopy ? full.id : full.originBindingId);
			setSharedBindings(full.sharedBindings ?? {});
			setSecretBindings(full.secretBindings ?? {});
			setEditingModule(null);
			setName(full.name);
			setBody(full.body);
			setStage(full.stage);
			setPosition(String(full.position));
			setFailure(full.failurePolicy);
			setOverride(full.overridePolicy);
			setAction(full.requiredAction);
			setEnabled(full.enabled);
			setSavedEditor(
				JSON.stringify({
					name: full.name,
					body: full.body,
					stage: full.stage,
					position: String(full.position),
					failure: full.failurePolicy,
					override: full.overridePolicy,
					action: full.requiredAction,
					enabled: full.enabled,
				}),
			);
			setDiagnostics([]);
			setError("");
			setOpen(true);
		} catch (cause) {
			failed(cause);
		}
	}

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setNotice("");
		setError("");
		setDiagnostics([]);
		try {
			const source = tab === "middleware" ? scriptDocument(body, stage === "ingress" ? "ingress_middleware" : "processing_middleware", sharedBindings) : body;
			const formatted = await formatScript(source);
			setBody(formatted);
			if (tab === "modules") {
				await api("/shared-code", {
					method: "POST",
					json: {
						scope,
						name,
						source: formatted,
						...(editingModule ? { originRevisionId: editingModule.id } : {}),
					},
				});
				setNotice("Saved a new immutable helper version. Bind it to a route and publish to use it.");
			} else {
				const value = {
					name,
					body: formatted,
					position: Number(position),
					failurePolicy: failure,
					overridePolicy: override,
					requiredAction: action,
					sharedBindings,
					secretBindings,
				};
				await api(editingBinding ? "/middleware/" + editingBinding.id : "/middleware", {
					method: editingBinding ? "PATCH" : "POST",
					...(editingBinding ? { version: editingBinding.version } : {}),
					json: editingBinding
						? { ...value, enabled }
						: {
								...value,
								scope,
								stage,
								...(origin ? { originBindingId: origin } : {}),
							},
				});
				setNotice("Middleware saved. Publish affected routes to activate the new configuration.");
			}

			setOpen(false);
			await load();
		} catch (cause) {
			failed(cause);
		} finally {
			setBusy(false);
		}
	}

	if (!valid) return <p role='alert'>Choose a valid code scope.</p>;
	if (loading) return <LoadingState label='Loading code…' size='page' />;

	return (
		<section className='flex flex-col gap-6'>
			{unsavedDialog}
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<Link href={scopeType === "project" ? "/projects/" + scopeId : scopeType === "organization" ? "/organizations/" + scopeId : scopeType === "workspace" ? "/workspaces/" + scopeId : scopeType === "endpoint" && endpointScope ? "/projects/" + endpointScope.projectId + "/routes/" + scopeId : "/"} className='text-accent mb-3 flex items-center gap-2 text-sm'>
						<IconArrowLeft size={16} />
						{scopeType === "project" ? "Back to project" : scopeType === "organization" ? "Back to organization" : scopeType === "workspace" ? "Back to workspace" : scopeType === "endpoint" ? "Back to ingress route" : "Back to overview"}
					</Link>
					<p className='text-muted text-sm'>{selectedScope?.name ?? endpointScope?.name ?? "Scope"}</p>
					<h1 className='text-3xl font-semibold'>Code and middleware</h1>
					<p className='text-muted mt-2'>Versioned helpers and ordered lifecycle middleware. Existing publications keep their pinned code.</p>
				</div>
				{canEdit && ((tab === "modules" && scopeType !== "endpoint") || (tab === "middleware" && canPublish)) && (
					<Button onPress={start}>
						<IconPlus size={18} />
						{tab === "modules" ? "Create helper" : "Create middleware"}
					</Button>
				)}
			</header>

			<p className='text-muted text-sm'>
				Created here: <strong>{scopeType === "endpoint" ? "this ingress route" : "this " + scopeType}</strong>. {scopeType !== "endpoint" ? "Helpers and middleware are available to descendant scopes; creating here does not change a parent scope." : "Route middleware applies only to this ingress route."}
			</p>
			<Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key as "modules" | "middleware")}>
				<Tabs.List aria-label='Code category'>
					{scopeType !== "endpoint" && (
						<Tabs.Tab id='modules'>
							Shared helpers
							<Tabs.Indicator />
						</Tabs.Tab>
					)}
					<Tabs.Tab id='middleware'>
						Middleware
						<Tabs.Indicator />
					</Tabs.Tab>
				</Tabs.List>
			</Tabs>
			{tab === "modules" && scopeType !== "endpoint" ? (
				modules.length ? (
					<div className='grid gap-4 md:grid-cols-2'>
						{modules.map((module) => (
							<Card key={module.id}>
								<Card.Header>
									<h2 className='font-semibold'>{module.name}</h2>
									<Card.Description>
										{module.scope.type} · {module.id.slice(0, 8)}
										{module.originRevisionId ? " · copied version" : ""}
									</Card.Description>
								</Card.Header>
								<Card.Footer>
									<Button size='sm' variant='secondary' onPress={() => void editModule(module)}>
										{canEdit ? (module.scope.id === scopeId ? "Edit as new version" : "Edit local copy") : "View source"}
									</Button>
									{canEdit && (
										<Button size='sm' variant='ghost' isDisabled={busy} onPress={() => void copy(module)}>
											<IconCopy size={16} />
											Copy locally
										</Button>
									)}
								</Card.Footer>
							</Card>
						))}
					</div>
				) : (
					<EmptyState className='border-border rounded-xl border border-dashed py-12'>
						<EmptyState.Header>
							<EmptyState.Media variant='icon'>
								<IconCode />
							</EmptyState.Media>
							<EmptyState.Title>No shared helpers yet</EmptyState.Title>
							<EmptyState.Description>Create reusable exports, then bind their versions to ingress or processing scripts.</EmptyState.Description>
						</EmptyState.Header>
					</EmptyState>
				)
			) : (
				<div className='flex flex-col gap-3'>
					<p className='text-muted text-sm'>Execution order: instance → workspace → project → ingress route. Optional failures keep the last valid context; required failures stop the stage.</p>
					{bindings.length ? (
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Middleware execution order' dragAndDropHooks={dragAndDropHooks}>
									<Table.Header>
										<Table.Column aria-label='Order' />
										<Table.Column isRowHeader>Middleware</Table.Column>
										<Table.Column>Stage and scope</Table.Column>
										<Table.Column>Actions</Table.Column>
									</Table.Header>
									<Table.Body items={bindings}>
										{(binding) => (
											<Table.Row id={binding.id}>
												<Table.Cell>
													{binding.editable ? (
														<Button slot='drag' size='sm' variant='ghost' aria-label={"Drag " + binding.name} isDisabled={busy}>
															<IconGripVertical size={16} />
														</Button>
													) : (
														<IconLock size={16} aria-label='Inherited' />
													)}
												</Table.Cell>
												<Table.Cell>
													<h2 className='font-semibold'>{binding.name}</h2>
													<p className='text-muted text-xs'>
														{binding.failurePolicy} · {binding.enabled ? "enabled" : "disabled"} · version {binding.version}
													</p>
													{binding.originBindingId && <p className='text-muted text-xs'>Local replacement</p>}
												</Table.Cell>
												<Table.Cell>
													{binding.stage}
													<p className='text-muted text-xs'>
														{binding.scope.type} · {scopes.find((parent) => parent.type === binding.scope.type && parent.id === binding.scope.id)?.name ?? binding.scope.id.slice(0, 8)} · position {binding.position}
													</p>
												</Table.Cell>
												<Table.Cell>
													{binding.editable ? (
														<div className='flex items-center gap-2'>
															<Button size='sm' variant='secondary' onPress={() => void editBinding(binding)}>
																Edit middleware
															</Button>
															<Button size='sm' variant='ghost' aria-label={"Move " + binding.name + " up"} isDisabled={busy || bindings.filter((item) => item.editable && item.stage === binding.stage)[0]?.id === binding.id} onPress={() => move(binding, -1)}>
																<IconArrowUp size={16} />
															</Button>
															<Button size='sm' variant='ghost' aria-label={"Move " + binding.name + " down"} isDisabled={busy || bindings.filter((item) => item.editable && item.stage === binding.stage).at(-1)?.id === binding.id} onPress={() => move(binding, 1)}>
																<IconArrowDown size={16} />
															</Button>
														</div>
													) : (
														<div className='flex flex-col gap-2'>
															<span className='text-muted text-sm'>Inherited · {binding.overridePolicy === "forbidden" ? "overrides locked" : "managed in parent scope"}</span>
															{canEdit && canPublish && binding.overridePolicy === "allowed" && scopes.some((parent) => parent.type === binding.scope.type && parent.id === binding.scope.id) && (
																<Button size='sm' variant='secondary' onPress={() => void editBinding(binding, true)}>
																	Create local override
																</Button>
															)}
														</div>
													)}
												</Table.Cell>
											</Table.Row>
										)}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					) : (
						<EmptyState className='border-border rounded-xl border border-dashed py-12'>
							<EmptyState.Header>
								<EmptyState.Title>No middleware yet</EmptyState.Title>
								<EmptyState.Description>Add lifecycle code at this scope. Routes pin the effective chain when published.</EmptyState.Description>
							</EmptyState.Header>
						</EmptyState>
					)}
				</div>
			)}
			<Modal
				isOpen={open}
				onOpenChange={(next) => {
					if (!busy) {
						if (next) setOpen(true);
						else confirmDiscard(() => setOpen(false));
					}
				}}
			>
				<Modal.Backdrop>
					<Modal.Container placement='auto' size='lg' className='sm:w-full'>
						<Modal.Dialog className='flex max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-5xl flex-col overflow-hidden'>
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>{tab === "modules" ? "Shared helper source" : "Middleware configuration"}</Modal.Heading>
							</Modal.Header>
							<Modal.Body className='min-h-0 flex-1 overflow-y-auto'>
								<Form id='code-editor-form' className='flex flex-col gap-4' onSubmit={save}>
									{diagnostics.map((diagnostic, index) => (
										<p key={index} role='alert' className='text-danger font-mono text-xs'>
											{diagnostic.sourceId}:{diagnostic.line}:{diagnostic.column} — {diagnostic.message}
										</p>
									))}
									<TextField
										isRequired
										value={name}
										onChange={(next) => {
											if (tab === "middleware" && !editingBinding) setBody((current) => (current === middlewareStarter(name, stage) ? middlewareStarter(next, stage) : current));
											if (tab === "modules" && !editingBinding)
												setBody((current) => {
													const prior = name.replace(/[^A-Za-z0-9_$]/g, "_") || "example";
													const identifier = next.replace(/[^A-Za-z0-9_$]/g, "_") || "example";
													if (!/^[A-Za-z_$]/.test(identifier)) return current;
													const starter = `export function ${prior}(value: string) {\n\treturn value;\n}`;

													return current === starter ? `export function ${identifier}(value: string) {\n\treturn value;\n}` : current;
												});
											setName(next);
										}}
										maxLength={100}
										isDisabled={busy || !canEdit}
									>
										<Label>{tab === "modules" ? "Helper name" : "Middleware name"}</Label>
										<Input variant='secondary' />
										<FieldError />
									</TextField>
									{tab === "middleware" && (
										<>
											<NativeSelect variant='secondary' fullWidth>
												<Label>Stage</Label>
												<NativeSelect.Trigger
													aria-label='Middleware stage'
													value={stage}
													onChange={(event) => {
														const next = event.target.value as typeof stage;
														setBody((current) => (current === middlewareStarter(name, stage) ? middlewareStarter(name, next) : current));
														setStage(next);
													}}
													disabled={busy || Boolean(editingBinding)}
												>
													<NativeSelect.Option value='ingress'>Ingress</NativeSelect.Option>
													<NativeSelect.Option value='processing'>Processing</NativeSelect.Option>
													<NativeSelect.Indicator />
												</NativeSelect.Trigger>
											</NativeSelect>
											<NumberField variant='secondary' value={Number(position)} onChange={(value) => setPosition(String(value))} minValue={0} maxValue={10000}>
												<Label>Position</Label>
												<NumberField.Group>
													<NumberField.DecrementButton />
													<NumberField.Input aria-label='Middleware position' />
													<NumberField.IncrementButton />
												</NumberField.Group>
												<FieldError />
											</NumberField>
											<div className='grid gap-3 sm:grid-cols-2'>
												<NativeSelect variant='secondary' fullWidth>
													<Label>Failure behavior</Label>
													<NativeSelect.Trigger aria-label='Middleware failure behavior' value={failure} onChange={(event) => setFailure(event.target.value as typeof failure)}>
														<NativeSelect.Option value='required'>Required</NativeSelect.Option>
														<NativeSelect.Option value='optional'>Optional</NativeSelect.Option>
														<NativeSelect.Indicator />
													</NativeSelect.Trigger>
												</NativeSelect>
												<NativeSelect variant='secondary' fullWidth>
													<Label>Child overrides</Label>
													<NativeSelect.Trigger aria-label='Middleware child overrides' value={override} onChange={(event) => setOverride(event.target.value as typeof override)}>
														<NativeSelect.Option value='allowed'>Allowed</NativeSelect.Option>
														<NativeSelect.Option value='forbidden'>Locked</NativeSelect.Option>
														<NativeSelect.Indicator />
													</NativeSelect.Trigger>
												</NativeSelect>
											</div>
											{stage === "processing" && failure === "required" && (
												<NativeSelect variant='secondary' fullWidth>
													<Label>Required failure outcome</Label>
													<NativeSelect.Trigger aria-label='Middleware required failure outcome' value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
														<NativeSelect.Option value='retry'>Retry</NativeSelect.Option>
														<NativeSelect.Option value='fail'>Terminal failure</NativeSelect.Option>
														<NativeSelect.Indicator />
													</NativeSelect.Trigger>
												</NativeSelect>
											)}
											{editingBinding && (
												<Checkbox isSelected={enabled} onChange={setEnabled}>
													<Checkbox.Content>
														<Checkbox.Control>
															<Checkbox.Indicator />
														</Checkbox.Control>
														<span>Enabled for new publications</span>
													</Checkbox.Content>
												</Checkbox>
											)}
										</>
									)}
									{tab === "middleware" && origin && <p className='text-muted text-sm'>Local override of {origin.slice(0, 8)}. The parent stays unchanged; this copy replaces it when an affected route is published.</p>}
									<div className='flex flex-wrap justify-end gap-2'>
										{tab === "middleware" && (
											<HelperImportPicker
												scope={scope.type === "endpoint" ? { type: "project", id: endpointScope!.projectId } : { type: scope.type, id: scope.id }}
												body={body}
												disabled={busy || !canEdit}
												onImport={(next, name, id) => {
													setBody(next);
													setSharedBindings((previous) => ({ ...previous, [name]: id }));
												}}
											/>
										)}
										<ScriptingGuide />
									</div>
									<CodeEditor
										label={tab === "modules" ? "Shared helper code" : "Middleware code"}
										value={body}
										bindings={sharedBindings}
										helperScope={tab !== "middleware" ? undefined : scope.type === "endpoint" ? (endpointScope ? { type: "project", id: endpointScope.projectId } : undefined) : { type: scope.type, id: scope.id }}
										onSave={!busy && canEdit && (tab === "modules" || canPublish) ? () => (document.getElementById("code-editor-form") as HTMLFormElement | null)?.requestSubmit() : undefined}
										onChange={setBody}
										readOnly={busy || !canEdit || (tab === "middleware" && !canPublish)}
									/>
								</Form>
							</Modal.Body>
							<Modal.Footer className='shrink-0'>
								{" "}
								{canEdit && (tab === "modules" || canPublish) && (
									<Button type='submit' form='code-editor-form' isDisabled={busy}>
										<IconCheck size={16} />
										{busy ? "Saving…" : tab === "modules" ? "Save helper version" : "Save middleware"}
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
