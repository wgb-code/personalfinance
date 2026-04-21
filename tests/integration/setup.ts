/**
 * Setup global para testes de integração com Supabase local.
 *
 * Requisitos:
 * - Supabase local rodando: `pnpm supabase start`
 * - Migrations aplicadas: `pnpm supabase db reset`
 */
import { beforeAll, afterAll, afterEach } from "vitest";
import { resetDb } from "./helpers/reset-db";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const HEALTH_CHECK_TIMEOUT = 5000;

async function checkSupabaseHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      signal: controller.signal,
      headers: {
        apikey:
          process.env.SUPABASE_ANON_KEY ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
      },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

beforeAll(async () => {
  const isHealthy = await checkSupabaseHealth();

  if (!isHealthy) {
    throw new Error(
      "\n" +
        "═══════════════════════════════════════════════════════════════\n" +
        "  ❌ Supabase local não está rodando!\n" +
        "═══════════════════════════════════════════════════════════════\n" +
        "\n" +
        "  Para rodar testes de integração, execute primeiro:\n" +
        "\n" +
        "    pnpm supabase start\n" +
        "\n" +
        "  Se é a primeira vez, também execute:\n" +
        "\n" +
        "    pnpm supabase db reset\n" +
        "\n" +
        "═══════════════════════════════════════════════════════════════\n"
    );
  }

  await resetDb();
});

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
});
