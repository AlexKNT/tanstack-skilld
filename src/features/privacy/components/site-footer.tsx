import { Link } from "@tanstack/react-router";

import { isAnalyticsConfigured } from "../analytics";
import { FOOTER_LABELS } from "../legal";
import { useConsentChoice } from "../use-consent";

/**
 * The footer on every page: the two legal links, and the control that forgets
 * an analytics answer and asks again.
 *
 * The reset control appears only in a build where analytics is configured,
 * because a build that asks nothing has nothing to reset.
 */
export function SiteFooter() {
	const { clear } = useConsentChoice();
	const linkClass = "py-2 font-medium";

	return (
		<footer className="border-t border-border">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm text-muted-foreground">
					Skild is a catalogue of AI agent skills shared by the community.
				</p>
				<nav
					aria-label="Legal"
					className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"
				>
					<Link className={linkClass} to="/privacy">
						{FOOTER_LABELS.privacy}
					</Link>
					<Link className={linkClass} to="/terms">
						{FOOTER_LABELS.terms}
					</Link>
					{isAnalyticsConfigured() ? (
						<button
							className="rounded-md py-2 font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							onClick={clear}
							type="button"
						>
							{FOOTER_LABELS.cookieSettings}
						</button>
					) : null}
				</nav>
			</div>
		</footer>
	);
}
