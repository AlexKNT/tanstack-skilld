/**
 * The one name shown for an actor Clerk no longer knows.
 *
 * A departed moderator is not a broken skill, so a row that carries an id
 * nobody can resolve is shown under this label rather than failing. It lives in
 * its own module so both the author's own list and the admin list read the same
 * words, and neither has to import the other's server code.
 */
export const UNRESOLVED_ACTOR_NAME = "A former member";
