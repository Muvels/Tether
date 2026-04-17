import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "electron/main/index.ts",
    preload: "electron/preload/index.ts",
  },
  format: ["cjs"],
  platform: "node",
  target: "node20",
  outDir: "dist-electron",
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ["electron"],
});
