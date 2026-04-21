/**
 * E2E-01: Fluxo completo de criação de household
 *
 * Cenário: Novo usuário cadastra, passa pelo onboarding e cria household.
 * Valida AC-01, AC-02, AC-04 do módulo 02.
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-create-${Date.now()}@test.local`;
const TEST_PASSWORD = "Test123!@#";
const HOUSEHOLD_NAME = "Casa Teste E2E";

test.describe("E2E-01: Criar Household", () => {
  test("happy path: cadastro → onboarding → criar household → dashboard", async ({
    page,
  }) => {
    // 1. Navegar para registro
    await page.goto("/register");
    await expect(page).toHaveURL(/\/register/);

    // 2. Preencher formulário de cadastro
    await page.getByLabel(/e-mail/i).fill(TEST_EMAIL);
    await page.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);
    
    // 3. Submeter cadastro
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).click();

    // 4. Aguardar redirecionamento para onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });

    // 5. Verificar página de onboarding
    await expect(
      page.getByRole("heading", { name: /bem-vindo/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /criar meu household/i })
    ).toBeVisible();

    // 6. Clicar em "Criar meu household"
    await page.getByRole("button", { name: /criar meu household/i }).click();

    // 7. Verificar formulário de criação
    await expect(page.getByLabel(/nome do household/i)).toBeVisible();

    // 8. Preencher nome do household
    await page.getByLabel(/nome do household/i).fill(HOUSEHOLD_NAME);

    // 9. Submeter formulário
    await page.getByRole("button", { name: /^criar$/i }).click();

    // 10. Aguardar redirecionamento para dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // 11. Verificar que está no dashboard
    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();
  });

  test("valida nome do household: rejeita vazio", async ({ page }) => {
    // Presume usuário já autenticado sem household
    await page.goto("/onboarding");
    
    // Ir para criar household
    await page.getByRole("button", { name: /criar meu household/i }).click();
    
    // Tentar submeter sem preencher
    await page.getByRole("button", { name: /^criar$/i }).click();

    // Verificar mensagem de erro
    await expect(
      page.getByText(/nome.*obrigatório|preencha.*nome/i)
    ).toBeVisible();
    
    // Deve permanecer na mesma página
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("valida nome do household: rejeita muito curto", async ({ page }) => {
    await page.goto("/onboarding");
    
    await page.getByRole("button", { name: /criar meu household/i }).click();
    
    // Preencher com nome muito curto
    await page.getByLabel(/nome do household/i).fill("AB");
    await page.getByRole("button", { name: /^criar$/i }).click();

    // Verificar mensagem de erro de tamanho mínimo
    await expect(
      page.getByText(/pelo menos|mínimo.*caracteres/i)
    ).toBeVisible();
  });
});
