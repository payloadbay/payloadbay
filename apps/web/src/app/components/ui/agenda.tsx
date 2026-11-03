"use client";

import { useEffect, useRef, useState, type PointerEvent, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarDateTime, fromDate, getLocalTimeZone, startOfWeek } from "@internationalized/date";
import { useLocale } from "react-aria-components";
import { Segment } from "./segment";
import { Button } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import "./catalog.css";

export type AgendaEvent = {
	id: string;
	title: string;
	start: Date;
	end: Date;
	color?: string;
	allDay?: boolean;
};

export type AgendaView = "day" | "week" | "month" | "list";

export type AgendaProps = {
	events: AgendaEvent[];
	date?: Date;
	onDateChange?: (date: Date) => void;
	view?: AgendaView;
	onViewChange?: (view: AgendaView) => void;
	onEventCreate?: (event: { start: Date; end: Date }) => void;
	onEventMove?: (id: string, start: Date, end: Date) => void;
	onEventResize?: (id: string, start: Date, end: Date) => void;
	onEventDelete?: (id: string) => void;
	onEventSelect?: (id: string | null) => void;
	selectedEventId?: string | null;
	defaultSelectedEventId?: string | null;
	locale?: string;
	timeZone?: string;
};

function dayStart(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, count: number) {
	const result = new Date(date);
	result.setDate(result.getDate() + count);

	return result;
}

function weekStart(date: Date, locale: string) {
	return dayStart(startOfWeek(fromDate(date, getLocalTimeZone()), locale).toDate());
}

function wallTime(date: Date, zone: string) {
	const value = fromDate(date, zone);

	return new Date(value.year, value.month - 1, value.day, value.hour, value.minute, value.second, value.millisecond);
}

function instant(date: Date, zone: string) {
	return new CalendarDateTime(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()).toDate(zone);
}

function timeOffset(minutes: number) {
	return `calc(var(--pb-agenda-hour-height) * ${minutes / 60})`;
}

