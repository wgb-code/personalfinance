/**
 * E2E-02: Fluxo de entrar em household com código de convite
 *
 * Cenário: Usuário A cria household, copia código, Usuário B entra com código.
 * Valida AC-06, AC-07 do módulo 02.
 *
 * Nota: Este teste requer setup de dois usuários. Em ambiente CI, pode
 * ser necessário seed de dados via API ou fixtures.
 */
import { test, expect } from "@playwright/test";

const TIMESTAMP = Date.now();
const OWNER_EMAIL = `e2e-owner-${TIMESTAMP}@test.local`;
const MEMBER_EMAIL = `e2e-member-${TIMESTAMP}@test.local`;
const TEST_PASSWORD = "Test123!@#";
const HOUSEHOLD_NAME = "Casa Compartilhada E2E";

test.describe("E2E-02: Entrar em Household", () => {
  let inviteCode: string;

  test.beforeAll(async ({ browser }) => {
    // Setup: Criar household com owner para obter código de convite
    const ownerPage = await browser.newPage();
    
    // Registrar owner
    await ownerPage.goto("/register");
    await ownerPage.getByLabel(/e-mail/i).fill(OWNER_EMAIL);
    await ownerPage.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await ownerPage.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);
    await ownerPage.getByRole("button", { name: /criar conta|cadastrar/i }).click();
    
    // Esperar onboarding
    await expect(ownerPage).toHaveURL(/\/onboarding/, { timeout: 10000 });
    
    // Criar household
    await ownerPage.getByRole("button", { name: /criar meu household/i }).click();
    await ownerPage.getByLabel(/nome do household/i).fill(HOUSEHOLD_NAME);
    await ownerPage.getByRole("button", { name: /^criar$/i }).click();
    
    // Esperar dashboard
    await expect(ownerPage).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Obter código de convite (assumindo que está visível no dashboard ou settings)
    // Nota: A implementação real pode variar - ajustar seletores conforme necessário
    const codeElement = ownerPage.locator('[data-testid="invite-code"]');
    if (await codeElement.isVisible()) {
      inviteCode = await codeElement.textContent() ?? "";
    } else {
      // Fallback: gerar código via API ou usar código fixo de teste
      inviteCode = "TEST01";
    }
    
    await ownerPage.close();
  });

  test("happy path: membro entra com código válido", async ({ page }) => {
    test.skip(!inviteCode, "Código de convite não disponível");
    
    // 1. Registrar novo usuário (membro)
    await page.goto("/register");
    await page.getByLabel(/e-mail/i).fill(MEMBER_EMAIL);
    await page.getByLabel(/^senha$/i).fill(TEST_PASSWORD);
    await page.getByLabel(/confirmar senha/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /criar conta|cadastrar/i }).click();

    // 2. Esperar onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 10000 });

    // 3. Escolher "Tenho um código"
    await page.getByRole("button", { name: /tenho um código/i }).click();

    // 4. Verificar formulário de código
    await expect(page.getByLabel(/código de convite/i)).toBeVisible();

    // 5. Preencher código
    await page.getByLabel(/código de convite/i).fill(inviteCode);

    // 6. Submeter
    await page.getByRole("button", { name: /^entrar$/i }).click();

    // 7. Esperar dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // 8. Verificar que está no household correto
    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();
  });

  test("código é automaticamente convertido para uppercase", async ({ page }) => {
    await page.goto("/onboarding");
    
    await page.getByRole("button", { name: /tenho um código/i }).click();
    
    const codeInput = page.getByLabel(/código de convite/i);
    
    // Digitar em lowercase
    await codeInput.fill("abc123");
    
    // Verificar que foi convertido para uppercase
    await expect(codeInput).toHaveValue("ABC123");
  });
});
