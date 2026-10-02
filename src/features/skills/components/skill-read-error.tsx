import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Spinner } from "#/components/ui/spinner";
import { cn } from "#/lib/utils";

/**
 * The error state for a failed skill read.
 *
 * The message is the one the read returned, so the page never invents its own
 * account of what went wrong, and the retry is disabled with a spinner while it
 * runs so a second press cannot start a second read.
 */
export function SkillReadError({
	title,
	message,
	onRetry,
	retrying,
	className,
}: {
	title?: string;
	message: string;
	onRetry: () => void;
	retrying: boolean;
	className?: string;
}) {
	return (
		<Alert className={cn("max-w-2xl", className)} variant="destructive">
			<CircleAlert aria-hidden="true" />
			{title === undefined ? null : <AlertTitle>{title}</AlertTitle>}
			<AlertDescription>{message}</AlertDescription>
			<div className="col-start-2 mt-2">
				<Button
					disabled={retrying}
					onClick={onRetry}
					size="sm"
					variant="outline"
				>
					{retrying ? (
						<>
							<Spinner aria-hidden="true" data-icon="inline-start" />
							Trying
						</>
					) : (
						"Try again"
					)}
				</Button>
			</div>
		</Alert>
	);
}
