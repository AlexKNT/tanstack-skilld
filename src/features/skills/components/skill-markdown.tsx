import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { cn } from "#/lib/utils";

/** Links may only use these, so a description cannot smuggle a script scheme. */
const ALLOWED_LINK_PROTOCOLS = ["http", "https", "mailto"];

/**
 * The sanitizer's rules: the default allow list, minus images so a description
 * cannot embed remote tracking content, with links narrowed to safe schemes.
 */
const skillSchema = {
	...defaultSchema,
	tagNames: (defaultSchema.tagNames ?? []).filter((tag) => tag !== "img"),
	protocols: { ...defaultSchema.protocols, href: ALLOWED_LINK_PROTOCOLS },
};

const HEADING_CLASS =
	"mt-8 mb-3 font-display font-semibold text-balance first:mt-0";

/**
 * Every markdown element mapped onto the design system's tokens rather than a
 * typography palette.
 *
 * Markdown headings are shifted down one level in this map (a markdown `h1`
 * renders as an `h2`, and so on), so a body can never emit a second `h1` beside
 * the page's own title.
 */
const components: Components = {
	h1: ({ children }) => (
		<h2 className={cn(HEADING_CLASS, "text-2xl")}>{children}</h2>
	),
	h2: ({ children }) => (
		<h3 className={cn(HEADING_CLASS, "text-xl")}>{children}</h3>
	),
	h3: ({ children }) => (
		<h4 className={cn(HEADING_CLASS, "text-lg")}>{children}</h4>
	),
	h4: ({ children }) => (
		<h5 className={cn(HEADING_CLASS, "text-base")}>{children}</h5>
	),
	h5: ({ children }) => (
		<h6 className={cn(HEADING_CLASS, "text-base")}>{children}</h6>
	),
	h6: ({ children }) => (
		<h6
			className={cn(
				HEADING_CLASS,
				"text-sm tracking-wide text-muted-foreground uppercase",
			)}
		>
			{children}
		</h6>
	),
	p: ({ children }) => (
		<p className="mb-4 leading-relaxed last:mb-0">{children}</p>
	),
	a: ({ children, href }) => (
		<a
			className="font-medium text-primary underline underline-offset-4"
			href={href}
			rel="noopener noreferrer"
			target="_blank"
		>
			{children}
		</a>
	),
	ul: ({ children }) => (
		<ul className="mb-4 list-disc space-y-1 pl-6 last:mb-0">{children}</ul>
	),
	ol: ({ children }) => (
		<ol className="mb-4 list-decimal space-y-1 pl-6 last:mb-0">{children}</ol>
	),
	li: ({ children }) => <li className="leading-relaxed">{children}</li>,
	blockquote: ({ children }) => (
		<blockquote className="mb-4 border-l-2 border-border pl-4 text-muted-foreground italic last:mb-0">
			{children}
		</blockquote>
	),
	hr: () => <hr className="my-8 border-border" />,
	pre: ({ children }) => (
		<pre className="mb-4 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-sm last:mb-0">
			{children}
		</pre>
	),
	table: ({ children }) => (
		<div className="mb-4 overflow-x-auto last:mb-0">
			<table className="w-full border-collapse text-sm">{children}</table>
		</div>
	),
	th: ({ children }) => (
		<th className="border-b border-border px-3 py-2 text-left font-semibold">
			{children}
		</th>
	),
	td: ({ children }) => (
		<td className="border-b border-border px-3 py-2 align-top">{children}</td>
	),
};

/**
 * Renders a skill's stored markdown description.
 *
 * The content is author supplied and therefore untrusted, so it always passes
 * through the sanitizer before it reaches the page, and every link opens in a
 * new tab with the opener severed.
 */
export function SkillMarkdown({ description }: { description: string }) {
	return (
		<div className="max-w-3xl text-base">
			<ReactMarkdown
				components={components}
				rehypePlugins={[[rehypeSanitize, skillSchema]]}
				remarkPlugins={[remarkGfm]}
			>
				{description}
			</ReactMarkdown>
		</div>
	);
}
