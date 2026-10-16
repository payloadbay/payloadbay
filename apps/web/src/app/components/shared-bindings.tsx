"use client";

import Link from "next/link";
import { useFeedbackToast } from "@lib/feedback";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, TextField, Input, Label, FieldError, Table } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";
import { IconLibrary, IconX } from "@tabler/icons-react";
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
					<IconLibrary size={18} />
					Shared helper imports
				</h3>
				<Card.Description>
					Bind a saved helper version. Its visible import is added to the script from <code>@shared/ImportName</code>.{" "}
					<Link className='text-accent underline' href={"/code/project/" + projectId}>
						Create or edit helper files
					</Link>
					.
				</Card.Description>
			</Card.Header>
			<Card.Content className='flex flex-col gap-3'>
				{Object.keys(bindings).length ? (
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Helper imports'>
								<Table.Header>
									<Table.Column isRowHeader>Import</Table.Column>
									<Table.Column>Helper</Table.Column>
									<Table.Column aria-label='Actions' />
								</Table.Header>
								<Table.Body>
									{Object.entries(bindings).map(([name, id]) => (
										<Table.Row key={name} id={name}>
											<Table.Cell>
												<code className='break-all text-xs'>
													import * as {name} from &quot;@shared/{name}&quot;;
												</code>
											</Table.Cell>
											<Table.Cell>{versions.find((item) => item.id === id)?.name ?? "Unavailable version"}</Table.Cell>
											<Table.Cell>
												{!disabled && (
													<Button
														isIconOnly
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
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
				) : (
					<p className='text-muted text-sm'>No helper imports. Your script can define its own functions directly.</p>
				)}

				{!disabled && (
					<Form onSubmit={bind} className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
						<TextField isRequired value={alias} onChange={setAlias} pattern='[A-Za-z_$][A-Za-z0-9_$]*'>
							<Label>Import name</Label>
							<Input aria-label='Shared helper import name' variant='secondary' />
							<FieldError />
						</TextField>
						<NativeSelect variant='secondary' className='min-w-0 w-full sm:w-auto'>
							<Label>Helper version</Label>
							<NativeSelect.Trigger aria-label='Shared helper version' value={selected} onChange={(event) => setSelected(event.target.value)}>
								<NativeSelect.Option value=''>Choose a version</NativeSelect.Option>
								{versions.map((version) => (
									<NativeSelect.Option key={version.id} value={version.id}>
										{version.name} · {version.scope.type} · {version.id.slice(0, 8)}
									</NativeSelect.Option>
								))}
								<NativeSelect.Indicator />
							</NativeSelect.Trigger>
						</NativeSelect>
						<Button type='submit' variant='secondary' isDisabled={!selected}>
							Add import
						</Button>
					</Form>
				)}
			</Card.Content>
		</Card>
	);
}
