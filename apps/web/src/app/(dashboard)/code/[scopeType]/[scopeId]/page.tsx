"use client";

import { useFeedbackToast } from "@lib/feedback";
import { use, useEffect, useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Form, TextField, Label, Input, FieldError, Tabs } from "@heroui/react";
import { EmptyState, Sheet } from "@heroui-pro/react";
import { IconCode, IconPlus, IconCopy, IconLock, IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { CodeEditor } from "@components/code-editor";
import { api, ApiFailure } from "@lib/api-client";
import { useDashboard } from "@components/dashboard-shell";
import type { Permission } from "@contracts/permissions";
import type { CompilationDiagnostic } from "@contracts/compilation";

type Scope = { type: "instance" | "workspace" | "project" | "endpoint"; id: string };
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

export default function CodePage({ params }: { params: Promise<{ scopeType: string; scopeId: string }> }) {
	const { scopeType, scopeId } = use(params);

	const { me, workspaces, projects } = useDashboard();

	const router = useRouter();

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
		...workspaces.filter((scope) => scope.permissions.includes("code.read")).map((scope) => ({ type: "workspace", ...scope })),
		...projects.filter((scope) => scope.permissions.includes("code.read")).map((scope) => ({ type: "project", ...scope })),
	];
	const selectedScope = scopes.find((scope) => scope.type === scopeType && scope.id === scopeId);
	const valid = ["instance", "workspace", "project", "endpoint"].includes(scopeType);
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
		setBody(tab === "modules" ? "export function example(value: string) {\n  return value;\n}" : "return ctx.continue();");
		setStage("processing");
		setPosition("0");
		setFailure("required");
		setOverride("allowed");
		setAction("retry");
		setEnabled(true);
		setDiagnostics([]);
		setError("");
		setOpen(true);
	}

	async function editModule(module: Module) {
		try {
			const full = await api<Module & { source: string }>("/shared-code/" + module.id);
			setEditingModule(full);
			setEditingBinding(null);
			setName(full.name);
			setBody(full.source);
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
			if (tab === "modules") {
				await api("/shared-code", {
					method: "POST",
					json: {
						scope,
						name,
						source: body,
						...(editingModule ? { originRevisionId: editingModule.id } : {}),
					},
				});
				setNotice("Saved a new immutable helper version. Bind it to a route and publish to use it.");
			} else {
				const value = {
					name,
					body,
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
	if (loading) return <p role='status'>Loading code…</p>;

	return (
		<section className='flex flex-col gap-6'>
			<header className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<Link href='/dashboard' className='text-accent mb-3 flex items-center gap-2 text-sm'>
						<IconArrowLeft size={16} />
						Projects
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

			<label className='flex max-w-lg flex-col gap-2 text-sm'>
				Code scope
				<select
					aria-label='Code scope'
					value={scopeType + ":" + scopeId}
					onChange={(event) => {
						const [type, id] = event.target.value.split(":");
						setOpen(false);
						setLoading(true);
						setModules([]);
						setBindings([]);
						setNotice("");
						setError("");
						router.push("/code/" + type + "/" + id);
					}}
					className='border-border bg-field rounded-lg border p-3'
				>
					{scopeType === "endpoint" && <option value={"endpoint:" + scopeId}>Ingress route · {endpointScope?.name}</option>}
					{scopes.map((scope) => (
						<option key={scope.type + ":" + scope.id} value={scope.type + ":" + scope.id}>
							{scope.type} · {scope.name}
						</option>
					))}
				</select>
			</label>
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
						bindings.map((binding) => (
							<Card key={binding.id} role='group' aria-label={"Middleware " + binding.name}>
								<Card.Content className='flex flex-wrap items-center justify-between gap-4'>
									<div>
										<h2 className='flex items-center gap-2 font-semibold'>
											{!binding.editable && <IconLock size={16} />} {binding.name}
										</h2>
										<p className='text-muted mt-1 text-sm'>
											{binding.scope.type} · {scopes.find((parent) => parent.type === binding.scope.type && parent.id === binding.scope.id)?.name ?? binding.scope.id.slice(0, 8)} · {binding.stage} · position {binding.position} · {binding.failurePolicy} · {binding.enabled ? "enabled" : "disabled"} · version {binding.version}
										</p>
										{binding.originBindingId && <p className='text-muted mt-1 text-xs'>Local replacement of {binding.originBindingId.slice(0, 8)}</p>}
									</div>
									{binding.editable ? (
										<Button size='sm' variant='secondary' onPress={() => void editBinding(binding)}>
											Edit middleware
										</Button>
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
								</Card.Content>
							</Card>
						))
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
			<Sheet
				isOpen={open}
				onOpenChange={(next) => {
					if (!busy) setOpen(next);
				}}
			>
				<Sheet.Backdrop>
					<Sheet.Content>
						<Sheet.Dialog>
							<Sheet.CloseTrigger />
							<Sheet.Header>
								<Sheet.Heading>{tab === "modules" ? "Shared helper source" : "Middleware configuration"}</Sheet.Heading>
							</Sheet.Header>
							<Sheet.Body>
								<Form className='flex flex-col gap-4' onSubmit={save}>
									{diagnostics.map((diagnostic, index) => (
										<p key={index} role='alert' className='text-danger font-mono text-xs'>
											{diagnostic.sourceId}:{diagnostic.line}:{diagnostic.column} — {diagnostic.message}
										</p>
									))}
									<TextField isRequired value={name} onChange={setName} maxLength={100} isDisabled={busy || !canEdit}>
										<Label>{tab === "modules" ? "Helper name" : "Middleware name"}</Label>
										<Input />
										<FieldError />
									</TextField>
									{tab === "middleware" && (
										<>
											<label className='flex flex-col gap-2 text-sm'>
												Stage
												<select aria-label='Middleware stage' value={stage} onChange={(event) => setStage(event.target.value as typeof stage)} disabled={busy || Boolean(editingBinding)} className='border-border bg-field rounded-lg border p-2'>
													<option value='ingress'>Ingress</option>
													<option value='processing'>Processing</option>
												</select>
											</label>
											<label className='flex flex-col gap-2 text-sm'>
												Position
												<input aria-label='Middleware position' type='number' min={0} max={10000} value={position} onChange={(event) => setPosition(event.target.value)} className='border-border bg-field rounded-lg border p-2' />
											</label>
											<div className='grid gap-3 sm:grid-cols-2'>
												<label className='flex flex-col gap-2 text-sm'>
													Failure behavior
													<select aria-label='Middleware failure behavior' value={failure} onChange={(event) => setFailure(event.target.value as typeof failure)} className='border-border bg-field rounded-lg border p-2'>
														<option value='required'>Required</option>
														<option value='optional'>Optional</option>
													</select>
												</label>
												<label className='flex flex-col gap-2 text-sm'>
													Child overrides
													<select aria-label='Middleware child overrides' value={override} onChange={(event) => setOverride(event.target.value as typeof override)} className='border-border bg-field rounded-lg border p-2'>
														<option value='allowed'>Allowed</option>
														<option value='forbidden'>Locked</option>
													</select>
												</label>
											</div>
											{stage === "processing" && failure === "required" && (
												<label className='flex flex-col gap-2 text-sm'>
													Required failure outcome
													<select aria-label='Middleware required failure outcome' value={action} onChange={(event) => setAction(event.target.value as typeof action)} className='border-border bg-field rounded-lg border p-2'>
														<option value='retry'>Retry</option>
														<option value='fail'>Terminal failure</option>
													</select>
												</label>
											)}
											{editingBinding && (
												<label className='flex items-center gap-2 text-sm'>
													<input type='checkbox' checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
													Enabled for new publications
												</label>
											)}
											<pre aria-label='Middleware fixed signature' className='border-border bg-field rounded-lg border p-3 font-mono text-xs'>
												async function middleware(ctx: {stage === "ingress" ? "IngressMiddlewareContext" : "ProcessingMiddlewareContext"})
											</pre>
										</>
									)}
									{tab === "middleware" && origin && <p className='text-muted text-sm'>Local override of {origin.slice(0, 8)}. The parent stays unchanged; this copy replaces it when an affected route is published.</p>}
									<CodeEditor label={tab === "modules" ? "Shared helper code" : "Middleware code"} value={body} onChange={setBody} readOnly={busy || !canEdit || (tab === "middleware" && !canPublish)} />
									{canEdit && (tab === "modules" || canPublish) && (
										<Button type='submit' isDisabled={busy}>
											<IconCheck size={16} />
											{busy ? "Saving…" : tab === "modules" ? "Save helper version" : "Save middleware"}
										</Button>
									)}
								</Form>
							</Sheet.Body>
						</Sheet.Dialog>
					</Sheet.Content>
				</Sheet.Backdrop>
			</Sheet>
		</section>
	);
}
