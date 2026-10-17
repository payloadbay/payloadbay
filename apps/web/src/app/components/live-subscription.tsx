"use client";

import { createContext, useCallback, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import type { ChangeKind } from "@domain/changes";

type LiveKind = ChangeKind | "resync-required";
type Listener = () => void;
type LiveState = {
	status: "connecting" | "connected" | "reconnecting";
	subscribe: (kind: LiveKind, listener: Listener) => () => void;
};

const kinds: LiveKind[] = ["event.recorded", "event.accepted", "execution.changed", "attempt.completed", "configuration.changed", "health.changed", "notification.changed", "resync-required"];
const Context = createContext<LiveState | null>(null);

/** One credentialed stream per mounted dashboard; consumers fetch their own authorized data. */
export function LiveSubscription({ instanceId, onReconnect, children }: { instanceId: string; onReconnect: () => Promise<void>; children: ReactNode }) {
	const listeners = useRef(new Map<LiveKind, Set<Listener>>());

	const [status, setStatus] = useState<LiveState["status"]>("connecting");

	const subscribe = useCallback((kind: LiveKind, listener: Listener) => {
		let group = listeners.current.get(kind);
		if (!group) {
			group = new Set();
			listeners.current.set(kind, group);
		}

		group.add(listener);

		return () => {
			group.delete(listener);
		};
	}, []);

	const reconnect = useEffectEvent(() => {
		void onReconnect();
	});

	useEffect(() => {
		const source = new EventSource("/api/v1/changes?scopeType=accessible&scopeId=" + encodeURIComponent(instanceId));
		let opened = false;

		const notify = (kind: LiveKind) => {
			for (const listener of listeners.current.get(kind) ?? []) listener();
		};

		source.onopen = () => {
			setStatus("connected");
			if (opened) {
				notify("resync-required");
				reconnect();
			}

			opened = true;
		};

		source.onerror = () => setStatus("reconnecting");
		for (const kind of kinds) source.addEventListener(kind, () => notify(kind));

		return () => source.close();
	}, [instanceId]);

	const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);

	return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLiveSubscription() {
	const value = useContext(Context);

	if (!value) throw Error("Dashboard live subscription is unavailable");

	return value;
}
