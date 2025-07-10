import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
// import checker from "vite-plugin-checker";

// https://vitejs.dev/config/
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
    server: {
        host: true,
        proxy: {
            '/rest': 'http://localhost:8081',
            '/p2p': {
                target: 'ws://localhost:8081',
                ws: true,
            }
        }
    },
    plugins: [
        svgr({
	    include: "src/assets/*.svg"
	}),
        react(),
        // checker({
            // e.g. use TypeScript check
        //    typescript: true,
        // }),
        // basicSsl(),
    ],
    build: {
        minify: 'esbuild'
    },
	define: {
		__APP_VERSION__: JSON.stringify(process.env.npm_package_version),
	},
});
