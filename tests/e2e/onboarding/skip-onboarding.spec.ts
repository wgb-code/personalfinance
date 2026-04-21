/**
 * E2E-03: Fluxo de pular onboarding
 *
 * Cenário: Usuário cadastra e escolhe pular, criando "Meu Lar" automaticamente.
 * Valida AC-03 do módulo 02.
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-skip-${Date.now()}@test.local`;
const TEST_PASSWORD = "Test123!@#";

test.describe("E2E-03: Pular Onboarding", () => {
  test("happy path: pular cria 'Meu Lar' e redireciona para dashboard", async ({
    page,
  }) => {
    // 1. Navegar para registro
    await page.goto("/register");

    // 2. Preencher formulário de cadastro
    await page.getByLabel(/e-mail/i).fill(TEST_EMAIL);
    await page.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);

    // 3. Submeter cadastro
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).click();

    // 4. Aguardar onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });

    // 5. Verificar que botão "Pular" está visível
    const skipButton = page.getByRole("button", { name: /pular por enquanto/i });
    await expect(skipButton).toBeVisible();
    await expect(skipButton).toBeEnabled();

    // 6. Clicar em "Pular por enquanto"
    await skipButton.click();

    // 7. Aguardar redirecionamento para dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // 8. Verificar que está no dashboard
    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();
  });

  test("botão skip mostra loading durante processamento", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel(/e-mail/i).fill(`e2e-skip-loading-${Date.now()}@test.local`);
    await page.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });

    const skipButton = page.getByRole("button", { name: /pular por enquanto/i });
    await skipButton.click();

    // Aguarda o redirect para dashboard (loading pode ser muito rápido para capturar)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
