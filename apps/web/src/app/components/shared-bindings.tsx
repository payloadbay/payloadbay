"use client";

import { useFeedbackToast } from "@lib/feedback";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card } from "@heroui/react";
import { IconCode, IconX } from "@tabler/icons-react";
import { api } from "@lib/api-client";

type Version = { id: string; name: string; scope: { type: string; id: string } };

type SharedBindingsProps = {
	projectId: string;
	bindings: Record<string, string>;
	onChange: (bindings: Record<string, string>) => void;
	disabled: boolean;
};

export function SharedBindings({ projectId, bindings, onChange, disabled }: SharedBindingsProps) {
	const [versions, setVersions] = useState<Version[]>([]);
	const [alias, setAlias] = useState("Helpers");
	const [selected, setSelected] = useState("");
	const [error, setError] = useState("");

	useFeedbackToast(error, "", { error: "Shared bindings error", success: "Success" });

	const fetchData = useCallback(() => api<Version[]>("/shared-code?scopeType=project&scopeId=" + projectId), [projectId]);

	useEffect(() => {
		let active = true;
		fetchData().then(
			(data) => {
				if (active) setVersions(data);
			},
			(cause) => {
				if (active) setError(cause instanceof Error ? cause.message : "Shared code unavailable");
			},
		);

		return () => {
			active = false;
		};
	}, [fetchData]);

	function bind(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!/^[A-Za-z_$][\w$]*$/.test(alias) || alias === "ctx" || !selected) {
			setError("Choose an identifier and a helper version.");

			return;
		}

		onChange({ ...bindings, [alias]: selected });
		setError("");
	}

	return (
		<Card>
			<Card.Header>
				<h3 className='flex items-center gap-2 font-semibold'>
					<IconCode size={18} />
					Shared helper imports
				</h3>
				<Card.Description>Bind exact versions. Imports are generated above the fixed signature.</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-3'>
				<ul className='flex flex-col gap-2'>
					{Object.entries(bindings).map(([name, id]) => (
						<li key={name} className='border-border flex items-center justify-between rounded-lg border p-2 text-sm'>
							<code>
								{name} · {id.slice(0, 8)}
							</code>
							{!disabled && (
								<Button
									size='sm'
									variant='ghost'
									aria-label={"Remove helper binding " + name}
									onPress={() => {
										const next = { ...bindings };
										delete next[name];
										onChange(next);
									}}
								>
									<IconX size={16} />
								</Button>
							)}
						</li>
					))}
				</ul>
				{!disabled && (
					<form onSubmit={bind} className='flex flex-wrap gap-3'>
						<label className='flex min-w-32 flex-1 flex-col gap-1 text-sm'>
							Import name
							<input aria-label='Shared helper import name' value={alias} onChange={(event) => setAlias(event.target.value)} className='border-border bg-field rounded-lg border p-2' />
						</label>
						<label className='flex min-w-48 flex-1 flex-col gap-1 text-sm'>
							Version
							<select aria-label='Shared helper version' value={selected} onChange={(event) => setSelected(event.target.value)} className='border-border bg-field rounded-lg border p-2'>
								<option value=''>Choose a version</option>
								{versions.map((version) => (
									<option key={version.id} value={version.id}>
										{version.name} · {version.scope.type} · {version.id.slice(0, 8)}
									</option>
								))}
							</select>
						</label>
						<Button type='submit' variant='secondary' className='self-end' isDisabled={!selected}>
							Bind helper version
						</Button>
					</form>
				)}
			</Card.Content>
		</Card>
	);
}
