import { useEffect, useState, type ComponentType } from "react";
import { Label, ListBox, Select, Toast } from "@heroui/react";
import { catalogVariants, firstVariant, variantLabel } from "./catalog-variants";
import { componentIds, componentName } from "./catalog-items";

export function CatalogPage({ Example, reference }: { Example: ComponentType<{ id: string; variant?: string }>; reference?: boolean }) {
	const [variants, setVariants] = useState<Record<string, string>>({});

	const requested = new URLSearchParams(location.search).get("component") ?? "all";
	const ids = requested === "all" ? componentIds : [componentIds.includes(requested) ? requested : componentIds[0]];

	useEffect(() => {
		let frame = 0;
		let remoteY: number | null = null;
		const sections = [...document.querySelectorAll<HTMLElement>("[data-review-component]")];

		function publish() {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				if (remoteY !== null) {
					const echoed = Math.abs(scrollY - remoteY) < 2;
					remoteY = null;

					if (echoed) return;
				}

				const section = sections.find((entry) => entry.getBoundingClientRect().bottom > 0) ?? sections.at(-1);
				if (!section) return;
				const rect = section.getBoundingClientRect();
				parent.postMessage({ type: "catalog-scroll", id: section.dataset.reviewComponent, offset: -rect.top / rect.height }, location.origin);
			});
		}

		function receive(event: MessageEvent) {
			if (event.origin !== location.origin || event.source !== parent) return;
			if (event.data?.type === "catalog-variant" && catalogVariants[event.data.id]?.includes(event.data.variant)) {
				setVariants((current) => ({ ...current, [event.data.id]: event.data.variant }));
			}

			if (event.data?.type === "catalog-scroll") {
				const section = sections.find((entry) => entry.dataset.reviewComponent === event.data.id);
				if (!section || !Number.isFinite(event.data.offset)) return;
				cancelAnimationFrame(frame);
				const destination = scrollY + section.getBoundingClientRect().top + section.offsetHeight * event.data.offset;
				remoteY = Math.max(0, Math.min(destination, document.documentElement.scrollHeight - innerHeight));
				scrollTo(0, remoteY);
			}
		}

		window.addEventListener("scroll", publish, { passive: true });
		window.addEventListener("message", receive);

		return () => {
			window.removeEventListener("scroll", publish);
			window.removeEventListener("message", receive);
			cancelAnimationFrame(frame);
		};
	}, [requested]);

	return (
		<main className='mx-auto max-w-4xl p-4 sm:p-6'>
			{ids.map((id) => (
				<section key={id} id={`review-${id}`} data-review-component={id} className='pb-review-section' style={{ paddingBottom: 48 }}>
					<header className='mb-6'>
						<p className='text-xs text-muted'>{reference ? "Licensed HeroUI Pro reference" : "Public HeroUI + independent compositions"}</p>
						<h1 className='mt-1 text-xl font-semibold'>{componentName(id)}</h1>
					</header>
					<div className='relative isolate rounded-2xl border border-border bg-surface p-4 sm:p-6' style={{ transform: "translateZ(0)" }}>
						{catalogVariants[id] && (
							<div className='mb-5 flex items-end justify-between gap-3 border-b border-border pb-4'>
								<Select
									aria-label={`${componentName(id)} example`}
									value={variants[id] ?? firstVariant(id)}
									variant='secondary'
									className='w-56 max-w-full'
									onChange={(key) => {
										const variant = String(key);
										setVariants((current) => ({ ...current, [id]: variant }));
										parent.postMessage({ type: "catalog-variant", id, variant }, location.origin);
									}}
								>
									<Label>Example</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{catalogVariants[id].map((value) => (
												<ListBox.Item id={value} key={value} textValue={variantLabel(value)}>
													{variantLabel(value)}
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>
								<a className='text-xs text-accent' href={`https://heroui.pro/docs/react/components/${id}`} target='_blank' rel='noreferrer'>
									Official examples ↗
								</a>
							</div>
						)}
						<Example key={`${id}-${variants[id] ?? firstVariant(id)}`} id={id} variant={variants[id] ?? firstVariant(id)} />
					</div>
				</section>
			))}
			<Toast.Provider placement='bottom' />
		</main>
	);
}
