import { usePostHog } from "@posthog/react";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "#/components/ui/button";
import { nextThemeChoice, themeLabel } from "#/features/theme/theme";
import { useThemeChoice } from "#/features/theme/use-theme";

const ICONS = {
	system: Monitor,
	light: Sun,
	dark: Moon,
} as const;

/**
 * The header's theme control: one icon button that cycles system, light, dark.
 *
 * The accessible name states the current choice, so an icon only control still
 * tells a screen reader user what is set.
 */
export function ThemeToggle() {
	const { choice, setChoice } = useThemeChoice();
	const posthog = usePostHog();
	const Icon = ICONS[choice];
	const next = nextThemeChoice(choice);

	return (
		<Button
			aria-label={`Theme: ${themeLabel(choice)}`}
			onClick={() => {
				setChoice(next);
				posthog.capture("theme_changed", { theme: next });
			}}
			size="icon-sm"
			title={`Switch to ${themeLabel(next)} theme`}
			type="button"
			variant="ghost"
		>
			<Icon aria-hidden="true" />
		</Button>
	);
}
