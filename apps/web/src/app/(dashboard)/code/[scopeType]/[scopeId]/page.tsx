"use client";

import { LoadingState } from "@components/loading-state";
import { useFeedbackToast } from "@lib/feedback";
import { use, useEffect, useCallback, useState, useRef, type PointerEvent, type FormEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useDragAndDrop } from "react-aria-components";
import { Button, Form, TextField, Label, Input, FieldError, Tabs, NumberField, Checkbox, Table, Modal, Select, ListBox } from "@heroui/react";
import { ResourceEmptyState } from "@components/ui/resource-empty-state";
import { IconCode, IconPlus, IconCopy, IconLock, IconArrowLeft, IconCheck, IconGripVertical, IconArrowUp, IconArrowDown, IconPencil, IconInfoCircle } from "@tabler/icons-react";
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

	const { organizations, workspaces, projects } = useDashboard();

	const scopes = [...organizations.filter((scope) => scope.permissions.includes("code.read")).map((scope) => ({ type: "organization", ...scope })), ...workspaces.filter((scope) => scope.permissions.includes("code.read")).map((scope) => ({ type: "workspace", ...scope })), ...projects.filter((scope) => scope.permissions.includes("code.read")).map((scope) => ({ type: "project", ...scope }))];
	const selectedScope = scopes.find((scope) => scope.type === scopeType && scope.id === scopeId);
	const valid = ["organization", "workspace", "project", "endpoint"].includes(scopeType);
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
	const touchOrder = useRef<{
		pointer: number;
		source: string;
		x: number;
		y: number;
		active: boolean;
		target: string | null;
		after: boolean;
	} | null>(null);
	const [touchVisual, setTouchVisual] = useState<{ source: string; target: string | null } | null>(null);

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

	function placeMiddleware(keys: ReadonlySet<string | number>, targetId: string, after: boolean) {
		const target = bindings.find((item) => item.id === targetId);
		const moved = bindings.filter((item) => keys.has(item.id));
		if (!target?.editable || !moved.length || moved.some((item) => !item.editable || item.stage !== target.stage)) return;
		const items = bindings.filter((item) => item.editable && item.stage === target.stage && !keys.has(item.id));
		const index = items.findIndex((item) => item.id === target.id);
		if (index < 0) return;
		items.splice(index + (after ? 1 : 0), 0, ...moved);
		void reorder(items);
	}

	// Pointer gestures start only on the handle; React Aria retains keyboard ordering.
	function startTouchOrder(event: PointerEvent<HTMLSpanElement>, binding: Binding) {
		if ((event.pointerType !== "touch" && event.button !== 0) || busy || !canEdit || !canPublish || !binding.editable) return;
		event.preventDefault();
		event.stopPropagation();
		event.currentTarget.querySelector("button")?.focus({ preventScroll: true });
		event.currentTarget.setPointerCapture(event.pointerId);
		touchOrder.current = {
			pointer: event.pointerId,
			source: binding.id,
			x: event.clientX,
			y: event.clientY,
			active: false,
			target: null,
			after: false,
		};
	}

	function moveTouchOrder(event: PointerEvent<HTMLSpanElement>) {
		const drag = touchOrder.current;
		if (!drag || drag.pointer !== event.pointerId) return;
		if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
		event.preventDefault();
		drag.active = true;
		const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-middleware-id]");
		const target = bindings.find((item) => item.id === row?.dataset.middlewareId);
		const source = bindings.find((item) => item.id === drag.source);
		drag.target = target?.editable && target.id !== drag.source && target.stage === source?.stage ? target.id : null;
		drag.after = Boolean(row && event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);
		setTouchVisual({ source: drag.source, target: drag.target });
	}

	function endTouchOrder(event: PointerEvent<HTMLSpanElement>, cancelled = false) {
		const drag = touchOrder.current;
		if (!drag || drag.pointer !== event.pointerId) return;
		touchOrder.current = null;
		setTouchVisual(null);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
		if (!cancelled && drag.active && drag.target) {
			event.preventDefault();
			placeMiddleware(new Set([drag.source]), drag.target, drag.after);
		}
	}

	const { dragAndDropHooks } = useDragAndDrop({
		isDisabled: busy || !canEdit || !canPublish,
		getItems: (keys) => [...keys].filter((key) => bindings.some((item) => item.id === key && item.editable)).map((key) => ({ "text/plain": String(key) })),
		onReorder: (event) => placeMiddleware(event.keys, String(event.target.key), event.target.dropPosition === "after"),
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

	if (!valid) notFound();
	if (loading) return <LoadingState label='Loading code…' size='page' />;

	return (
		<section className='flex flex-col gap-6'>
			{unsavedDialog}
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<Link href={scopeType === "project" ? "/projects/" + scopeId : scopeType === "organization" ? "/organizations/" + scopeId : scopeType === "workspace" ? "/workspaces/" + scopeId : scopeType === "endpoint" && endpointScope ? "/projects/" + endpointScope.projectId + "/routes/" + scopeId : "/"} className='button button--secondary w-fit'>
						<IconArrowLeft size={16} />
						{scopeType === "project" ? "Back to project" : scopeType === "organization" ? "Back to organization" : scopeType === "workspace" ? "Back to workspace" : scopeType === "endpoint" ? "Back to ingress route" : "Back to overview"}
					</Link>
					<p className='text-muted text-sm'>{selectedScope?.name ?? endpointScope?.name ?? "Scope"}</p>
					<h1 className='text-3xl font-semibold'>Code and middleware</h1>
					<p className='text-muted mt-2'>Manage shared helpers and middleware.</p>
				</div>
				{canEdit && ((tab === "modules" && scopeType !== "endpoint") || (tab === "middleware" && canPublish)) && (
					<Button onPress={start}>
						<IconPlus size={18} />
						{tab === "modules" ? "Create helper" : "Create middleware"}
					</Button>
				)}
			</header>

			{scopeType !== "endpoint" && (
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
			)}
			{tab === "modules" && scopeType !== "endpoint" ? (
				modules.length ? (
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Shared helpers' className='w-full'>
								<Table.Header>
									<Table.Column isRowHeader>Helper</Table.Column>
									<Table.Column>Source</Table.Column>
									<Table.Column>Revision</Table.Column>
									<Table.Column className='text-right'>Actions</Table.Column>
								</Table.Header>
								<Table.Body>
									{modules.map((module) => (
										<Table.Row id={module.id} key={module.id}>
											<Table.Cell>
												<strong>{module.name}</strong>
											</Table.Cell>
											<Table.Cell>
												{module.scope.type}
												{module.originRevisionId ? " (copy)" : ""}
											</Table.Cell>
											<Table.Cell>
												<code>{module.id.slice(0, 8)}</code>
												<p className='text-muted text-xs'>{new Date(module.createdAt).toLocaleString()}</p>
											</Table.Cell>
											<Table.Cell className='text-right [&>div]:justify-end'>
												<div className='flex justify-end gap-2'>
													<Button isIconOnly aria-label={canEdit ? (module.scope.id === scopeId ? "Edit as new version" : "Edit local copy") : "View source"} size='sm' variant='ghost' onPress={() => void editModule(module)}>
														<IconPencil size={18} />
													</Button>
													{canEdit && (
														<Button isIconOnly aria-label={"Copy helper " + module.name} size='sm' variant='ghost' isDisabled={busy} onPress={() => void copy(module)}>
															<IconCopy size={18} />
														</Button>
													)}
												</div>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				) : (
					<ResourceEmptyState
						className='border-border rounded-xl border border-dashed py-12'
						title={<>No helpers available here</>}
						description={<>Helpers from this organization and its parent customer scopes appear here. Create a helper, then import its version in a script.</>}
						icon={
							<>
								<IconCode />
							</>
						}
					/>
				)
			) : (
				<div className='flex flex-col gap-3'>
					<Modal>
						<Button variant='ghost' size='sm' className='self-start'>
							<IconInfoCircle size={18} aria-hidden='true' />
							Middleware guide
						</Button>
						<Modal.Backdrop>
							<Modal.Container placement='auto' size='lg'>
								<Modal.Dialog>
									<Modal.CloseTrigger />
									<Modal.Header>
										<Modal.Heading>Middleware execution order</Modal.Heading>
									</Modal.Header>
									<Modal.Body className='flex flex-col gap-3'>
										<p>Customer routes inherit middleware from their organization, workspace and project, followed by route middleware. Instance middleware stays separate from customer routes.</p>
										<p>Entries run in table order within each level and lifecycle stage. Required failures stop the chain; optional failures continue with the last valid context.</p>
										<p>Drag a handle to change the local order. You can also use the up and down actions, or focus the handle and press Enter to begin keyboard reordering.</p>
										<p>Inherited entries are managed in their parent. Save changes and publish affected routes to activate the new order.</p>
									</Modal.Body>
									<Modal.Footer>
										<Button slot='close'>Got it</Button>
									</Modal.Footer>
								</Modal.Dialog>
							</Modal.Container>
						</Modal.Backdrop>
					</Modal>
					{bindings.length ? (
						<Table>
							<div
								onDragStartCapture={(event) => {
									event.preventDefault();
								}}
							>
								<Table.ScrollContainer>
									<Table.Content aria-label='Middleware execution order' dragAndDropHooks={dragAndDropHooks}>
										<Table.Header>
											<Table.Column aria-label='Order' className='w-12' />
											<Table.Column isRowHeader>Middleware</Table.Column>
											<Table.Column>Stage and scope</Table.Column>
											<Table.Column className='text-right'>Actions</Table.Column>
										</Table.Header>
										<Table.Body items={bindings} dependencies={[touchVisual, busy, canEdit, canPublish]}>
											{(binding) => (
												<Table.Row id={binding.id} data-middleware-id={binding.id} className={touchVisual?.source === binding.id ? "opacity-50" : touchVisual?.target === binding.id ? "outline-2 outline-accent outline" : undefined}>
													<Table.Cell>
														{binding.editable ? (
															<span
																data-drag-handle
																className='inline-flex touch-none cursor-grab active:cursor-grabbing'
																onPointerDownCapture={(event) => startTouchOrder(event, binding)}
																onPointerMoveCapture={moveTouchOrder}
																onPointerUpCapture={(event) => endTouchOrder(event)}
																onPointerCancelCapture={(event) => endTouchOrder(event, true)}
																onDragStartCapture={(event) => {
																	if (touchOrder.current) event.preventDefault();
																}}
															>
																<Button slot='drag' isIconOnly className='touch-none cursor-grab select-none active:cursor-grabbing' aria-description='Drag to reorder; up and down actions are also available' size='sm' variant='ghost' aria-label={"Drag " + binding.name} isDisabled={busy}>
																	<IconGripVertical size={16} />
																</Button>
															</span>
														) : (
															<IconLock size={16} aria-label='Inherited' />
														)}
													</Table.Cell>
													<Table.Cell>
														<h2 className='font-semibold'>{binding.name}</h2>
														<p className='text-muted text-xs'>
															{binding.failurePolicy} / {binding.enabled ? "enabled" : "disabled"} / version {binding.version}
														</p>
														{binding.originBindingId && <p className='text-muted text-xs'>Local replacement</p>}
													</Table.Cell>
													<Table.Cell>
														{binding.stage}
														<p className='text-muted text-xs'>
															{binding.scope.type} / {scopes.find((parent) => parent.type === binding.scope.type && parent.id === binding.scope.id)?.name ?? binding.scope.id.slice(0, 8)} / position {binding.position}
														</p>
													</Table.Cell>
													<Table.Cell className='text-right [&>div]:justify-end'>
														{binding.editable ? (
															<div className='flex items-center justify-end gap-2'>
																<Button size='sm' variant='ghost' isIconOnly aria-label={"Edit middleware " + binding.name} aria-description='Edit middleware' onPress={() => void editBinding(binding)}>
																	<IconPencil size={18} aria-hidden='true' />
																</Button>
																<Button size='sm' variant='ghost' isIconOnly aria-label={"Move " + binding.name + " up"} isDisabled={busy || bindings.filter((item) => item.editable && item.stage === binding.stage)[0]?.id === binding.id} onPress={() => move(binding, -1)}>
																	<IconArrowUp size={16} />
																</Button>
																<Button size='sm' variant='ghost' isIconOnly aria-label={"Move " + binding.name + " down"} isDisabled={busy || bindings.filter((item) => item.editable && item.stage === binding.stage).at(-1)?.id === binding.id} onPress={() => move(binding, 1)}>
																	<IconArrowDown size={16} />
																</Button>
															</div>
														) : (
															<div className='flex flex-col gap-2'>
																<span className='text-muted text-sm'>Inherited / {binding.overridePolicy === "forbidden" ? "overrides locked" : "managed in parent scope"}</span>
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
							</div>
						</Table>
					) : (
						<ResourceEmptyState className='border-border rounded-xl border border-dashed py-12' title={<>No middleware yet</>} description={<>Add lifecycle code at this scope. Routes pin the effective chain when published.</>} />
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
											<Select
												variant='secondary'
												fullWidth
												aria-label='Middleware stage'
												value={stage}
												onChange={(key) => {
													const next = String(key ?? "") as typeof stage;
													setBody((current) => (current === middlewareStarter(name, stage) ? middlewareStarter(name, next) : current));
													setStage(next);
												}}
												isDisabled={busy || Boolean(editingBinding)}
											>
												<Label>Stage</Label>
												<Select.Trigger>
													<Select.Value />
													<Select.Indicator />
												</Select.Trigger>
												<Select.Popover>
													<ListBox>
														<ListBox.Item id='ingress'>
															Ingress
															<ListBox.ItemIndicator />
														</ListBox.Item>
														<ListBox.Item id='processing'>
															Processing
															<ListBox.ItemIndicator />
														</ListBox.Item>
													</ListBox>
												</Select.Popover>
											</Select>
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
												<Select variant='secondary' fullWidth aria-label='Middleware failure behavior' value={failure} onChange={(key) => setFailure(String(key ?? "") as typeof failure)}>
													<Label>Failure behavior</Label>
													<Select.Trigger>
														<Select.Value />
														<Select.Indicator />
													</Select.Trigger>
													<Select.Popover>
														<ListBox>
															<ListBox.Item id='required'>
																Required
																<ListBox.ItemIndicator />
															</ListBox.Item>
															<ListBox.Item id='optional'>
																Optional
																<ListBox.ItemIndicator />
															</ListBox.Item>
														</ListBox>
													</Select.Popover>
												</Select>
												<Select variant='secondary' fullWidth aria-label='Middleware child overrides' value={override} onChange={(key) => setOverride(String(key ?? "") as typeof override)}>
													<Label>Child overrides</Label>
													<Select.Trigger>
														<Select.Value />
														<Select.Indicator />
													</Select.Trigger>
													<Select.Popover>
														<ListBox>
															<ListBox.Item id='allowed'>
																Allowed
																<ListBox.ItemIndicator />
															</ListBox.Item>
															<ListBox.Item id='forbidden'>
																Locked
																<ListBox.ItemIndicator />
															</ListBox.Item>
														</ListBox>
													</Select.Popover>
												</Select>
											</div>
											{stage === "processing" && failure === "required" && (
												<Select variant='secondary' fullWidth aria-label='Middleware required failure outcome' value={action} onChange={(key) => setAction(String(key ?? "") as typeof action)}>
													<Label>Required failure outcome</Label>
													<Select.Trigger>
														<Select.Value />
														<Select.Indicator />
													</Select.Trigger>
													<Select.Popover>
														<ListBox>
															<ListBox.Item id='retry'>
																Retry
																<ListBox.ItemIndicator />
															</ListBox.Item>
															<ListBox.Item id='fail'>
																Terminal failure
																<ListBox.ItemIndicator />
															</ListBox.Item>
														</ListBox>
													</Select.Popover>
												</Select>
											)}
											{editingBinding && (
												<Checkbox variant='secondary' isSelected={enabled} onChange={setEnabled}>
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
