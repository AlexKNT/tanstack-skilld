import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Spinner } from "#/components/ui/spinner";
import { publishFieldControlClass } from "#/features/skills/components/publish-form-field";
import { useDebouncedValue } from "#/hooks/use-debounced-value";
import { cn } from "#/lib/utils";

/**
 * The catalogue's search box.
 *
 * The box holds what is being typed and hands the settled value up; it never
 * writes the address itself, so there is one place in the page that writes it.
 * Its value follows the address, so a badge link, a shared link or Back leaves
 * the box and the address saying the same thing, and typing is never blanked by
 * a read that has not settled yet.
 */
export function SkillSearchBox({
	term,
	busy,
	onSettle,
}: {
	term: string | undefined;
	busy: boolean;
	onSettle: (term: string | undefined) => void;
}) {
	const inputId = useId();
	const hintId = `${inputId}-hint`;
	const current = term ?? "";
	const [typed, setTyped] = useState(current);
	const settledTyped = useDebouncedValue(typed);
	// Whether what is in the box is something the visitor typed and the address
	// has not been told about yet. Without it, an address changed from outside
	// the box (a badge, a shared link, the clear action) would be written back
	// with the value the box was showing a moment earlier.
	const typedByVisitor = useRef(false);

	// The settled value is the only thing written to the address, and only when
	// it says something the address does not already say.
	useEffect(() => {
		const next = settledTyped.trim();

		if (!typedByVisitor.current || next === current) {
			return;
		}

		typedByVisitor.current = false;
		onSettle(next === "" ? undefined : next);
	}, [current, onSettle, settledTyped]);

	// A change the box did not cause is copied in, so the box and the address
	// agree once a settle has passed.
	useEffect(() => {
		setTyped((typedValue) =>
			typedValue.trim() === current ? typedValue : current,
		);
	}, [current]);

	return (
		<div className="flex flex-col gap-2">
			<label className="text-sm font-medium" htmlFor={inputId}>
				Search skills
			</label>
			<div className="relative">
				<Search
					aria-hidden="true"
					className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<input
					aria-describedby={hintId}
					className={cn(publishFieldControlClass, "pl-9")}
					id={inputId}
					inputMode="search"
					onChange={(event) => {
						typedByVisitor.current = true;
						setTyped(event.target.value);
					}}
					type="search"
					value={typed}
				/>
				{busy ? (
					<span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
						<Spinner aria-hidden="true" />
					</span>
				) : null}
			</div>
			<p className="text-sm text-muted-foreground" id={hintId}>
				Searches the name, the summary and the description. The catalogue
				narrows as you type.
			</p>
		</div>
	);
}
