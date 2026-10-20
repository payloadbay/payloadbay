"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DropZone as AriaDropZone, FileTrigger } from "react-aria-components";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@heroui/react";
import { IconFile, IconCloudUpload, IconX } from "@tabler/icons-react";
import "./catalog.css";

export type DropZoneProps = {
	label: string;
	value: File[];
	onChange: (files: File[]) => void;
	acceptedFileTypes?: string[];
	maxFileSize?: number;
	maxFiles?: number;
	isDisabled?: boolean;
};

export function DropZone({ label, value, onChange, acceptedFileTypes = [], maxFileSize = 10 * 1024 * 1024, maxFiles = 10, isDisabled = false }: DropZoneProps) {
	const [error, setError] = useState("");

	const errorId = useId();

	const current = useRef(value);

	useEffect(() => {
		current.current = value;
	}, [value]);

	function accept(files: File[]) {
		const next = [...current.current];
		const errors: string[] = [];
		for (const file of files) {
			const permitted = !acceptedFileTypes.length || acceptedFileTypes.some((type) => (type.startsWith(".") ? file.name.toLowerCase().endsWith(type.toLowerCase()) : type.endsWith("/*") ? file.type.startsWith(type.slice(0, -1)) : file.type === type));
			if (!permitted) {
				errors.push(`${file.name}: unsupported file type`);
				continue;
			}

			if (file.size > maxFileSize) {
				errors.push(`${file.name}: exceeds the file size limit`);
				continue;
			}

			if (next.some((entry) => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified)) continue;
			if (next.length >= maxFiles) {
				errors.push(`Choose at most ${maxFiles} files`);
				break;
			}

			next.push(file);
		}

		current.current = next;
		onChange(next);
		setError(errors.join(". "));
	}

	return (
		<div>
			<AriaDropZone
				aria-label={label}
				aria-describedby={error ? errorId : undefined}
				isDisabled={isDisabled}
				className='pb-drop-zone'
				onDrop={async (event) => {
					try {
						accept(await Promise.all(event.items.filter((item) => item.kind === "file").map((item) => item.getFile())));
					} catch {
						setError("Could not read the dropped files");
					}
				}}
			>
				<IconCloudUpload size={24} />
				<p className='font-medium'>{label}</p>
				<p className='text-xs text-muted'>Drop files here or browse. Up to {Math.round(maxFileSize / 1024 / 1024)} MB per file.</p>
				<FileTrigger
					acceptedFileTypes={acceptedFileTypes}
					allowsMultiple={maxFiles > 1}
					onSelect={(files) => {
						if (files) accept(Array.from(files));
					}}
				>
					<Button variant='ghost' isDisabled={isDisabled}>
						Browse files
					</Button>
				</FileTrigger>
			</AriaDropZone>
			{error && (
				<p id={errorId} role='alert' className='mt-2 text-sm text-danger'>
					{error}
				</p>
			)}
			<ul className='pb-file-list'>
				<AnimatePresence initial={false}>
					{value.map((file, index) => (
						<motion.li layout key={`${file.name}-${file.size}-${file.lastModified}`} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ layout: { type: "spring", bounce: 0.15, duration: 0.4 } }}>
							<IconFile size={18} />
							<span className='min-w-0 flex-1 truncate'>{file.name}</span>
							<span className='text-xs text-muted'>{new Intl.NumberFormat(undefined, { notation: "compact" }).format(file.size)} B</span>
							<Button
								variant='ghost'
								size='sm'
								isIconOnly
								aria-label={`Remove ${file.name}`}
								isDisabled={isDisabled}
								onPress={() => {
									const next = value.filter((_, position) => position !== index);
									current.current = next;
									onChange(next);
									setError("");
								}}
							>
								<IconX size={16} />
							</Button>
						</motion.li>
					))}
				</AnimatePresence>
			</ul>
		</div>
	);
}
