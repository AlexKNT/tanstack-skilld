import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const config = defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	if (
		command === "build" &&
		mode === "production" &&
		!env.VITE_SITE_URL?.trim()
	) {
		throw new Error(
			"VITE_SITE_URL is missing. Set it to the site's public origin, for example https://skild.example.com, before building for production.",
		);
	}

	return {
		resolve: { tsconfigPaths: true },
		plugins: [
			devtools(),
			tailwindcss(),
			tanstackStart(),
			// The app has no edge functions, and their local emulation needs Deno.
			netlify({ dev: { edgeFunctions: { enabled: false } } }),
			viteReact(),
		],
	};
});

export default config;
