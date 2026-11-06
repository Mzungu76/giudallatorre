import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["packages/**/tests/**/*.test.ts", "worker/tests/**/*.test.ts"], environment: "node" } });
