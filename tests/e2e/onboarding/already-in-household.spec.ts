/**
 * E2E-08: Redirect quando usuário já tem household
 *
 * Cenário: Usuário com household tenta acessar /onboarding e é redirecionado.
 * Valida RN-30 do módulo 02.
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-redirect-${Date.now()}@test.local`;
const TEST_PASSWORD = "Test123!@#";
const HOUSEHOLD_NAME = "Casa Redirect E2E";

test.describe("E2E-08: Redirect Usuário com Household", () => {
  test("usuário com household é redirecionado de /onboarding para /dashboard", async ({
    page,
  }) => {
    // 1. Registrar e criar household
    await page.goto("/register");
    await page.getByLabel(/e-mail/i).fill(TEST_EMAIL);
    await page.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });

    // 2. Criar household
    await page.getByRole("button", { name: /criar meu household/i }).click();
    await page.getByLabel(/nome do household/i).fill(HOUSEHOLD_NAME);
    await page.getByRole("button", { name: /^criar$/i }).click();

    // 3. Aguardar dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // 4. Tentar navegar diretamente para /onboarding
    await page.goto("/onboarding");

    // 5. Verificar redirect automático para dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });

    // 6. Não deve ver conteúdo de onboarding
    await expect(
      page.getByRole("heading", { name: /bem-vindo/i })
    ).not.toBeVisible();
  });

  test("usuário sem household pode acessar /onboarding normalmente", async ({
    page,
  }) => {
    // Registrar novo usuário
    const newEmail = `e2e-no-household-${Date.now()}@test.local`;
    
    await page.goto("/register");
    await page.getByLabel(/e-mail/i).fill(newEmail);
    await page.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).click();

    // Deve ir para onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });

    // Deve ver conteúdo de onboarding
    await expect(
      page.getByRole("heading", { name: /bem-vindo/i })
    ).toBeVisible();

    // Deve ver as opções
    await expect(
      page.getByRole("button", { name: /criar meu household/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /tenho um código/i })
    ).toBeVisible();
  });

  test("rotas protegidas redirecionam para login quando não autenticado", async ({
    page,
  }) => {
    // 1. Tentar acessar dashboard sem autenticação
    await page.goto("/dashboard");

    // 2. Deve ser redirecionado para login com redirectTo
    await expect(page).toHaveURL(/\/login\?redirectTo=/);

    // 3. Tentar acessar onboarding sem autenticação
    await page.goto("/onboarding");

    // 4. Deve ser redirecionado para login
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
  });

  test("após login, usuário é redirecionado para destino original", async ({
    page,
  }) => {
    // Primeiro, registrar um usuário e criar household
    const loginEmail = `e2e-login-redirect-${Date.now()}@test.local`;
    
    await page.goto("/register");
    await page.getByLabel(/e-mail/i).fill(loginEmail);
    await page.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });
    
    // Pular onboarding para ter household
    await page.getByRole("button", { name: /pular por enquanto/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Logout (se disponível) ou limpar sessão
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Tentar acessar /bills (rota protegida)
    await page.goto("/bills");

    // Deve redirecionar para login com redirectTo
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fbills/);

    // Fazer login
    await page.getByLabel(/e-mail/i).fill(loginEmail);
    await page.getByLabel(/senha/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();

    // Deve ir para /bills (destino original)
    await expect(page).toHaveURL(/\/bills/, { timeout: 10000 });
  });
});
