import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Configuração Vitest para testes de integração com Supabase local.
 *
 * Diferenças da config principal:
 * - Environment: Node (não jsdom) — testes são puramente API/DB
 * - Sem concorrência — evita conflitos de estado no DB
 * - Timeout maior — operações de DB podem demorar
 * - Setup próprio — health check do Supabase e reset entre testes
 */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/helpers/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ["tests/integration/setup.ts"],
    environment: "node",
    sequence: {
      concurrent: false,
    },
    isolate: false,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
