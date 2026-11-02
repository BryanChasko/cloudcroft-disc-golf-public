import path from "node:path";
import { defineConfig } from "vite";

// One slug: the map app lives under the story at
// https://bryanchasko.com/cloudcroft-disc-golf/app/
export default defineConfig({
  base: "/cloudcroft-disc-golf/app/",
  resolve: {
    alias: {
      // See src/shims/credential-providers.ts: keep Node-only credential
      // providers out of the browser bundle.
      "@aws-sdk/credential-providers": path.resolve(
        __dirname,
        "src/shims/credential-providers.ts",
      ),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      input: {
        main: "index.html",
        walk: "walk.html",
      },
    },
  },
});
