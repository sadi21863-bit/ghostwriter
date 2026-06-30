import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    // Playwright owns e2e/ — keep vitest from picking up its *.spec.ts files.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
