import { Link } from "@tanstack/react-router";

import { Button } from "#/components/ui/button";
import { isAnalyticsConfigured } from "../analytics";
import {
	CONSENT_ACCEPT_LABEL,
	CONSENT_BANNER_PRIVACY_LINK,
	CONSENT_BANNER_REGION_LABEL,
	CONSENT_BANNER_SENTENCE,
	CONSENT_DECLINE_LABEL,
} from "../legal";
import { useConsentChoice } from "../use-consent";

/**
 * The analytics notice, shown until the visitor answers.
 *
 * It is a named region rather than a dialog: it never traps focus and never
 * blocks the page. The spacer above it keeps the last line of the page clear of
 * the bar, and both answers sit in the same variant and size so neither is
 * presented as the better one.
 */
export function ConsentBanner() {
	const { choice, accept, decline } = useConsentChoice();

	if (!isAnalyticsConfigured() || choice !== undefined) {
		return null;
	}

	return (
		<>
			<div aria-hidden="true" className="h-64 sm:h-28" />
			<section
				aria-label={CONSENT_BANNER_REGION_LABEL}
				className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-popover text-popover-foreground shadow-sm"
			>
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
					<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
						{CONSENT_BANNER_SENTENCE}{" "}
						<Link className="font-medium" to="/privacy">
							{CONSENT_BANNER_PRIVACY_LINK}
						</Link>
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<Button onClick={accept} size="sm" type="button" variant="outline">
							{CONSENT_ACCEPT_LABEL}
						</Button>
						<Button onClick={decline} size="sm" type="button" variant="outline">
							{CONSENT_DECLINE_LABEL}
						</Button>
					</div>
				</div>
			</section>
		</>
	);
}
