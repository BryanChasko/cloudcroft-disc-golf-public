import path from "node:path";
import { defineConfig } from "vite";

// Served from https://bryanchasko.com/disc-golf/ (sibling prefix).
export default defineConfig({
  base: "/disc-golf/",
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
  },
});
