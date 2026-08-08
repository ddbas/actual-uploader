import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/bin.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  external: ["playwright"],
});
