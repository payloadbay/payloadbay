import { useState } from "react";
import { Button, Modal, TextField, Label, Input } from "@heroui/react";
import type { AgendaEvent } from "@components/ui/agenda";

export function useCalendarDemo() {
	const today = new Date();

	const at = (hour: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour);

	const [events, setEvents] = useState<AgendaEvent[]>(() => [
		{
			id: "one",
			title: "Review deliveries",
			start: at(9),
			end: at(10),
		},
		{
			id: "two",
			title: "Team sync",
			start: at(9),
			end: at(11),
			color: "var(--success)",
		},
	]);
	const [selected, select] = useState<string | null>(null);
	const [pending, setPending] = useState<AgendaEvent | null>(null);
	const [title, setTitle] = useState("");

	function edit(event?: AgendaEvent) {
		const next = event ?? {
			id: crypto.randomUUID(),
			title: "New event",
			start: at(today.getHours()),
			end: at(today.getHours() + 1),
		};
		setPending(next);
		setTitle(next.title);
	}

	function update(event: AgendaEvent) {
		setEvents((current) => (current.some((item) => item.id === event.id) ? current.map((item) => (item.id === event.id ? event : item)) : [...current, event]));
	}

	function create(start: Date, end = new Date(start.getTime() + 3600_000)) {
		update({
			id: crypto.randomUUID(),
			title: "New event",
			start,
			end,
		});
	}

	const dialog = (
		<Modal.Backdrop
			isOpen={pending !== null}
			onOpenChange={(open) => {
				if (!open) setPending(null);
			}}
		>
			<Modal.Container placement='center'>
				<Modal.Dialog aria-label='Calendar event'>
					<Modal.Header>
						<Modal.Heading>Calendar event</Modal.Heading>
					</Modal.Header>
					<Modal.Body>
						<TextField value={title} onChange={setTitle} variant='secondary' isRequired>
							<Label>Event title</Label>
							<Input autoFocus />
						</TextField>
					</Modal.Body>
					<Modal.Footer>
						<Button variant='secondary' onPress={() => setPending(null)}>
							Cancel
						</Button>
						<Button
							isDisabled={!title.trim()}
							onPress={() => {
								if (pending) {
									update({ ...pending, title: title.trim() });
									setPending(null);
								}
							}}
						>
							Save event
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);

	return {
		events,
		selected,
		select,
		update,
		create,
		edit,
		dialog,
	};
}
