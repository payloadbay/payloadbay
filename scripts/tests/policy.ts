import { resolve } from "node:path";

export function validateInventory(files: string[], owners: Record<string, string>) {
	for (const file of files) if (!owners[file]) throw new Error(`Unowned test: ${file}`);
	for (const file of Object.keys(owners)) if (!files.includes(file)) throw new Error(`Missing test: ${file}`);

	return files;
}

export function selectAffected(changed: string[], files: string[], dependencies: Record<string, string[]>) {
	const selected = new Set<string>();
	if (!changed.length) return files;
	for (const path of changed) {
		const matches = files.filter((file) => file === path || dependencies[file]?.includes(path));
		if (!matches.length) return files;
		for (const file of matches) selected.add(file);
	}

	return files.filter((file) => selected.has(file));
}

export function assertNonemptyRun(runner: string, output: string) {
	const pass = runner === "bun" ? output.match(/(?:^|\n)\s*(\d+) pass(?:\n|\s)/) : output.match(/# pass (\d+)/);
	const fail = runner === "bun" ? output.match(/(?:^|\n)\s*(\d+) fail(?:\n|\s)/) : output.match(/# fail (\d+)/);
	if (!pass || Number(pass[1]) === 0) throw new Error("No passing tests; empty selection is not success");
	if (!fail || Number(fail[1]) !== 0) throw new Error("Failures in test report");

	return Number(pass[1]);
}

export function checkCoverage(lcov: string, required: string[], threshold: number) {
	if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error("Invalid coverage threshold");
	const records = lcov.split("end_of_record").filter((record) => record.includes("SF:"));
	const paths = records.map((record) => resolve(record.match(/SF:(.+)/)![1]));
	for (const file of required) if (!paths.includes(resolve(file))) throw new Error(`Missing coverage: ${file}`);
	let lf = 0;
	let lh = 0;
	let fnf = 0;
	let fnh = 0;
	for (const record of records) {
		const value = (key: string) => Number(record.match(new RegExp(`(?:^|\\n)${key}:(\\d+)`))?.[1] ?? 0);

		lf += value("LF");
		lh += value("LH");
		fnf += value("FNF");
		fnh += value("FNH");
	}

	if (!lf) throw new Error("No line coverage");
	const lines = lh / lf;
	const functions = fnf ? fnh / fnf : 1;
	if (lines < threshold) throw new Error(`Line coverage ${lines} below ${threshold}`);
	if (functions < threshold) throw new Error(`Function coverage ${functions} below ${threshold}`);

	return { lines, functions };
}
