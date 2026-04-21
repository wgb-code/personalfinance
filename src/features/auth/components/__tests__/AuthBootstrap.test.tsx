/**
 * Testes do componente `AuthBootstrap` (AC-08, AC-09).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - @testing-library/react para renderização e eventos
 *   - Mock de hooks (useInitAuth, useIdleTimer, useLogout)
 *
 * Verificações de segurança:
 *   - **Lei 1 (Never trust client)**: sessão vem apenas do SDK Supabase via useInitAuth
 *   - **Lei 14 (Logging)**: logout em onSettled garante limpeza mesmo em falha
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach, type Mock } from "vitest";

import { AuthBootstrap } from "@/features/auth/components/AuthBootstrap";

vi.mock("@/features/auth/hooks/useInitAuth", () => ({
  useInitAuth: vi.fn(),
}));

vi.mock("@/features/auth/hooks/useIdleTimer", () => ({
  useIdleTimer: vi.fn(),
}));

vi.mock("@/features/auth/hooks/useLogout", () => ({
  useLogout: vi.fn(),
}));

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: vi.fn(),
  selectIsAuthenticated: vi.fn(),
}));

import { useInitAuth } from "@/features/auth/hooks/useInitAuth";
import { useIdleTimer } from "@/features/auth/hooks/useIdleTimer";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/stores/useAuthStore";

describe("AuthBootstrap — AC-08, AC-09", () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useInitAuth as Mock).mockReturnValue({
      isInitializing: false,
    });

    (useIdleTimer as Mock).mockImplementation(() => {});

    (useLogout as Mock).mockReturnValue({
      logout: mockLogout,
    });

    (useAuthStore as Mock).mockReturnValue(false);
  });

  describe("Estado de inicialização — AC-08", () => {
    test("deve exibir spinner enquanto isInitializing é true", () => {
      (useInitAuth as Mock).mockReturnValue({
        isInitializing: true,
      });

      render(
        <AuthBootstrap>
          <div>Conteúdo</div>
        </AuthBootstrap>
      );

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Carregando aplicação");
      expect(screen.queryByText("Conteúdo")).not.toBeInTheDocument();
    });

    test("deve renderizar children quando isInitializing é false", () => {
      (useInitAuth as Mock).mockReturnValue({
        isInitializing: false,
      });

      render(
        <AuthBootstrap>
          <div>Conteúdo da aplicação</div>
        </AuthBootstrap>
      );

      expect(screen.getByText("Conteúdo da aplicação")).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("Integração com useIdleTimer — AC-09", () => {
    test("deve registrar callback onIdle com useIdleTimer", () => {
      render(
        <AuthBootstrap>
          <div>Conteúdo</div>
        </AuthBootstrap>
      );

      expect(useIdleTimer).toHaveBeenCalledWith(
        expect.objectContaining({
          onIdle: expect.any(Function),
        })
      );
    });

    test("deve exibir SessionExpiredModal quando onIdle é chamado e usuário está autenticado", async () => {
      let capturedOnIdle: () => void = () => {};

      (useIdleTimer as Mock).mockImplementation(({ onIdle }) => {
        capturedOnIdle = onIdle;
      });

      (useAuthStore as Mock).mockReturnValue(true);

      render(
        <AuthBootstrap>
          <div>Conteúdo</div>
        </AuthBootstrap>
      );

      capturedOnIdle();

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Sessão expirada")).toBeInTheDocument();
      });
    });

    test("NÃO deve exibir SessionExpiredModal quando onIdle é chamado mas usuário não está autenticado", async () => {
      let capturedOnIdle: () => void = () => {};

      (useIdleTimer as Mock).mockImplementation(({ onIdle }) => {
        capturedOnIdle = onIdle;
      });

      (useAuthStore as Mock).mockReturnValue(false);

      render(
        <AuthBootstrap>
          <div>Conteúdo</div>
        </AuthBootstrap>
      );

      capturedOnIdle();

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    test("deve chamar logout quando usuário fecha o modal de sessão expirada", async () => {
      const user = userEvent.setup();
      let capturedOnIdle: () => void = () => {};

      (useIdleTimer as Mock).mockImplementation(({ onIdle }) => {
        capturedOnIdle = onIdle;
      });

      (useAuthStore as Mock).mockReturnValue(true);

      render(
        <AuthBootstrap>
          <div>Conteúdo</div>
        </AuthBootstrap>
      );

      capturedOnIdle();

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "OK" }));

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    test("deve fechar o modal após chamar logout", async () => {
      const user = userEvent.setup();
      let capturedOnIdle: () => void = () => {};

      (useIdleTimer as Mock).mockImplementation(({ onIdle }) => {
        capturedOnIdle = onIdle;
      });

      (useAuthStore as Mock).mockReturnValue(true);

      render(
        <AuthBootstrap>
          <div>Conteúdo</div>
        </AuthBootstrap>
      );

      capturedOnIdle();

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "OK" }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Integração com useInitAuth", () => {
    test("deve chamar useInitAuth no mount", () => {
      render(
        <AuthBootstrap>
          <div>Conteúdo</div>
        </AuthBootstrap>
      );

      expect(useInitAuth).toHaveBeenCalled();
    });
  });

  describe("Integração com useLogout", () => {
    test("deve chamar useLogout para obter função de logout", () => {
      render(
        <AuthBootstrap>
          <div>Conteúdo</div>
        </AuthBootstrap>
      );

      expect(useLogout).toHaveBeenCalled();
    });
  });
});
