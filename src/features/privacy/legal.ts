/**
 * Who runs Skild.
 *
 * A placeholder: the person running the site fills this before it is public.
 */
export const LEGAL_OPERATOR = "[Operator name]";

/**
 * Where a legal request goes.
 *
 * A placeholder address: replace it with a real one before the site is public.
 */
export const LEGAL_CONTACT_EMAIL = "privacy@example.com";

/**
 * When the two pages took effect.
 *
 * Both forms are strings so the server render and the hydration cannot
 * disagree, and the `<time>` element carries the ISO one while the page shows
 * the other.
 */
export const LEGAL_EFFECTIVE_DATE = {
	iso: "2026-10-17",
	display: "17 October 2026",
} as const;

/** The banner's region label, so the notice is a named landmark. */
export const CONSENT_BANNER_REGION_LABEL = "Analytics choice";

/** The question the banner asks, exactly as the spec pins it. */
export const CONSENT_BANNER_SENTENCE =
	"We would like to use PostHog analytics to see how the site is used. Your theme and sign in storage are needed to run the site and are not part of this choice.";

/** The link that takes a visitor to the page explaining what is collected. */
export const CONSENT_BANNER_PRIVACY_LINK = "Read the privacy page";

/** The two answers, worded as the spec pins them. */
export const CONSENT_ACCEPT_LABEL = "Accept analytics";

/** The answer that leaves analytics off. */
export const CONSENT_DECLINE_LABEL = "Decline";

/** The footer link labels. */
export const FOOTER_LABELS = {
	privacy: "Privacy",
	terms: "Terms",
	cookieSettings: "Cookie settings",
} as const;

/** One section of a legal page: a heading and the paragraphs under it. */
export type LegalSection = {
	heading: string;
	paragraphs: readonly string[];
};

/** One legal page: its address, its head, and the sections it renders. */
export type LegalPageContent = {
	path: "/privacy" | "/terms";
	title: string;
	description: string;
	sections: readonly LegalSection[];
};

/** The privacy page: what the site stores, why, and how to change the answer. */
export const PRIVACY_PAGE: LegalPageContent = {
	path: "/privacy",
	title: "Privacy policy",
	description:
		"What Skild stores when you visit, why it stores it, and how to change your analytics choice.",
	sections: [
		{
			heading: "Who runs Skild",
			paragraphs: [
				`Skild is a community catalogue of AI agent skills, run by ${LEGAL_OPERATOR}. This page explains what the site stores when you visit, why it stores it, and what you can change.`,
				"Skills are published by the people who use the site, and they are installed on your own machine.",
			],
		},
		{
			heading: "Reading without an account",
			paragraphs: [
				"You can browse the catalogue, open a skill, and read this page without signing in. Nothing about that visit is sent to an analytics service unless you accept analytics.",
			],
		},
		{
			heading: "Storage the site needs",
			paragraphs: [
				"Two pieces of storage are needed for the site to work, so neither is part of the analytics choice.",
				"Clerk, our sign in provider, stores a session so that you stay signed in between pages and visits.",
				"A cookie named theme stores whether you chose the light theme, the dark theme, or the setting of your device.",
			],
		},
		{
			heading: "Analytics, only with your yes",
			paragraphs: [
				"We use PostHog, an analytics service, to understand how the site is used. It starts only after you choose Accept analytics. If you decline, or if you have not answered, no request is made to PostHog, no analytics script is loaded, and no identifier is written to your browser storage.",
				"When you accept, PostHog records the pages you open, the actions you take such as publishing a skill or casting an upvote, errors a page runs into, and some technical details about your browser.",
				"If you are signed in, PostHog also records your account identifier and your email address, so the events belong to one person rather than to a stranger.",
				"A search term you type into the catalogue filter is removed from every event before it leaves the browser.",
			],
		},
		{
			heading: "The cookie that holds your answer",
			paragraphs: [
				"A cookie named cookie-consent holds the word granted or the word denied, and nothing else. It lasts six months. When it expires, or when you clear it, the site asks again and analytics stays off until you answer.",
				"The Cookie settings control in the footer clears the answer and asks again. You can also clear cookies in your browser at any time, and the site will treat you as a visitor who has not answered.",
			],
		},
		{
			heading: "Your account and what you publish",
			paragraphs: [
				"Your account is held by Clerk. It stores your email address, your first and last name, and your profile photo.",
				"Skills you publish, the upvotes you cast, and the dates of both are stored in our database. A skill or a vote records your account identifier, so that the catalogue can show who published a skill and count each vote once.",
				"Your name and photo are not copied into our database. Every page that shows an author reads them from Clerk.",
			],
		},
		{
			heading: "Who processes what",
			paragraphs: [
				"Clerk runs sign in. PostHog runs analytics, and only after you accept. Our hosting provider runs the web server and the database.",
				"We do not sell data, and we do not share it for advertising.",
			],
		},
		{
			heading: "Seeing, correcting or deleting your data",
			paragraphs: [
				`Write to ${LEGAL_CONTACT_EMAIL} to ask what is stored about you, to correct it, or to ask for it to be deleted.`,
				"Deleting your account removes your sign in record. Your skills and votes are stored separately, so they are removed when you ask for it at the address above.",
			],
		},
		{
			heading: "Changes to this page",
			paragraphs: [
				"When this page changes, the effective date at the top changes with it. A wording change does not by itself turn analytics back on for someone who declined.",
			],
		},
	],
};

