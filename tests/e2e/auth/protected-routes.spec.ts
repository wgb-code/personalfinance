import { test } from "@playwright/test";

/**
 * AC-13 — Protected routes (E2E completo).
 *
 * Stub deliberadamente SKIPPED até existir um ambiente Supabase
 * provisionado para os E2E (auth real, fluxo `signIn` → redirect),
 * o que ainda não foi montado neste turno.
 *
 * Cobertura unit + integração da mesma regra (RN-18 / RN-19) já vive em:
 *   - src/features/auth/lib/safe-redirect.test.ts
 *   - src/features/auth/components/ProtectedRoute.test.tsx
 *   - src/features/auth/hooks/usePostAuthRedirect.test.tsx
 *
 * TODO(infra-e2e): quando `pnpm test:e2e` puder subir o app contra
 * Supabase local (ou um stub server-side de auth), implementar:
 *   1. Visita anônima a /dashboard → espera URL `/login?redirectTo=%2Fdashboard`.
 *   2. Submeter credenciais válidas → espera URL final `/dashboard`.
 *   3. Visita a `/login?redirectTo=https%3A%2F%2Fevil.com` → após login,
 *      navega para `/` (fallback), nunca para evil.com.
 */
test.describe.skip("AC-13 protected routes (E2E)", () => {
  test("TODO: implementar quando ambiente Supabase E2E estiver up", () => {
    // intencionalmente vazio — o `.skip` no describe garante que a suíte
    // não falhe nem fique "verde por engano" antes da implementação real.
  });
});
