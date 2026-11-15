"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Checkbox, SearchField, Table } from "@heroui/react";
import { IconGripVertical, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@heroui/react";
import { useDragAndDrop, type Selection, type SortDescriptor } from "react-aria-components";
import { Virtualizer, TableLayout } from "react-aria-components/Virtualizer";
import "./catalog.css";

export type DataGridColumn<T> = {
	key: keyof T & string;
	label: string;
	render?: (row: T) => ReactNode;
	sortValue?: (row: T) => string | number;
	isSortable?: boolean;
	pinned?: "start" | "end";
	width?: number;
};

export type DataGridProps<T extends { id: string }> = {
	label: string;
	rows: T[];
	columns: DataGridColumn<T>[];
	selectionMode?: "none" | "single" | "multiple";
	selectedKeys?: Selection;
	onSelectionChange?: (keys: Selection) => void;
	onRowAction?: (id: string) => void;
	searchable?: boolean;
	virtualized?: boolean;
	height?: number;
	rowHeight?: number;
	onLoadMore?: () => void;
	getChildren?: (row: T) => T[] | undefined;
	defaultExpandedKeys?: string[];
	treeColumn?: keyof T & string;
	isLoading?: boolean;
	onReorder?: (ids: string[], target: string, position: "before" | "after" | "on") => void;
};

function SelectionCheckbox() {
	return (
		<Checkbox slot='selection' variant='secondary'>
			<Checkbox.Content>
				<Checkbox.Control>
					<Checkbox.Indicator />
				</Checkbox.Control>
			</Checkbox.Content>
		</Checkbox>
	);
}

export function DataGrid<T extends { id: string }>({ label, rows, columns, selectionMode = "none", selectedKeys, onSelectionChange, onRowAction, searchable = true, virtualized = false, height = 320, rowHeight = 48, onLoadMore, isLoading = false, onReorder, getChildren, defaultExpandedKeys, treeColumn = columns[0]?.key }: DataGridProps<T>) {
	const root = useRef<HTMLDivElement>(null);
	const [offsets, setOffsets] = useState<Record<string, number>>({});

	const { dragAndDropHooks } = useDragAndDrop({
		getItems: onReorder ? (keys) => [...keys].map((key) => ({ "text/plain": String(key) })) : undefined,
		onReorder: onReorder ? (event) => onReorder([...event.keys].map(String), String(event.target.key), event.target.dropPosition) : undefined,
	});

	useEffect(() => {
		const element = root.current;
		if (!element || !columns.some((column) => column.pinned)) return;
		const headers = [...element.querySelectorAll<HTMLElement>("[data-grid-column]")];

		function measure() {
			const next: Record<string, number> = {};
			for (const side of ["start", "end"] as const) {
				let offset = side === "start" ? (selectionMode !== "none" ? 40 : 0) + (onReorder ? 40 : 0) : 0;
				for (const column of side === "end" ? [...columns].reverse() : columns) {
					if (column.pinned !== side) continue;
					next[column.key] = offset;
					offset += headers.find((header) => header.dataset.gridColumn === column.key)?.getBoundingClientRect().width ?? column.width ?? 80;
				}
			}

			setOffsets((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
		}

		const observer = new ResizeObserver(measure);
		headers.forEach((header) => observer.observe(header));
		measure();

		return () => observer.disconnect();
	}, [columns, selectionMode, onReorder]);

	function pinnedStyle(column: DataGridColumn<T>): CSSProperties | undefined {
		return column.pinned
			? {
					position: "sticky",
					[column.pinned === "start" ? "insetInlineStart" : "insetInlineEnd"]: offsets[column.key] ?? 0,
					zIndex: 2,
					background: "var(--surface)",
				}
			: undefined;
	}

	const [query, setQuery] = useState("");
	const [selection, setSelection] = useState<Selection>(new Set());
	const [sort, setSort] = useState<SortDescriptor>();

	const visible = useMemo(() => {
		const result = rows.filter(
			(row) =>
				!searchable ||
				!query ||
				columns.some((column) =>
					String(column.sortValue?.(row) ?? row[column.key])
						.toLocaleLowerCase()
						.includes(query.toLocaleLowerCase()),
				),
		);
		const column = columns.find((entry) => entry.key === sort?.column);
		if (column && sort)
			result.sort((a, b) => {
				const left = column.sortValue?.(a) ?? a[column.key];
				const right = column.sortValue?.(b) ?? b[column.key];
				const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });

				return sort.direction === "descending" ? -comparison : comparison;
			});

		return result;
	}, [rows, columns, query, sort, searchable]);

	function renderRow(row: T): ReactNode {
		const children = getChildren?.(row) ?? [];

		return (
			<Table.Row id={row.id} key={row.id} hasChildItems={children.length > 0 || undefined}>
				{onReorder && (
					<Table.Cell>
						<Button slot='drag' isIconOnly size='sm' variant='ghost' aria-label={`Reorder ${row.id}`}>
							<IconGripVertical size={14} />
						</Button>
					</Table.Cell>
				)}
				{selectionMode !== "none" && (
					<Table.Cell>
						<SelectionCheckbox />
					</Table.Cell>
				)}
				{columns.map((column) => (
					<Table.Cell key={column.key} style={pinnedStyle(column)}>
						{({ isExpanded, level }) => (
							<div className='flex items-center gap-1' style={getChildren && column.key === treeColumn ? { paddingInlineStart: (level - 1) * 16 } : undefined}>
								{getChildren &&
									column.key === treeColumn &&
									(children.length ? (
										<Button slot='chevron' isIconOnly size='sm' variant='ghost' aria-label={`${isExpanded ? "Collapse" : "Expand"} ${String(row[column.key])}`}>
											<IconChevronRight size={14} className={isExpanded ? "rotate-90" : ""} />
										</Button>
									) : (
										<span className='w-7 shrink-0' />
									))}
								{column.render ? column.render(row) : String(row[column.key] ?? "")}
							</div>
						)}
					</Table.Cell>
				))}
				{children.length > 0 && <Table.Collection items={children}>{renderRow}</Table.Collection>}
			</Table.Row>
		);
	}

	return (
		<div className='pb-data-grid' ref={root}>
			{searchable && (
				<SearchField aria-label={`Search ${label}`} value={query} onChange={setQuery} variant='secondary'>
					<SearchField.Group>
						<SearchField.SearchIcon />
						<SearchField.Input placeholder='Search rows…' />
						<SearchField.ClearButton aria-label='Clear search' />
					</SearchField.Group>
				</SearchField>
			)}
			<Table>
				<Table.ScrollContainer style={virtualized ? { height, overflow: "auto" } : undefined}>
					<Table.ResizableContainer className='overflow-x-auto'>
						<GridViewport virtualized={virtualized} rowHeight={rowHeight}>
							<Table.Content
								dragAndDropHooks={onReorder ? dragAndDropHooks : undefined}
								defaultExpandedKeys={getChildren ? defaultExpandedKeys : undefined}
								aria-label={label}
								selectionMode={selectionMode}
								selectedKeys={selectedKeys ?? selection}
								onSelectionChange={(keys) => {
									setSelection(keys);
									onSelectionChange?.(keys);
								}}
								sortDescriptor={sort}
								onSortChange={setSort}
								onRowAction={onRowAction ? (key) => onRowAction(String(key)) : undefined}
							>
								<Table.Header>
									{onReorder && (
										<Table.Column width={40} minWidth={40} maxWidth={40}>
											<span className='sr-only'>Reorder</span>
										</Table.Column>
									)}
									{selectionMode !== "none" && (
										<Table.Column width={40} minWidth={40} maxWidth={40}>
											{selectionMode === "multiple" ? <SelectionCheckbox /> : <span className='sr-only'>Select row</span>}
										</Table.Column>
									)}
									{columns.map((column, index) => (
										<Table.Column id={column.key} key={column.key} isRowHeader={index === 0} allowsSorting={column.isSortable !== false} minWidth={80} width={column.width} data-grid-column={column.key} style={pinnedStyle(column)}>
											{({ sortDirection }) => (
												<>
													<Table.SortableColumnHeader sortDirection={sortDirection}>{column.label}</Table.SortableColumnHeader>
													<Table.ColumnResizer aria-label={`Resize ${column.label}`} />
												</>
											)}
										</Table.Column>
									))}
								</Table.Header>
								<Table.Body renderEmptyState={() => <div className='p-8 text-center text-sm text-muted'>{query ? "No matching rows" : "No rows yet"}</div>}>{visible.map(renderRow)}</Table.Body>
							</Table.Content>
						</GridViewport>
					</Table.ResizableContainer>
				</Table.ScrollContainer>
				<Table.Footer>
					{onLoadMore && (
						<Button size='sm' variant='secondary' isDisabled={isLoading} onPress={onLoadMore}>
							{isLoading ? "Loading…" : "Load more"}
						</Button>
					)}
					<span className='text-xs text-muted'>
						{visible.length} of {rows.length} rows
					</span>
				</Table.Footer>
			</Table>
		</div>
	);
}

function GridViewport({ virtualized, rowHeight, children }: { virtualized: boolean; rowHeight: number; children: ReactNode }) {
	return virtualized ? (
		<Virtualizer layout={TableLayout} layoutOptions={{ rowHeight, headingHeight: 44 }}>
			{children}
		</Virtualizer>
	) : (
		children
	);
}
