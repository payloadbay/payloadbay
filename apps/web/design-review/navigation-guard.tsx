import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Button } from "@heroui/react";
import { useUnsavedChanges } from "@components/unsaved-changes";

function GuardEditor({ visited, navigate }: { visited: string; navigate: (href: string) => void }) {
	const [dirty, setDirty] = useState(false);

	const { dialog, confirmDiscard } = useUnsavedChanges(dirty);

	return (
		<section className='flex flex-col gap-4'>
			<h1>Navigation guard</h1>
			<Button onPress={() => setDirty(true)}>Make unsaved edit</Button>
			<Button onPress={() => setDirty(false)}>Save fixture</Button>
			<a
				href='/fixture/project'
				onClick={(event) => {
					event.preventDefault();
					navigate("/fixture/project");
				}}
			>
				Project link
			</a>
			<Button onPress={() => confirmDiscard(() => navigate("/fixture/action"))}>Guarded action</Button>
			<Button
				onPress={() => {
					const event = new CustomEvent("payloadbay:before-navigate", { detail: { href: "/fixture/command" }, cancelable: true });
					if (window.dispatchEvent(event)) navigate("/fixture/command");
				}}
			>
				Command navigation
			</Button>
			<output aria-label='Navigation result'>{visited || "No navigation"}</output>
			{dialog}
		</section>
	);
}

export function NavigationGuardFixture() {
	const [visited, setVisited] = useState("");

	const router = useMemo<AppRouterInstance>(
		() => ({
			back: () => setVisited("back"),
			forward: () => setVisited("forward"),
			refresh: () => setVisited("refresh"),
			push: setVisited,
			replace: setVisited,
			prefetch: () => {},
			bfcacheId: "fixture",
		}),
		[],
	);

	return (
		<AppRouterContext.Provider value={router}>
			<GuardEditor visited={visited} navigate={setVisited} />
		</AppRouterContext.Provider>
	);
}

createRoot(document.getElementById("root")!).render(<NavigationGuardFixture />);
