"use client";

import { useCallback, useEffect, useState, isValidElement, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import "./catalog.css";

export interface CarouselProps {
	slides: ReactNode[];
	label: string;
	loop?: boolean;
	thumbnails?: ReactNode[];
	direction?: "ltr" | "rtl";
}

export function Carousel({ slides, label, loop = false, thumbnails, direction = "ltr" }: CarouselProps) {
	const [ref, api] = useEmblaCarousel({ loop, direction });

	const [selected, setSelected] = useState(0);
	const [canPrevious, setCanPrevious] = useState(false);
	const [canNext, setCanNext] = useState(false);

	const update = useCallback(() => {
		if (api) {
			setSelected(api.selectedScrollSnap());
			setCanPrevious(api.canScrollPrev());
			setCanNext(api.canScrollNext());
		}
	}, [api]);

	useEffect(() => {
		if (!api) return;
		const initialFrame = requestAnimationFrame(update);
		api.on("select", update).on("reInit", update);

		return () => {
			cancelAnimationFrame(initialFrame);
			api.off("select", update).off("reInit", update);
		};
	}, [api, update]);

	if (!slides.length)
		return (
			<section aria-label={label} className='rounded-xl bg-default p-8 text-center text-muted'>
				No slides
			</section>
		);

	return (
		<section
			className='pb-carousel'
			dir={direction}
			aria-label={label}
			aria-roledescription='carousel'
			tabIndex={0}
			onKeyDown={(event) => {
				const target = event.target as HTMLElement;
				if (event.ctrlKey || event.metaKey || event.altKey || target.matches("input,textarea,select") || target.isContentEditable) return;
				if (event.key === (direction === "rtl" ? "ArrowLeft" : "ArrowRight")) {
					event.preventDefault();
					api?.scrollNext();
				} else if (event.key === (direction === "rtl" ? "ArrowRight" : "ArrowLeft")) {
					event.preventDefault();
					api?.scrollPrev();
				}
			}}
		>
			<div className='pb-carousel-stage'>
				<div className='pb-carousel-viewport' ref={ref}>
					<div className='pb-carousel-track'>
						{slides.map((slide, index) => (
							<div className='pb-carousel-slide' key={isValidElement(slide) ? (slide.key ?? index) : index} role='group' aria-roledescription='slide' aria-label={`${index + 1} of ${slides.length}`} inert={selected !== index}>
								{slide}
							</div>
						))}
					</div>
				</div>
				<div className='pb-carousel-controls'>
					<Button isIconOnly variant='secondary' size='sm' aria-label='Previous slide' isDisabled={!canPrevious} onPress={() => api?.scrollPrev()}>
						<IconChevronLeft size={18} />
					</Button>

					<Button isIconOnly variant='secondary' size='sm' aria-label='Next slide' isDisabled={!canNext} onPress={() => api?.scrollNext()}>
						<IconChevronRight size={18} />
					</Button>
				</div>
			</div>
			{!thumbnails && (
				<div role='group' aria-label='Choose slide' className='pb-carousel-dots'>
					{slides.map((_, index) => (
						<Button key={index} isIconOnly size='sm' variant='ghost' className='pb-carousel-dot' aria-label={`Go to slide ${index + 1}`} aria-current={selected === index ? "true" : undefined} onPress={() => api?.scrollTo(index)}>
							<span />
						</Button>
					))}
				</div>
			)}
			{thumbnails && (
				<div className='pb-carousel-thumbnails' role='group' aria-label='Slide previews'>
					{slides.map((_, index) => (
						<Button key={index} variant='ghost' aria-label={`Preview slide ${index + 1}`} aria-current={selected === index ? "true" : undefined} onPress={() => api?.scrollTo(index)}>
							{thumbnails[index] ?? index + 1}
						</Button>
					))}
				</div>
			)}
			<p className='sr-only' aria-live='polite'>
				Slide {selected + 1} of {slides.length}
			</p>
		</section>
	);
}
