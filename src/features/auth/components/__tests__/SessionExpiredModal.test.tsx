/**
 * Testes do componente `SessionExpiredModal` (AC-09 — Auto-logout por inatividade).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - @testing-library/react para renderização e eventos
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: modal não exibe detalhes técnicos,
 *     apenas mensagem user-friendly em pt-BR.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SessionExpiredModal } from "@/features/auth/components/SessionExpiredModal";

describe("SessionExpiredModal — AC-09 (Auto-logout por inatividade)", () => {
  test("não deve renderizar quando isOpen é false", () => {
    render(<SessionExpiredModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("deve renderizar dialog quando isOpen é true", () => {
    render(<SessionExpiredModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("deve exibir mensagem de sessão expirada em pt-BR", () => {
    render(<SessionExpiredModal isOpen={true} onClose={vi.fn()} />);

    expect(
      screen.getByText("Sua sessão expirou por inatividade")
    ).toBeInTheDocument();
  });

  test("deve exibir botão OK", () => {
    render(<SessionExpiredModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  test("deve chamar onClose ao clicar no botão OK", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<SessionExpiredModal isOpen={true} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("deve ter aria-modal=true para acessibilidade", () => {
    render(<SessionExpiredModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  test("deve ter aria-labelledby apontando para o título", () => {
    render(<SessionExpiredModal isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby");

    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent(
      "Sessão expirada"
    );
  });

  test("deve renderizar overlay/backdrop", () => {
    render(<SessionExpiredModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId("modal-overlay")).toBeInTheDocument();
  });
});
