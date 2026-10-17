import { Fragment, type ReactNode } from "react";

import {
	LEGAL_CONTACT_EMAIL,
	LEGAL_EFFECTIVE_DATE,
	type LegalPageContent,
} from "../legal";

/**
 * Turns a paragraph that carries the contact address into text with a `mailto:`
 * link around it. The address is taken from the one constant, so the link text
 * and its target cannot drift apart.
 */
function withContactLink(text: string): ReactNode {
	const parts = text.split(LEGAL_CONTACT_EMAIL);

	if (parts.length === 1) {
		return text;
	}

	return (
		<>
			{parts[0]}
			{parts.slice(1).map((part) => (
				<Fragment key={part}>
					<a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
					{part}
				</Fragment>
			))}
		</>
	);
}

/**
 * The frame both legal pages render: one `h1`, the effective date under it, and
 * each section as an `h2` followed by its paragraphs.
 *
 * Both pages share the frame so heading order, spacing and the measure of the
 * text are written once.
 */
export function LegalPage({ page }: { page: LegalPageContent }) {
	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-16 sm:py-20">
			<header className="flex flex-col items-start gap-4">
				<span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
					Legal
				</span>
				<h1 className="max-w-2xl text-balance font-display text-4xl leading-tight font-bold sm:text-5xl">
					{page.title}
				</h1>
				<p className="text-sm text-muted-foreground">
					Effective{" "}
					<time dateTime={LEGAL_EFFECTIVE_DATE.iso}>
						{LEGAL_EFFECTIVE_DATE.display}
					</time>
				</p>
			</header>
			<div className="flex flex-col gap-8">
				{page.sections.map((section) => (
					<section className="flex flex-col gap-3" key={section.heading}>
						<h2 className="font-display text-2xl font-bold">
							{section.heading}
						</h2>
						{section.paragraphs.map((paragraph) => (
							<p
								className="leading-relaxed text-muted-foreground"
								key={paragraph}
							>
								{withContactLink(paragraph)}
							</p>
						))}
					</section>
				))}
			</div>
		</main>
	);
}
