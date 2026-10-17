import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "#/features/privacy/components/legal-page";
import { TERMS_PAGE } from "#/features/privacy/legal";
import { legalPageHead } from "#/features/seo/meta";
import { absoluteSiteUrl } from "#/features/seo/site";

/** The terms page: the rules for using the site and publishing a skill. */
export const Route = createFileRoute("/terms")({
	head: () =>
		legalPageHead({
			title: TERMS_PAGE.title,
			description: TERMS_PAGE.description,
			url: absoluteSiteUrl(TERMS_PAGE.path),
		}),
	component: TermsPage,
});

function TermsPage() {
	return <LegalPage page={TERMS_PAGE} />;
}