/** The terms page: the rules for using the site and publishing a skill. */
export const TERMS_PAGE: LegalPageContent = {
	path: "/terms",
	title: "Terms of use",
	description:
		"The rules for using Skild, publishing a skill, and what happens when a skill is hidden.",
	sections: [
		{
			heading: "Using Skild",
			paragraphs: [
				"By using Skild you agree to these terms. If you do not agree, please do not use the site.",
			],
		},
		{
			heading: "Your account",
			paragraphs: [
				"You need an account to publish a skill, to cast an upvote, or to manage what you have published. Keep your details accurate, and keep access to your email address secure.",
				"You are responsible for what happens under your account.",
			],
		},
		{
			heading: "What you publish",
			paragraphs: [
				"You keep ownership of the skills you publish. By publishing, you give Skild permission to display the skill, to show it in the catalogue and in search results, and to offer its install command to visitors.",
				"Publish only what you have the right to share, and say plainly what the skill does, because someone will run it on their own machine.",
			],
		},
		{
			heading: "What must not be published",
			paragraphs: [
				"Do not publish content that breaks the law, that you do not have the rights to, that impersonates someone else, or that is built to harm the machine it runs on. Do not use the site to send spam.",
			],
		},
		{
			heading: "Upvotes and moderation",
			paragraphs: [
				"Each person can upvote a skill once. A moderator may hide a skill that breaks these terms, or that no longer belongs in the catalogue. A hidden skill leaves the catalogue, and its page stops answering.",
				"We may remove content, and we may block an account that keeps breaking these terms.",
			],
		},
		{
			heading: "Availability",
			paragraphs: [
				"The site is provided as it is, with no promise that it stays online, that a skill stays published, or that a stored skill keeps working. Features may change or be removed.",
			],
		},
		{
			heading: "Liability",
			paragraphs: [
				"To the extent the law allows, Skild is not responsible for a skill you install, for what that skill does, or for indirect losses that come from using the site. Nothing here limits a liability that the law does not allow to be limited.",
			],
		},
		{
			heading: "Contact",
			paragraphs: [
				`Questions about these terms can go to ${LEGAL_CONTACT_EMAIL}.`,
			],
		},
		{
			heading: "Changes to these terms",
			paragraphs: [
				"The effective date at the top shows when these terms last changed. Continuing to use the site after a change means you accept the new terms.",
			],
		},
	],
};
