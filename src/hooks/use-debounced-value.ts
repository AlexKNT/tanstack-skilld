import { useEffect, useState } from "react";

/** How long typing has to pause before the catalogue's filter settles. */
export const FILTER_SETTLE_MS = 250;

/**
 * The value as it settles: it follows `value` once `delay` has passed with no
 * further change, so a fast typist produces one settled value rather than one
 * per keystroke.
 */
export function useDebouncedValue<Value>(
	value: Value,
	delay: number = FILTER_SETTLE_MS,
): Value {
	const [settled, setSettled] = useState(value);

	useEffect(() => {
		const timer = setTimeout(() => setSettled(value), delay);

		return () => clearTimeout(timer);
	}, [delay, value]);

	return settled;
}
