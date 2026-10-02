import type * as React from "react";

import { cn } from "#/lib/utils";

/** The class shared by every text control the publish form renders. */
const CONTROL_CLASS =
	"w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:aria-invalid:ring-destructive/40";

export const publishFieldControlClass = cn(CONTROL_CLASS);

/**
 * One labelled control in the publish form.
 *
 * Hand built rather than composed from a primitive, because no `Label` or
 * `Input` component is installed in this project yet. The label, the hint and
 * the error are all wired to the control by id: `aria-describedby` names the
 * hint and the error, and `aria-invalid` marks the control when the server
 * refused it.
 */
export function PublishFormField({
	id,
	label,
	hint,
	error,
	children,
}: {
	id: string;
	label: string;
	hint: string;
	error: string | undefined;
	children: (describedBy: string, invalid: boolean) => React.ReactNode;
}) {
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;
	const describedBy = error === undefined ? hintId : `${hintId} ${errorId}`;

	return (
		<div className="flex flex-col gap-2">
			<label className="text-sm font-medium" htmlFor={id}>
				{label}
			</label>
			{children(describedBy, error !== undefined)}
			<p className="text-sm text-muted-foreground" id={hintId}>
				{hint}
			</p>
			{error === undefined ? null : (
				<p
					className="text-sm font-medium text-destructive"
					id={errorId}
					role="alert"
				>
					{error}
				</p>
			)}
		</div>
	);
}
