/**
 * E2E-06: Fluxo de código de convite inválido
 *
 * Cenário: Usuário tenta entrar com código inválido e vê erro genérico.
 * Valida segurança (Lei 9 — mensagens de erro genéricas).
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-invalid-${Date.now()}@test.local`;
const TEST_PASSWORD = "Test123!@#";
const INVALID_CODE = "ZZZZZZ";

test.describe("E2E-06: Código Inválido", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Registrar usuário novo para ter acesso ao onboarding
    await page.goto("/register");
    await page.getByLabel(/e-mail/i).fill(TEST_EMAIL);
    await page.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });
  });

  test("código inexistente mostra erro genérico", async ({ page }) => {
    // 1. Ir para "Tenho um código"
    await page.getByRole("button", { name: /tenho um código/i }).click();

    // 2. Preencher com código inválido
    await page.getByLabel(/código de convite/i).fill(INVALID_CODE);

    // 3. Submeter
    await page.getByRole("button", { name: /^entrar$/i }).click();

    // 4. Verificar mensagem de erro genérica (não deve revelar se código existe)
    await expect(
      page.getByRole("alert")
    ).toBeVisible({ timeout: 5000 });
    
    // A mensagem deve ser genérica, não específica
    const alertText = await page.getByRole("alert").textContent();
    expect(alertText?.toLowerCase()).not.toContain("não encontrado");
    expect(alertText?.toLowerCase()).not.toContain("not found");
    
    // Deve conter mensagem de erro apropriada
    expect(
      alertText?.toLowerCase().includes("inválido") ||
      alertText?.toLowerCase().includes("expirado") ||
      alertText?.toLowerCase().includes("erro")
    ).toBe(true);

    // 5. Deve permanecer na página de onboarding
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("código com formato inválido mostra erro de validação", async ({ page }) => {
    await page.getByRole("button", { name: /tenho um código/i }).click();

    const codeInput = page.getByLabel(/código de convite/i);
    
    // Preencher com código muito curto
    await codeInput.fill("AB");
    
    // Blur para acionar validação
    await codeInput.blur();

    // Verificar erro de formato (validação client-side)
    await expect(
      page.getByText(/6 caracteres|formato.*inválido/i)
    ).toBeVisible();
  });

  test("código vazio é rejeitado na submissão", async ({ page }) => {
    await page.getByRole("button", { name: /tenho um código/i }).click();

    // Não preencher nada, apenas submeter
    await page.getByRole("button", { name: /^entrar$/i }).click();

    // Verificar erro de campo obrigatório
    await expect(
      page.getByText(/obrigatório|preencha|required/i)
    ).toBeVisible();

    // Deve permanecer na página
    await expect(page).toHaveURL(/\/onboarding/);
  });
});
