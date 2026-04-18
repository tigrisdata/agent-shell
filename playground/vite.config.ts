import { defineConfig } from "vite";

export default defineConfig({
	root: ".",
	build: {
		outDir: "dist",
		rollupOptions: {
			// Stub Node.js built-ins that just-bash's browser bundle references
			// but doesn't actually use at runtime for core operations
			external: [],
		},
	},
	resolve: {
		alias: {
			// Stub node:zlib — just-bash browser bundle references gunzipSync
			// for gzip command support, but we don't need it in the playground
			"node:zlib": new URL("./src/stubs/zlib.ts", import.meta.url).pathname,
		},
	},
});
