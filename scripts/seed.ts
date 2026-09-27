import { insertSkillWithSlug, listSkillSlugs } from "../src/db/queries";
import { slugify } from "../src/features/skills/slug";

/**
 * Loads a small set of believable skills so the catalogue has content before
 * the publish form exists.
 *
 * Safe to run twice: a slug that is already stored is skipped rather than
 * replaced, so an existing row keeps its id and its original creation time.
 * The author is left empty on purpose, so no fake Clerk user id is invented.
 */

/** A day, in milliseconds, used to stagger the sample rows' creation times. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const SAMPLE_SKILLS = [
	{
		name: "PDF Reader",
		summary:
			"Reads a PDF from a URL and answers questions about its contents, with page numbers for every claim.",
		description:
			"# PDF Reader\n\nPoint it at a PDF and ask questions in plain language.\n\n- Reads a document from a public URL\n- Answers with the page each answer came from\n- Says so plainly when the answer is not in the document\n",
		installUrl: "https://example.com/skills/pdf-reader",
	},
	{
		name: "Commit Message Writer",
		summary:
			"Turns a staged diff into a short commit message that says what changed and why.",
		description:
			"# Commit Message Writer\n\nGive it a staged diff and it writes a message you would not mind reading in a year.\n\n- One short subject line\n- A body only when the change needs one\n- Never invents work that is not in the diff\n",
		installUrl: "https://example.com/skills/commit-message-writer",
	},
	{
		name: "SQL Explainer",
		summary:
			"Walks through a slow query line by line and suggests the index that would help.",
		description:
			"# SQL Explainer\n\nPaste a query and get a plain language walk through of what it does and where it spends its time.\n\n- Explains each clause in order\n- Points at the column that wants an index\n- Flags a query that reads more rows than it returns\n",
	},
	{
		name: "Accessibility Checker",
		summary:
			"Reviews a page against the WCAG AA rules that catch the most people out, and says how to fix each one.",
		description:
			"# Accessibility Checker\n\nA pass over the failures that actually reach users.\n\n- Colour contrast below 4.5:1\n- Controls with no accessible name\n- Focus you cannot see\n- Anything reachable by mouse but not by keyboard\n",
		installUrl: "https://example.com/skills/accessibility-checker",
	},
	{
		name: "Changelog Drafter",
		summary:
			"Reads the commits since the last release and drafts a changelog a person would want to read.",
		description:
			"# Changelog Drafter\n\nGroups the work since the last tag into what changed for the person using the software.\n\n- Leads with what a user notices\n- Keeps the diff level detail out\n- Links each entry to its commit\n",
	},
	{
		name: "Regex Translator",
		summary:
			"Takes a regular expression and explains it in words, one piece at a time.",
		description:
			"# Regex Translator\n\nA regular expression is fine until it is not. This one talks you through it.\n\n- Explains each group in order\n- Points out the parts that will backtrack badly\n- Shows the input that would break it\n",
		installUrl: "https://example.com/skills/regex-translator",
	},
	{
		name: "Meeting Notes Summariser",
		summary:
			"Turns a raw transcript into decisions, owners, and dates, and drops the rest.",
		description:
			"# Meeting Notes Summariser\n\nA transcript is not a record. This turns one into the record.\n\n- Lists each decision made\n- Names who owns each action\n- Keeps the date and drops the small talk\n",
	},
	{
		name: "Test Case Suggester",
		summary:
			"Reads a function and proposes the cases a test suite keeps missing, starting with the edges.",
		description:
			"# Test Case Suggester\n\nGiven a function, it proposes the cases that tend to be forgotten.\n\n- The empty and the single item case\n- Values at and past each boundary\n- The failure the function returns rather than throws\n",
		installUrl: "https://example.com/skills/test-case-suggester",
	},
] as const;

async function main() {
	const existing = new Set(await listSkillSlugs());

	if (existing.size > 0) {
		console.log(
			`Found ${existing.size} skill(s) already stored. Existing rows are left untouched.`,
		);
	}

	let inserted = 0;
	let skipped = 0;

	for (const [index, sample] of SAMPLE_SKILLS.entries()) {
		const slug = slugify(sample.name);

		if (existing.has(slug)) {
			skipped += 1;
			continue;
		}

		// Staggered so the newest first order in the catalogue is real rather
		// than a tie broken by id. The last sample is the newest.
		const createdAt = new Date(
			Date.now() - (SAMPLE_SKILLS.length - 1 - index) * ONE_DAY_MS,
		);

		const result = await insertSkillWithSlug(slug, {
			name: sample.name,
			summary: sample.summary,
			description: sample.description,
			installUrl: "installUrl" in sample ? sample.installUrl : undefined,
			createdAt,
		});

		if (!result.ok) {
			console.error(`Could not seed "${sample.name}": ${result.message}`);
			process.exitCode = 1;
			return;
		}

		if (result.value === undefined) {
			// The slug appeared between the lookup and the insert, which the
			// unique rule caught. The row is already there, so move on.
			skipped += 1;
			continue;
		}

		existing.add(slug);
		inserted += 1;
		console.log(`Seeded "${sample.name}" as ${slug}`);
	}

	console.log(`Seed done: ${inserted} added, ${skipped} already present.`);
}

main().catch((error) => {
	console.error("The seed could not run:", error);
	process.exitCode = 1;
});
