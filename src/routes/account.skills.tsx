import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * A passthrough layout for `/account/skills`.
 *
 * It exists only so the list (`account.skills.index`) and the edit page
 * (`account.skills.$slug.edit`) can sit beside each other: without it the edit
 * page would nest inside the list and the list would render above the form.
 */
export const Route = createFileRoute("/account/skills")({
	component: SkillsLayout,
});

function SkillsLayout() {
	return <Outlet />;
}
