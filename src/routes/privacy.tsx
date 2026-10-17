import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "#/features/privacy/components/legal-page";
import { PRIVACY_PAGE } from "#/features/privacy/legal";
import { legalPageHead } from "#/features/seo/meta";
import { absoluteSiteUrl } from "#/features/seo/site";

/** The privacy page: what the site stores, why, and how to change the answer. */
export const Route = createFileRoute("/privacy")({
	head: () =>
		legalPageHead({
			title: PRIVACY_PAGE.title,
			description: PRIVACY_PAGE.description,
			url: absoluteSiteUrl(PRIVACY_PAGE.path),
		}),
	component: PrivacyPage,
});

function PrivacyPage() {
	return <LegalPage page={PRIVACY_PAGE} />;
}
