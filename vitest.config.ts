import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";

/**
 * Configuração Vitest com 2 projetos:
 * - "unit"    → roda em Node (jsdom): schemas, hooks com mocks, lógica pura
 * - "browser" → roda em browser real via Playwright provider: componentes React
 *
 * E2E completo fica no Playwright (playwright.config.ts), separado.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.stories.{ts,tsx}",
        "src/**/*.test.{ts,tsx}",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: [
            "tests/unit/**/*.test.{ts,tsx}",
            "tests/integration/**/*.test.{ts,tsx}",
            "src/**/*.test.{ts,tsx}",
          ],
          exclude: ["tests/components/**", "tests/e2e/**"],
          setupFiles: ["./tests/setup/unit.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["tests/components/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/setup/browser.setup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
