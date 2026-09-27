/**
 * The result of an action that can fail in ways the caller is expected to
 * handle: a read that never found a row, a payload that broke the rules, a
 * store that is momentarily unreachable. Failures are returned, not thrown, so
 * one caller can render the message and the rest of the app stays simple.
 */
export type Failure<Code extends string = string> = {
	ok: false;
	code: Code;
	message: string;
	field?: string;
};

/** The success half of a {@link Result}. */
export type Success<Value> = {
	ok: true;
	value: Value;
};

/** Either a success carrying a value, or a returned failure. */
export type Result<Value, Code extends string = string> =
	| Success<Value>
	| Failure<Code>;

/** Wraps a value as a successful {@link Result}. */
export function ok<Value>(value: Value): Success<Value> {
	return { ok: true, value };
}

/** Wraps a failure as a {@link Failure} result. */
export function fail<Code extends string>(
	code: Code,
	message: string,
	field?: string,
): Failure<Code> {
	return field === undefined
		? { ok: false, code, message }
		: { ok: false, code, message, field };
}
