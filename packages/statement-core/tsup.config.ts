import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", testing: "src/pdf/fixture.ts" },
  format: ["esm"],
  // TypeScript 7's API is not yet compatible with rollup-plugin-dts, so
  // declarations are generated separately via `tsc --emitDeclarationOnly`.
  dts: false,
  sourcemap: true,
  clean: true,
});
