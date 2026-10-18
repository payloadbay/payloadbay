type VisibleHelper = {
	id: string;
	name: string;
	scope: { type: string };
	createdAt?: string;
};

/** Nearest visible scope, then newest revision, with immutable draft pins taking precedence. */
export function helperModuleBindings(available: VisibleHelper[], pinned: Record<string, string> = {}) {
	const ranks: Record<string, number> = {
		instance: 0,
		organization: 1,
		workspace: 2,
		project: 3,
	};
	const modules = new Map<string, string>();
	const sorted = [...available].sort((a, b) => (ranks[b.scope.type] ?? -1) - (ranks[a.scope.type] ?? -1) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id));
	for (const helper of sorted) if (!modules.has(helper.name)) modules.set(helper.name, helper.id);
	for (const [name, id] of Object.entries(pinned)) modules.set(name, id);

	return modules;
}
