import { useState } from "react";
import { Agenda, type AgendaEvent, type AgendaView } from "@components/ui/agenda";

export function AgendaCallbacks() {
	const [date, setDate] = useState(new Date("2026-10-20T09:00:00Z"));
	const [view, setView] = useState<AgendaView>("day");
	const [events, setEvents] = useState<AgendaEvent[]>([
		{
			id: "review",
			title: "Callback event",
			start: new Date("2026-10-20T09:00:00Z"),
			end: new Date("2026-10-20T10:00:00Z"),
		},
		{
			id: "release",
			title: "All-day release",
			start: new Date("2026-10-20T00:00:00Z"),
			end: new Date("2026-10-22T00:00:00Z"),
			allDay: true,
		},
	]);
	const [selected, setSelected] = useState<string | null>(null);
	const [calls, setCalls] = useState<object[]>([]);

	function record(kind: string, data: object) {
		setCalls((previous) => [...previous, { kind, ...data }]);
	}

	function change(kind: "move" | "resize", id: string, start: Date, end: Date) {
		record(kind, { id, start: start.toISOString(), end: end.toISOString() });
		setEvents((previous) => previous.map((event) => (event.id === id ? { ...event, start, end } : event)));
	}

	return (
		<>
			<Agenda
				events={events}
				date={date}
				view={view}
				onViewChange={setView}
				onDateChange={(next) => {
					setDate(next);
					record("date", { date: next.toISOString() });
				}}
				timeZone='Europe/Berlin'
				selectedEventId={selected}
				onEventSelect={(id) => {
					setSelected(id);
					record("select", { id });
				}}
				onEventCreate={({ start, end }) => {
					record("create", { start: start.toISOString(), end: end.toISOString() });
				}}
				onEventMove={(id, start, end) => change("move", id, start, end)}
				onEventResize={(id, start, end) => change("resize", id, start, end)}
				onEventDelete={(id) => {
					record("delete", { id });
					setEvents((previous) => previous.filter((event) => event.id !== id));
				}}
			/>
			<pre data-agenda-calls>{JSON.stringify(calls)}</pre>
		</>
	);
}
