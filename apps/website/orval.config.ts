import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: "http://localhost:4000/docs/json",
    },
    output: {
      target: "./lib/api/generated.ts",
      client: "react-query",
      mode: "tags-split",
      override: {
        mutator: {
          path: "./lib/api/mutator.ts",
          name: "customInstance",
        },
      },
    },
  },
});
