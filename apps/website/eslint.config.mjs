import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfig from "../../packages/config/eslint.next.mjs";

export default defineConfig([
  ...eslintConfig,
  globalIgnores([
    "lib/api/**",
  ]),
]);
