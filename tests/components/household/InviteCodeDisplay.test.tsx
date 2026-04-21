/**
 * Testes em browser-mode (Chromium real via @vitest/browser-playwright)
 * do `<InviteCodeDisplay />` — AC-03, AC-04.
 *
 * Verifica:
 *   - Código exibido em fonte grande.
 *   - Data de expiração em formato legível.
 *   - Sub-linha com tempo relativo.
 *   - Botão "Copiar código" sempre visível.
 *   - Botão "Regenerar código" apenas para owner.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";
import axe from "axe-core";

import { InviteCodeDisplay } from "@/features/household/components/InviteCodeDisplay";

const MOCK_CODE = "XYZ789";
const MOCK_EXPIRES_AT = new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString();

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe("<InviteCodeDisplay /> — AC-03: Exibição", () => {
  test("exibe código em fonte monospace grande", async () => {
    await render(
      <InviteCodeDisplay
        code={MOCK_CODE}
        expiresAt={MOCK_EXPIRES_AT}
        isOwner={false}
      />
    );

    const codeElement = page.getByText(MOCK_CODE);
    await expect.element(codeElement).toBeVisible();
    await expect.element(codeElement).toHaveClass("font-mono");
    await expect.element(codeElement).toHaveClass("text-[32px]");
  });

  test("exibe 'Válido até' com data formatada", async () => {
    await render(
      <InviteCodeDisplay
        code={MOCK_CODE}
        expiresAt={MOCK_EXPIRES_AT}
        isOwner={false}
      />
    );

    const expiryText = page.getByText(/válido até/i);
    await expect.element(expiryText).toBeVisible();
  });

  test("exibe sub-linha com tempo relativo '(em ~Xh)'", async () => {
    await render(
      <InviteCodeDisplay
        code={MOCK_CODE}
        expiresAt={MOCK_EXPIRES_AT}
        isOwner={false}
      />
    );

    const relativeText = page.getByText(/\(em ~\d+h\)/i);
    await expect.element(relativeText).toBeVisible();
  });

  test("exibe botão 'Copiar código' sempre", async () => {
    await render(
      <InviteCodeDisplay
        code={MOCK_CODE}
        expiresAt={MOCK_EXPIRES_AT}
        isOwner={false}
      />
    );

    const copyButton = page.getByRole("button", { name: /copiar código/i });
    await expect.element(copyButton).toBeVisible();
  });

  test("axe-core não reporta violações", async () => {
    const result = await render(
      <InviteCodeDisplay
        code={MOCK_CODE}
        expiresAt={MOCK_EXPIRES_AT}
        isOwner={false}
      />
    );

    const axeResults = await axe.run(result.container);
    expect(axeResults.violations).toEqual([]);
  });
});

describe("<InviteCodeDisplay /> — AC-04: Regenerar (owner)", () => {
  test("exibe botão 'Regenerar código' apenas para owner", async () => {
    const onRegenerate = vi.fn();

    await render(
      <InviteCodeDisplay
        code={MOCK_CODE}
        expiresAt={MOCK_EXPIRES_AT}
        isOwner={true}
        onRegenerate={onRegenerate}
      />
    );

    const regenerateButton = page.getByRole("button", {
      name: /regenerar código/i,
    });
    await expect.element(regenerateButton).toBeVisible();
  });

  test("NÃO exibe botão 'Regenerar código' para member", async () => {
    await render(
      <InviteCodeDisplay
        code={MOCK_CODE}
        expiresAt={MOCK_EXPIRES_AT}
        isOwner={false}
      />
    );

    const regenerateButton = page.getByRole("button", {
      name: /regenerar código/i,
    });
    await expect.element(regenerateButton).not.toBeInTheDocument();
  });
});

describe("<InviteCodeDisplay /> — Acessibilidade", () => {
  test("código tem aria-label com espaços para leitura", async () => {
    await render(
      <InviteCodeDisplay
        code={MOCK_CODE}
        expiresAt={MOCK_EXPIRES_AT}
        isOwner={false}
      />
    );

    const codeElement = page.getByText(MOCK_CODE);
    await expect
      .element(codeElement)
      .toHaveAttribute("aria-label", /código de convite.*x.*y.*z/i);
  });
});
