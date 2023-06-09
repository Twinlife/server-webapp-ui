import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
	server: {
		host: true,
	},
	plugins: [
		react(),
		checker({
			// e.g. use TypeScript check
			typescript: true,
		}),
		basicSsl(),
	],
});
