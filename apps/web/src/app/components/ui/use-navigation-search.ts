"use client";

import { useCallback, useState } from "react";

export function useNavigationSearch() {
	const [overlay, setOverlay] = useState<"search" | "navigation" | null>(null);
	const [pendingSearch, setPendingSearch] = useState(false);

	const onSearchOpenChange = useCallback(
		(open: boolean) => {
			if (open && (overlay === "navigation" || pendingSearch)) {
				setPendingSearch(true);
				setOverlay(null);
			} else setOverlay((current) => (open ? "search" : current === "search" ? null : current));
		},
		[overlay, pendingSearch],
	);

	const onNavigationOpenChange = useCallback(
		(open: boolean) =>
			setOverlay((current) => {
				if (current === "search") return current;

				return open ? "navigation" : current === "navigation" ? null : current;
			}),
		[],
	);

	const onNavigationClosed = useCallback(() => {
		if (pendingSearch) {
			setPendingSearch(false);
			setOverlay("search");
		}
	}, [pendingSearch]);

	return {
		searchOpen: overlay === "search",
		navigationOpen: overlay === "navigation",
		onSearchOpenChange,
		onNavigationOpenChange,
		onNavigationClosed,
	};
}
