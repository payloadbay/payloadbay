"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@heroui/react";

/** Shared by route scripts and shared-code editors; never intercept in-page script tabs. */
export function useUnsavedChanges(dirty: boolean) {
	const router = useRouter();

	const [pending, setPending] = useState<(() => void) | null>(null);

	const confirmDiscard = useCallback(
		(action: () => void) => {
			if (dirty) setPending(() => action);
			else action();
		},
		[dirty],
	);

	useEffect(() => {
		if (!dirty) return;

		const unload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
		};

		const click = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
			if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
			const target = new URL(anchor.href);
			if (target.origin === location.origin && target.pathname === location.pathname) return;
			event.preventDefault();
			event.stopPropagation();
			setPending(() => () => {
				if (target.origin === location.origin) router.push(target.pathname + target.search + target.hash);
				else location.assign(target.href);
			});
		};

		const navigate = (event: Event) => {
			const href = (event as CustomEvent<{ href: string }>).detail.href;
			const target = new URL(href, location.href);
			if (target.pathname === location.pathname) return;
			event.preventDefault();
			setPending(() => () => router.push(href));
		};

		window.addEventListener("payloadbay:before-navigate", navigate);
		window.addEventListener("beforeunload", unload);
		document.addEventListener("click", click, true);

		return () => {
			window.removeEventListener("payloadbay:before-navigate", navigate);
			window.removeEventListener("beforeunload", unload);
			document.removeEventListener("click", click, true);
		};
	}, [dirty, router]);

	const dialog = (
		<Modal
			isOpen={Boolean(pending)}
			onOpenChange={(open) => {
				if (!open) setPending(null);
			}}
		>
			<Modal.Backdrop>
				<Modal.Container size='sm'>
					<Modal.Dialog>
						<Modal.Header>
							<Modal.Heading>Discard unsaved changes?</Modal.Heading>
						</Modal.Header>
						<Modal.Body>Your edits have not been saved. Stay here to save them, or discard them and continue.</Modal.Body>
						<Modal.Footer>
							<Button variant='secondary' onPress={() => setPending(null)}>
								Keep editing
							</Button>
							<Button
								variant='danger'
								onPress={() => {
									const action = pending;
									setPending(null);
									action?.();
								}}
							>
								Discard changes
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);

	return { confirmDiscard, dialog };
}
