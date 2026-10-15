import { CircleAlert } from "lucide-react";
import { useId, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { publishFieldControlClass } from "#/features/skills/components/publish-form-field";
import { MAX_MODERATION_REASON_LENGTH } from "../schema";
import { useSetVisibility } from "../use-visibility";

/** Which way the dialog moves a skill. */
export type VisibilityAction = "hide" | "restore";

/** What a surface is told once a change has landed. */
export type VisibilityOutcome = {
	/** The state the skill holds now, which is the state asked for once it wrote. */
	visibility: "published" | "hidden";
	/** Whether this call changed anything; a repeat reports that it did not. */
	changed: boolean;
	/** The sentence a polite live region reads out, worded in one place only. */
	message: string;
};

/** The wording a caller is told after a change that wrote nothing. */
function unchangedMessage(name: string, held: VisibilityAction): string {
	return `${name} was already ${held === "hide" ? "hidden" : "published"}.`;
}

/** The wording a caller is told after a change that landed. */
function changedMessage(
	name: string,
	visibility: "published" | "hidden",
): string {
	return visibility === "hidden"
		? `${name} is hidden. It has left the catalogue.`
		: `${name} is published again.`;
}

/**
 * The one confirmation both surfaces open to hide or restore a skill.
 *
 * It owns the call, so the author's own card and the admin list cannot drift
 * apart, and it stays open on a refusal with the message beside the control the
 * person just used. A hide takes an optional reason and shows it to nobody but
 * the author; a restore takes none, because a reason describes the hide it was
 * written for.
 *
 * The outcome is reported upwards rather than announced here: the dialog closes
 * on success, so the live region that speaks belongs to the surface behind it.
 */
export function VisibilityDialog({
	slug,
	name,
	action,
	onDone,
}: {
	slug: string;
	name: string;
	action: VisibilityAction;
	onDone: (outcome: VisibilityOutcome) => void;
}) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [failure, setFailure] = useState<string | undefined>(undefined);
	const mutation = useSetVisibility();
	const fieldId = useId();
	const hintId = `${fieldId}-hint`;
	const reasonId = `${fieldId}-reason`;

	const hiding = action === "hide";
	const submittedReason = hiding ? reason.trim() : "";
	const reasonGiven = submittedReason !== "";

	function submit(): void {
		mutation.mutate(
			{
				slug,
				visibility: hiding ? "hidden" : "published",
				reason: reasonGiven ? submittedReason : undefined,
			},
			{
				onSuccess: (result) => {
					if (!result.ok) {
						setFailure(result.message);
						return;
					}

					setFailure(undefined);
					setReason("");
					setOpen(false);
					onDone({
						visibility: result.value.visibility,
						changed: result.value.changed,
						message: result.value.changed
							? changedMessage(name, result.value.visibility)
							: unchangedMessage(name, action),
					});
				},
			},
		);
	}

	return (
		<AlertDialog
			onOpenChange={(next) => {
				setOpen(next);

				if (!next) {
					setFailure(undefined);
					setReason("");
				}
			}}
			open={open}
		>
			<AlertDialogTrigger asChild>
				<Button
					aria-label={`${hiding ? "Hide" : "Restore"} ${name}`}
					size="sm"
					variant={hiding ? "outline" : "default"}
				>
					{hiding ? "Hide" : "Restore"}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{hiding ? "Hide this skill?" : "Restore this skill?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{hiding
							? `${name} leaves the catalogue and its own page, and stays here with the reason you give.`
							: `${name} returns to the catalogue at the address it already has.`}
					</AlertDialogDescription>
				</AlertDialogHeader>

				{hiding ? (
					<div className="flex flex-col gap-2">
						<label className="text-sm font-medium" htmlFor={reasonId}>
							Reason (optional)
						</label>
						<textarea
							aria-describedby={hintId}
							className={`${publishFieldControlClass} min-h-20 resize-y`}
							id={reasonId}
							maxLength={MAX_MODERATION_REASON_LENGTH * 2}
							name="reason"
							onChange={(event) => setReason(event.target.value)}
							rows={3}
							value={reason}
						/>
						<p className="text-sm text-muted-foreground" id={hintId}>
							Up to {MAX_MODERATION_REASON_LENGTH} characters. The author sees
							it here; nobody else does.
						</p>
					</div>
				) : null}

				{failure === undefined ? null : (
					<Alert variant="destructive">
						<CircleAlert aria-hidden="true" />
						<AlertTitle>That change was refused</AlertTitle>
						<AlertDescription>{failure}</AlertDescription>
					</Alert>
				)}

				<AlertDialogFooter>
					<AlertDialogCancel>
						{hiding ? "Keep it public" : "Leave it hidden"}
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={mutation.isPending}
						onClick={(event) => {
							event.preventDefault();
							submit();
						}}
					>
						{mutation.isPending
							? hiding
								? "Hiding"
								: "Restoring"
							: hiding
								? "Hide skill"
								: "Restore skill"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
