import { ExternalLink } from "lucide-react";

import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

/**
 * The install action for a skill.
 *
 * A skill with an install address opens it in a new tab, with the opener
 * severed so the target page cannot reach back into this one. A skill without
 * one shows the same control disabled rather than hiding it, so the card and
 * the detail page keep their shape.
 */
export function SkillInstallButton({
	installUrl,
	className,
}: {
	installUrl: string | undefined;
	className?: string;
}) {
	if (installUrl === undefined) {
		return (
			<Button className={className} disabled variant="outline">
				Install
			</Button>
		);
	}

	return (
		<Button asChild className={cn(className)} variant="outline">
			<a href={installUrl} rel="noopener noreferrer" target="_blank">
				Install
				<ExternalLink aria-hidden="true" />
			</a>
		</Button>
	);
}
