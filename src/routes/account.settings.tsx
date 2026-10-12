import { usePostHog } from "@posthog/react";
import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";

import { Card, CardContent } from "#/components/ui/card";
import {
	THEME_VALUES,
	type ThemeChoice,
	themeLabel,
} from "#/features/theme/theme";
import { useThemeChoice } from "#/features/theme/use-theme";

export const Route = createFileRoute("/account/settings")({
	component: SettingsPage,
});

const THEME_ICONS = {
	system: Monitor,
	light: Sun,
	dark: Moon,
} as const satisfies Record<ThemeChoice, unknown>;

/** The settings page: currently the theme choice, shared with the header. */
function SettingsPage() {
	return (
		<section className="flex flex-col gap-8">
			<header className="flex flex-col gap-4">
				<span className="w-fit rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--kicker)] uppercase">
					Preferences
				</span>
				<h1 className="text-balance font-display text-4xl leading-tight font-bold">
					Settings
				</h1>
				<p className="text-lg text-muted-foreground">
					Choose how Skild looks to you.
				</p>
			</header>
			<ThemeSettings />
		</section>
	);
}

/** The three way theme control, reflecting and setting the same value as the header. */
function ThemeSettings() {
	const { choice, setChoice } = useThemeChoice();
	const posthog = usePostHog();

	function choose(value: ThemeChoice) {
		setChoice(value);
		posthog.capture("theme_changed", { theme: value });
	}

	return (
		<Card>
			<CardContent>
				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 text-base font-semibold">Theme</legend>
					{THEME_VALUES.map((value) => {
						const Icon = THEME_ICONS[value];
						return (
							<label
								className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm"
								key={value}
							>
								<input
									checked={choice === value}
									className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
									name="theme"
									onChange={() => choose(value)}
									type="radio"
									value={value}
								/>
								<Icon aria-hidden="true" className="size-4" />
								{themeLabel(value)}
							</label>
						);
					})}
					<p className="mt-2 text-sm text-muted-foreground">
						System follows your device setting.
					</p>
				</fieldset>
			</CardContent>
		</Card>
	);
}
