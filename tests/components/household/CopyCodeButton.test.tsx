/**
 * Testes em browser-mode (Chromium real via @vitest/browser-playwright)
 * do `<CopyCodeButton />` — AC-27, AC-27.1.
 *
 * Verifica:
 *   - Clipboard API é chamada com código correto.
 *   - Feedback visual: ícone muda para ✓, label "Copiado!" por 2s.
 *   - Fallback: input readOnly com instrução.
 *   - aria-live="polite" para mudança de estado.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { CopyCodeButton } from "@/features/household/components/CopyCodeButton";

const TEST_CODE = "ABC123";

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe("<CopyCodeButton /> — AC-27: Clipboard API", () => {
  let clipboardSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: clipboardSpy },
    });
  });

  test("copia código para clipboard ao clicar", async () => {
    await render(<CopyCodeButton code={TEST_CODE} />);

    const button = page.getByRole("button", { name: /copiar código/i });
    await userEvent.click(button);

    expect(clipboardSpy).toHaveBeenCalledWith(TEST_CODE);
  });

  test("exibe feedback visual 'Copiado!' após copiar", async () => {
    await render(<CopyCodeButton code={TEST_CODE} />);

    const button = page.getByRole("button", { name: /copiar código/i });
    await userEvent.click(button);

    await expect.element(page.getByText("Copiado!")).toBeVisible();
  });

  test("tem aria-live='polite' no botão", async () => {
    await render(<CopyCodeButton code={TEST_CODE} />);

    const button = page.getByRole("button", { name: /copiar código/i });
    await expect.element(button).toHaveAttribute("aria-live", "polite");
  });

  test("volta ao estado original após 2s", async () => {
    vi.useFakeTimers();

    await render(<CopyCodeButton code={TEST_CODE} />);

    const button = page.getByRole("button", { name: /copiar código/i });
    await userEvent.click(button);

    await expect.element(page.getByText("Copiado!")).toBeVisible();

    await vi.advanceTimersByTimeAsync(2100);

    await expect.element(page.getByText(/copiar código/i)).toBeVisible();

    vi.useRealTimers();
  });
});

describe("<CopyCodeButton /> — AC-27.1: Fallback", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
  });

  test("exibe input readOnly quando clipboard não disponível", async () => {
    await render(<CopyCodeButton code={TEST_CODE} />);

    const button = page.getByRole("button", { name: /copiar código/i });
    await userEvent.click(button);

    const input = page.getByRole("textbox");
    await expect.element(input).toBeVisible();
    await expect.element(input).toHaveAttribute("readonly");
    await expect.element(input).toHaveValue(TEST_CODE);
  });

  test("exibe instrução de copiar manualmente", async () => {
    await render(<CopyCodeButton code={TEST_CODE} />);

    const button = page.getByRole("button", { name: /copiar código/i });
    await userEvent.click(button);

    await expect.element(page.getByText(/ctrl\+c.*cmd\+c/i)).toBeVisible();
  });
});
