import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  shims: true,
  external: ["ink", "react", "openai", "@anthropic-ai/sdk", "@google/generative-ai", "chalk", "cli-cursor", "yaml"],
});
