import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createMiddleware, createStart } from "@tanstack/react-start";

/**
 * Answers a server function call that produced no response.
 *
 * A server function request normally resolves to a response, and Clerk's
 * middleware appends its own response headers onto `result.response` once the
 * chain returns. A call that arrives without the `x-tsr-serverFn` header the
 * app's own client sends is answered with the bare value instead, so that
 * append reads a property of nothing and the request dies as an unhandled 500.
 * This middleware sits directly after Clerk's, so whatever the chain returns
 * reaches Clerk in the shape it expects, and a request the app client did not
 * send is refused by name rather than as an internal failure.
 */
const responseShapedResult = createMiddleware().server(async ({ next }) => {
	const result = await next();

	if (result instanceof Response || result.response !== undefined) {
		return result;
	}

	return {
		...result,
		response: new Response(
			JSON.stringify({
				status: 400,
				message: "This request did not come from the app client.",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		),
	};
});

export const startInstance = createStart(() => {
	return {
		requestMiddleware: [clerkMiddleware(), responseShapedResult],
	};
});