function dayKey(date: Date) {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function eventsOn(events: AgendaEvent[], date: Date) {
	const start = dayStart(date);
	const end = addDays(start, 1);

	return events.filter((event) => event.start < end && event.end > start && event.end > event.start).sort((a, b) => a.start.getTime() - b.start.getTime());
}

function eventLanes(events: AgendaEvent[], day: Date) {
	const start = dayStart(day).getTime();
	const next = addDays(dayStart(day), 1).getTime();
	const entries: Array<{
		event: AgendaEvent;
		from: number;
		until: number;
		lane: number;
		lanes: number;
	}> = [];
	let group: Array<{
		event: AgendaEvent;
		from: number;
		until: number;
		lane: number;
	}> = [];
	let ends: number[] = [];
	let groupEnd = 0;

	function flush() {
		entries.push(...group.map((entry) => ({ ...entry, lanes: ends.length })));
		group = [];
		ends = [];
	}

	for (const event of events) {
		const from = Math.max(start, event.start.getTime());
		const until = Math.min(next, event.end.getTime());
		if (from >= groupEnd) flush();
		let lane = ends.findIndex((end) => end <= from);
		if (lane < 0) lane = ends.length;
		ends[lane] = until;
		groupEnd = Math.max(groupEnd, until);
		group.push({
			event,
			from,
			until,
			lane,
		});
	}

	flush();

	return entries;
}

function EventButton({ event, onEventPress, selectedEventId }: { event: AgendaEvent; onEventPress?: (event: AgendaEvent) => void; selectedEventId?: string | null }) {
	return (
		<Button size='sm' variant='ghost' aria-pressed={selectedEventId === event.id} className='pb-agenda-event-label' style={{ color: event.color ?? "var(--accent)" }} onPress={() => onEventPress?.(event)}>
			{event.title}
		</Button>
	);
}

interface SpanEventsProps {
	events: AgendaEvent[];
	days: Date[];
	selectedEventId?: string | null;
	onEventPress?: (event: AgendaEvent) => void;
	gutter?: boolean;
}

function SpanEvents({ events, days, onEventPress, selectedEventId, gutter = false }: SpanEventsProps) {
	const occupied: number[] = [];
	const spans = events
		.filter((event) => event.allDay || event.end.getTime() - event.start.getTime() >= 86400_000)
		.map((event) => {
			const indices = days.flatMap((day, index) => (eventsOn([event], day).length ? [index] : []));
			if (!indices.length) return null;
			const start = indices[0];
			const end = indices.at(-1)! + 1;
			let lane = occupied.findIndex((until) => until <= start);
			if (lane < 0) lane = occupied.length;
			occupied[lane] = end;

			return (
				<div key={event.id} style={{ gridColumn: `${start + 1} / ${end + 1}`, gridRow: lane + 1 }}>
					<EventButton event={event} onEventPress={onEventPress} selectedEventId={selectedEventId} />
				</div>
			);
		})
		.filter(Boolean);
	if (!spans.length) return null;

	return (
		<div
			className='pb-agenda-spans'
			style={{
				gridColumn: "1 / -1",
				paddingInlineStart: gutter ? "var(--pb-agenda-gutter)" : 0,
				display: "grid",
				gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`,
				gap: 2,
			}}
		>
			{spans}
		</div>
	);
}

interface AgendaCalendarProps extends Omit<AgendaProps, "onEventCreate" | "onEventMove" | "onEventResize"> {
	onCreate?: (start: Date, end: Date) => void;
	onEventPress?: (event: AgendaEvent) => void;
	onEventChange?: (event: AgendaEvent, resize?: boolean) => void;
	canMove: boolean;
	canResize: boolean;
	now: Date;
}

export function Agenda(props: AgendaProps) {
	const { locale } = useLocale();

	const [localDate, setLocalDate] = useState(() => new Date());
	const [selected, setSelected] = useState<string | null>(props.defaultSelectedEventId ?? null);
	const [clock, setClock] = useState(() => new Date());

	useEffect(() => {
		const timer = setInterval(() => setClock(new Date()), 60_000);

		return () => clearInterval(timer);
	}, []);

	const zone = props.timeZone ?? getLocalTimeZone();
	const events = props.events.map((event) => ({ ...event, start: wallTime(event.start, zone), end: wallTime(event.end, zone) }));

	return (
		<AgendaCalendar
			{...props}
			locale={props.locale ?? locale}
			events={events}
			date={wallTime(props.date ?? localDate, zone)}
			now={wallTime(clock, zone)}
			onDateChange={(value) => {
				const next = instant(value, zone);
				setLocalDate(next);
				props.onDateChange?.(next);
			}}
			selectedEventId={props.selectedEventId === undefined ? selected : props.selectedEventId}
			onEventSelect={(id) => {
				setSelected(id);
				props.onEventSelect?.(id);
			}}
			onCreate={props.onEventCreate ? (start, end) => props.onEventCreate?.({ start: instant(start, zone), end: instant(end, zone) }) : undefined}
			onEventPress={(event) => {
				setSelected(event.id);
				props.onEventSelect?.(event.id);
			}}
			canMove={Boolean(props.onEventMove)}
			canResize={Boolean(props.onEventResize)}
			onEventChange={props.onEventMove || props.onEventResize ? (event, resize) => (resize ? props.onEventResize : props.onEventMove)?.(event.id, instant(event.start, zone), instant(event.end, zone)) : undefined}
		/>
	);
}

function AgendaCalendar({ events, date, onDateChange, view, onViewChange, onEventPress, onCreate, onEventChange, onEventDelete, onEventSelect, selectedEventId, canMove, canResize, locale = "en-US", now }: AgendaCalendarProps) {
	const [localDate, setLocalDate] = useState(() => new Date());
	const [localView, setLocalView] = useState<AgendaView>("week");
	const scroll = useRef<HTMLDivElement>(null);

	const reducedMotion = useReducedMotion();

	const creation = useRef<{ day: Date; minute: number } | null>(null);
	const [selection, setSelection] = useState<{ day: Date; from: number; until: number } | null>(null);

	useEffect(() => {
		function cancel(event: KeyboardEvent) {
			if (event.key !== "Escape" || !creation.current) return;
			event.preventDefault();
			creation.current = null;
			setSelection(null);
		}

		document.addEventListener("keydown", cancel);

		return () => document.removeEventListener("keydown", cancel);
	}, []);

	const scrollKey = `${date?.toDateString()}:${view}`;

	const lastScrollKey = useRef("");

	useEffect(() => {
		if (scroll.current && lastScrollKey.current !== scrollKey) {
			scroll.current.scrollTop = Math.max(0, (now.getHours() - 1) * parseFloat(getComputedStyle(scroll.current).getPropertyValue("--pb-agenda-hour-height")));
			lastScrollKey.current = scrollKey;
		}
	}, [scrollKey, now]);

	const drag = useRef<{
		event: AgendaEvent;
		x: number;
		y: number;
		resize: boolean;
		moved: boolean;
		preview?: AgendaEvent;
	} | null>(null);
	const [preview, setPreview] = useState<AgendaEvent | null>(null);

	const shownEvents = preview ? events.map((event) => (event.id === preview.id ? preview : event)) : events;

	const suppressClick = useRef(false);

	function minuteAt(pointer: PointerEvent<HTMLElement>) {
		return Math.max(0, Math.min(1440, Math.round((((pointer.clientY - pointer.currentTarget.getBoundingClientRect().top) / pointer.currentTarget.getBoundingClientRect().height) * 1440) / 5) * 5));
	}

	function createStart(pointer: PointerEvent<HTMLElement>, day: Date) {
		if (!onCreate || pointer.button !== 0 || !pointer.isPrimary || (pointer.target as HTMLElement).closest("button")) return;
		if (pointer.pointerType !== "touch") pointer.preventDefault();
		const minute = Math.min(1435, minuteAt(pointer));
		creation.current = { day, minute };
		setSelection({ day, from: minute, until: minute + 5 });
		pointer.currentTarget.setPointerCapture(pointer.pointerId);
	}

	function createMove(pointer: PointerEvent<HTMLElement>) {
		const active = creation.current;
		if (!active) return;
		const minute = minuteAt(pointer);
		setSelection({ day: active.day, from: Math.min(active.minute, minute), until: Math.max(Math.max(active.minute, minute), Math.min(active.minute, minute) + 5) });
	}

	function createEnd(pointer: PointerEvent<HTMLElement>) {
		const active = creation.current;
		creation.current = null;
		setSelection(null);
		if (!active) return;
		const minute = minuteAt(pointer);
		const from = Math.min(active.minute, minute);
		const until = minute === active.minute ? Math.min(1440, from + 60) : Math.max(active.minute, minute);
		const start = new Date(active.day);
		const end = new Date(active.day);
		start.setMinutes(from);
		end.setMinutes(until);
		onCreate?.(start, end);
	}

	function dragStart(event: PointerEvent<HTMLElement>, entry: AgendaEvent) {
		const resize = Boolean((event.target as HTMLElement).closest(".pb-agenda-resize"));
		if (!(resize ? canResize : canMove) || event.button !== 0 || !event.isPrimary) return;
		event.stopPropagation();
		event.preventDefault();
		suppressClick.current = false;
		drag.current = {
			event: entry,
			x: event.clientX,
			y: event.clientY,
			resize,
			moved: false,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function dragMove(event: PointerEvent<HTMLElement>) {
		const active = drag.current;
		if (!active) return;
		const day = event.currentTarget.closest<HTMLElement>(".pb-agenda-day");
		const hourHeight = (day?.clientHeight ?? 1440) / 24;
		const vertical = Math.round(((event.clientY - active.y) / hourHeight) * 12) * 5 * 60_000;
		const dayWidth = event.currentTarget.closest(".pb-agenda-day")?.getBoundingClientRect().width ?? 100;
		const horizontal = Math.round((event.clientX - active.x) / dayWidth);
		active.moved ||= Math.hypot(event.clientX - active.x, event.clientY - active.y) > 5;
		const start = active.resize ? active.event.start : addDays(new Date(active.event.start.getTime() + vertical), horizontal);
		const end = active.resize ? new Date(Math.max(start.getTime() + 5 * 60_000, active.event.end.getTime() + vertical)) : new Date(start.getTime() + active.event.end.getTime() - active.event.start.getTime());
		if (active.moved) {
			active.preview = { ...active.event, start, end };
			setPreview(active.preview);
		}
	}

	function dragEnd() {
		if (drag.current?.moved && drag.current.preview) {
			suppressClick.current = true;
			onEventChange?.(drag.current.preview, drag.current.resize);
		}

		drag.current = null;
		setPreview(null);
	}

	const current = date ?? localDate;
	const mode = view ?? localView;
	const start = mode === "week" || mode === "list" ? weekStart(current, locale) : mode === "month" ? weekStart(new Date(current.getFullYear(), current.getMonth(), 1), locale) : dayStart(current);
	const days = Array.from({ length: mode === "month" ? 42 : mode === "day" ? 1 : 7 }, (_, index) => addDays(start, index));

	function changeDate(next: Date) {
		setLocalDate(next);
		onDateChange?.(next);
	}

	function move(direction: number) {
		if (mode === "month") changeDate(new Date(current.getFullYear(), current.getMonth() + direction, 1));
		else changeDate(addDays(current, direction * (mode === "day" ? 1 : 7)));
	}

	const heading = current.toLocaleDateString(locale, { month: "long", year: "numeric" });

	return (
		<section
			className='pb-agenda'
			data-view={mode}
			aria-label='Calendar agenda'
			onKeyDown={(key) => {
				if ((key.key === "Delete" || key.key === "Backspace") && selectedEventId && onEventDelete) {
					key.preventDefault();
					onEventDelete(selectedEventId);
					onEventSelect?.(null);
				} else if (key.key === "Escape" && !creation.current) onEventSelect?.(null);
			}}
		>
			<header>
				<h2 className='font-semibold' aria-live='polite'>
					{heading}
				</h2>
				<Segment
					label='Calendar view'
					value={mode}
					onChange={(key) => {
						const next = String(key) as AgendaView;
						setLocalView(next);
						onViewChange?.(next);
					}}
					items={["day", "week", "month"].map((value) => ({ id: value, label: value[0].toUpperCase() + value.slice(1) }))}
				/>
				<div className='pb-agenda-navigation'>
					<Button isIconOnly size='sm' variant='ghost' aria-label='Previous period' onPress={() => move(-1)}>
						<IconChevronLeft size={16} />
					</Button>
					<Button size='sm' variant='outline' onPress={() => changeDate(now)}>
						Today
					</Button>
					<Button isIconOnly size='sm' variant='ghost' aria-label='Next period' onPress={() => move(1)}>
						<IconChevronRight size={16} />
					</Button>
				</div>
			</header>
			{mode === "list" ? (
				<div className='pb-agenda-list'>
					{days.map((day) => (
						<section key={dayKey(day)}>
							<h3 className='text-sm font-medium'>{day.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" })}</h3>
							{eventsOn(shownEvents, day).length ? (
								eventsOn(shownEvents, day).map((event) => (
									<div key={event.id} className='flex items-center gap-4'>
										<time className='text-xs text-muted'>{event.allDay ? "All day" : event.start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</time>
										<EventButton onEventPress={onEventPress} event={event} selectedEventId={selectedEventId} />
									</div>
								))
							) : (
								<p className='py-2 text-xs text-muted'>No events</p>
							)}
						</section>
					))}
				</div>
			) : mode === "month" ? (
				<div className='pb-agenda-month'>
					{Array.from({ length: 6 }, (_, week) => {
						const weekDays = days.slice(week * 7, week * 7 + 7);

						return (
							<div className='pb-agenda-month-week' key={week}>
								{weekDays.map((day) => (
									<section key={dayKey(day)} data-muted={day.getMonth() !== current.getMonth()} aria-label={day.toDateString()}>
										<Button variant='ghost' size='sm' onPress={() => onCreate?.(day, new Date(day.getTime() + 3600_000))} aria-label={`Add event ${day.toDateString()}`} className={dayKey(day) === dayKey(now) ? "text-accent" : ""}>
											{day.getDate()}
										</Button>
										{eventsOn(shownEvents, day)
											.filter((event) => !event.allDay && event.end.getTime() - event.start.getTime() < 86400_000)
											.map((event) => (
												<EventButton event={event} key={event.id} onEventPress={onEventPress} selectedEventId={selectedEventId} />
											))}
									</section>
								))}
								<SpanEvents selectedEventId={selectedEventId} events={shownEvents} days={weekDays} onEventPress={onEventPress} />
							</div>
						);
					})}
				</div>
			) : (
				<>
					<div className='pb-agenda-day-headers' style={{ gridTemplateColumns: `var(--pb-agenda-gutter) repeat(${days.length}, minmax(0, 1fr))` }}>
						<div />
						{days.map((day) => (
							<div className='pb-agenda-day-heading' key={dayKey(day)} data-weekend={[0, 6].includes(day.getDay())}>
								<span className='pb-agenda-weekday'>{day.toLocaleDateString(locale, { weekday: "short" })}</span>
								<span className='pb-agenda-date' data-today={dayKey(day) === dayKey(now)}>
									{day.getDate()}
								</span>
							</div>
						))}
					</div>
					<SpanEvents selectedEventId={selectedEventId} events={shownEvents} days={days} onEventPress={onEventPress} gutter />
					<div className='pb-agenda-scroll' ref={scroll}>
						<div className='pb-agenda-week' style={{ gridTemplateColumns: `var(--pb-agenda-gutter) repeat(${days.length}, minmax(0, 1fr))` }}>
							<div className='pb-agenda-hours'>
								{Array.from({ length: 24 }, (_, hour) => (
									<span key={hour}>{new Date(2000, 0, 1, hour).toLocaleTimeString(locale, { hour: "numeric" })}</span>
								))}
								{days.some((day) => dayKey(day) === dayKey(now)) && (
									<span className='pb-agenda-current-label' style={{ top: timeOffset(now.getHours() * 60 + now.getMinutes()) }}>
										{now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
									</span>
								)}
							</div>
							{days.map((day) => (
								<div
									key={dayKey(day)}
									className='pb-agenda-day'
									onPointerDown={(pointer) => createStart(pointer, day)}
									onPointerMove={createMove}
									onPointerUp={createEnd}
									onPointerCancel={() => {
										creation.current = null;
										setSelection(null);
									}}
									data-weekend={[0, 6].includes(day.getDay())}
									aria-label={day.toDateString()}
								>
									{days.some((entry) => dayKey(entry) === dayKey(now)) && <span className={dayKey(day) === dayKey(now) ? "pb-agenda-now" : "pb-agenda-time-line"} style={{ top: timeOffset(now.getHours() * 60 + now.getMinutes()) }} aria-label={dayKey(day) === dayKey(now) ? "Current time" : undefined} />}
									{onCreate &&
										Array.from({ length: 24 }, (_, hour) => (
											<button
												key={hour}
												type='button'
												className='pb-agenda-time-slot sr-only focus:not-sr-only'
												style={{ top: timeOffset(hour * 60) }}
												aria-label={`Add event ${day.toDateString()} ${hour}:00`}
												onClick={() => {
													const time = new Date(day);
													time.setHours(hour);
													onCreate(time, new Date(time.getTime() + 3600_000));
												}}
											/>
										))}
									{selection && dayKey(selection.day) === dayKey(day) && <motion.div className='pb-agenda-create-preview' initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.96 }} animate={{ opacity: 0.6, scale: 1 }} transition={{ duration: 0.15 }} style={{ top: timeOffset(selection.from), height: timeOffset(selection.until - selection.from) }} />}
									{eventLanes(
										eventsOn(shownEvents, day).filter((event) => !event.allDay && event.end.getTime() - event.start.getTime() < 86400_000),
										day,
									).map(({ event, from, until, lane, lanes }) => {
										const fromDate = new Date(from);
										const endDate = new Date(until);
										const top = (fromDate.getHours() + fromDate.getMinutes() / 60) * 60;
										const bottom = until === addDays(dayStart(day), 1).getTime() ? 1440 : (endDate.getHours() + endDate.getMinutes() / 60) * 60;

										return (
											<button
												type='button'
												key={event.id}
												className='pb-agenda-event'
												onPointerDown={(pointer) => dragStart(pointer, event)}
												onPointerMove={dragMove}
												onPointerUp={dragEnd}
												onPointerCancel={() => {
													drag.current = null;
													setPreview(null);
												}}
												onKeyDown={(key) => {
													if (!canMove || !key.altKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key.key)) return;
													key.preventDefault();
													const delta = key.key === "ArrowUp" ? -15 * 60_000 : key.key === "ArrowDown" ? 15 * 60_000 : key.key === "ArrowLeft" ? -86400_000 : 86400_000;
													onEventChange?.({ ...event, start: new Date(event.start.getTime() + delta), end: new Date(event.end.getTime() + delta) });
												}}
												data-editable={canMove || canResize}
												aria-pressed={selectedEventId === event.id}
												data-dragging={Boolean(preview)}
												style={
													{
														top: timeOffset(top),
														height: timeOffset(bottom - top),
														left: `calc(${(lane / lanes) * 100}% + 2px)`,
														width: `calc(${100 / lanes}% - 4px)`,
														"--pb-agenda-event-accent": event.color ?? "var(--accent)",
														backgroundColor: `color-mix(in srgb, ${event.color ?? "var(--accent)"} 15%, transparent)`,
													} as CSSProperties
												}
												onClick={() => {
													if (!suppressClick.current) onEventPress?.(event);
													suppressClick.current = false;
												}}
											>
												<span className='font-medium'>{event.title}</span>
												<time dateTime={event.start.toISOString()}>
													{event.start.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })} - {event.end.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
												</time>
												{canResize && <span className='pb-agenda-resize' aria-hidden='true' />}
											</button>
										);
									})}
								</div>
							))}
						</div>
					</div>
				</>
			)}
		</section>
	);
}
