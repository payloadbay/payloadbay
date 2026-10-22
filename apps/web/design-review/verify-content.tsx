import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, CodeBlock } from "@components/ui/content";
import { Agenda } from "@components/ui/agenda";

const markdown = renderToStaticMarkup(<Markdown>{"<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))\n\n**Safe content**"}</Markdown>);
assert(!markdown.includes("<script"));
assert(!markdown.includes("onerror"));
assert(!markdown.includes("javascript:"));
assert(markdown.includes("<strong>Safe content</strong>"));
const code = renderToStaticMarkup(<CodeBlock code={'</code><script>alert("test")</script>'} lineNumbers />);
assert(!code.includes("<script"));
assert(code.includes("&lt;script&gt;"));
assert(code.includes('aria-hidden="true">1</span>'));

const fenced = renderToStaticMarkup(<Markdown>{'```typescript\nconst safe = "<script>";\n```\n\nfirst line\nsecond line'}</Markdown>);
assert(fenced.includes('class="pb-code-block"'));
assert(fenced.includes('aria-label="Copy code"'));
assert(fenced.includes("<br"));
assert(!fenced.includes("<script>"));

// Overlap chains must share a consistent lane width even when one event ends early.
const at = (hour: number, minute = 0) => new Date(2026, 9, 20, hour, minute);

const events = [
	{
		id: "a",
		title: "A",
		start: at(9),
		end: at(10),
	},
	{
		id: "b",
		title: "B",
		start: at(9, 30),
		end: at(11),
	},
	{
		id: "c",
		title: "C",
		start: at(10),
		end: at(10, 30),
	},
	{
		id: "d",
		title: "D",
		start: at(10, 15),
		end: at(11),
	},
	{
		id: "e",
		title: "E",
		start: at(13),
		end: at(14),
	},
];
const agenda = renderToStaticMarkup(<Agenda events={events} date={at(9)} view='day' />);
const geometry = [...agenda.matchAll(/class="pb-agenda-event"[^>]*style="([^"]+)"/g)].map((match) => {
	const leftMatch = match[1].match(/left:calc\(([^%]+)%/);
	assert(leftMatch);
	const left = Number(leftMatch[1]);
	const widthMatch = match[1].match(/width:calc\(([^%]+)%/);
	assert(widthMatch);
	const width = Number(widthMatch[1]);

	return { left, width };
});
assert.equal(geometry.length, 5);
for (const entry of geometry.slice(0, 4)) assert(Math.abs(entry.width - 100 / 3) < 0.01);
assert.equal(geometry[4].width, 100);
console.log("PASS escaped code, safe Markdown URLs/raw HTML, and chained calendar overlap geometry.");
