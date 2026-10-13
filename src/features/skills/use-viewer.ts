import { useUser } from "@clerk/tanstack-react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { skillKeys } from "./query";

/**
 * The signed in viewer's id, as the root route resolved it on the server.
 *
 * The reads that answer per viewer are keyed by this value, so the component
 * and the loader that seeded it have to read the same source. The root route's
 * shell is not a normal route component, so this reads the root match's context
 * rather than calling a route hook.
 */
export function useSkillViewerId(): string | undefined {
	return useRouterState({
		select: (state) => {
			const context = state.matches[0]?.context as
				| { viewerId?: unknown }
				| undefined;

			return typeof context?.viewerId === "string"
				? context.viewerId
				: undefined;
		},
	});
}

/**
 * Keeps the viewer's reads honest when someone signs in or out.
 *
 * The header signs in through a dialog with no navigation at all, so nothing
 * else refreshes the skill data at that moment, and a page read for the person
 * who used the browser before would otherwise stay on screen with their vote
 * state. Invalidating the whole key family covers every viewer segment, so the
 * reads refetch against the session that now exists.
 *
 * The first answer from Clerk is the state the page was rendered with rather
 * than a change, so it is recorded and not acted on.
 */
export function useSkillViewerCacheSync(): void {
	const { isLoaded, isSignedIn, user } = useUser();
	const queryClient = useQueryClient();
	const seenViewer = useRef<string | null | undefined>(undefined);

	useEffect(() => {
		if (!isLoaded) {
			return;
		}

		const viewer =
			isSignedIn && user !== undefined && user !== null ? user.id : null;

		if (seenViewer.current === undefined) {
			seenViewer.current = viewer;
			return;
		}

		if (seenViewer.current === viewer) {
			return;
		}

		seenViewer.current = viewer;
		void queryClient.invalidateQueries({ queryKey: skillKeys.all });
	}, [isLoaded, isSignedIn, queryClient, user]);
}
