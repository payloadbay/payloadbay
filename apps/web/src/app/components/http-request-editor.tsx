"use client";

import type { ReactNode } from "react";
import { Label, Tabs, Select, ListBox } from "@heroui/react";

import { CodeEditor } from "@components/code-editor";

export type BodyFormat = "json" | "xml" | "plaintext";

export const bodyContentTypes: Record<BodyFormat, string> = { json: "application/json", xml: "application/xml", plaintext: "text/plain" };

export function validateHttpBody(format: BodyFormat, body: string) {
	if (format === "json") {
		try {
			JSON.parse(body);
		} catch {
			throw Error("Correct the JSON body or choose Text before running the request.");
		}
	} else if (format === "xml" && new DOMParser().parseFromString(body, "application/xml").querySelector("parsererror")) throw Error("Correct the XML body or choose Text before running the request.");
}

type HttpRequestEditorProps = {
	body: string;
	headers: string;
	secrets?: string;
	format: BodyFormat;
	method?: string;
	methodLabel?: string;
	bodyLabel: string;
	headersLabel: string;
	onBodyChange: (value: string) => void;
	onHeadersChange: (value: string) => void;
	onSecretsChange?: (value: string) => void;
	onFormatChange: (value: BodyFormat) => void;
	onMethodChange?: (value: string) => void;
	controls?: ReactNode;
	checks?: ReactNode;
	action: ReactNode;
};

/** Published requests and dry script tests share the same editing interaction. */
export function HttpRequestEditor({ body, headers, secrets, format, method, methodLabel = "HTTP method", bodyLabel, headersLabel, onBodyChange, onHeadersChange, onSecretsChange, onFormatChange, onMethodChange, controls, checks, action }: HttpRequestEditorProps) {
	return (
		<section className='flex min-w-0 flex-col gap-4' aria-label='Request editor'>
			<div className='flex flex-wrap items-end gap-3'>
				{controls}
				{method && onMethodChange && (
					<Select variant='secondary' className='w-28 shrink-0' aria-label={methodLabel} value={method} onChange={(key) => onMethodChange(String(key ?? ""))}>
						<Label>Method</Label>
						<Select.Trigger>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								{["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((value) => (
									<ListBox.Item key={value} id={value}>
										{value}
										<ListBox.ItemIndicator />
									</ListBox.Item>
								))}
							</ListBox>
						</Select.Popover>
					</Select>
				)}
				<div className='ml-auto flex shrink-0'>{action}</div>
			</div>
			<Tabs defaultSelectedKey='body'>
				<Tabs.ListContainer>
					<Tabs.List aria-label='Request sections'>
						<Tabs.Tab id='body'>
							Body
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id='headers'>
							Headers
							<Tabs.Indicator />
						</Tabs.Tab>
						{onSecretsChange && (
							<Tabs.Tab id='secrets'>
								Sample secrets
								<Tabs.Indicator />
							</Tabs.Tab>
						)}
						{checks && (
							<Tabs.Tab id='checks'>
								Checks
								<Tabs.Indicator />
							</Tabs.Tab>
						)}
					</Tabs.List>
				</Tabs.ListContainer>
				<Tabs.Panel id='body' className='min-w-0 pt-4'>
					{method === "GET" || method === "HEAD" ? (
						<p className='text-muted py-4 text-sm'>This method sends no request body.</p>
					) : (
						<div className='flex min-w-0 flex-col gap-3'>
							<Select variant='secondary' className='w-36' aria-label='Body format' value={format} onChange={(key) => onFormatChange(String(key ?? "") as BodyFormat)}>
								<Label>Body format</Label>
								<Select.Trigger>
									<Select.Value />
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										<ListBox.Item id='json'>
											JSON
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id='xml'>
											XML
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id='plaintext'>
											Text
											<ListBox.ItemIndicator />
										</ListBox.Item>
									</ListBox>
								</Select.Popover>
							</Select>
							<CodeEditor language={format} label={bodyLabel} value={body} onChange={onBodyChange} />
						</div>
					)}
				</Tabs.Panel>
				<Tabs.Panel id='headers' className='min-w-0 pt-4'>
					<CodeEditor language='json' label={headersLabel} value={headers} onChange={onHeadersChange} />
				</Tabs.Panel>
				{onSecretsChange && (
					<Tabs.Panel id='secrets' className='min-w-0 pt-4'>
						<CodeEditor language='json' label='Synthetic secrets' value={secrets ?? "{}"} onChange={onSecretsChange} />
					</Tabs.Panel>
				)}
				{checks && (
					<Tabs.Panel id='checks' className='pt-4'>
						{checks}
					</Tabs.Panel>
				)}
			</Tabs>
		</section>
	);
}
