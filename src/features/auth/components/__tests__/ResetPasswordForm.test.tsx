/**
 * Testes do componente `ResetPasswordForm` (AC-12).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - @testing-library/react para renderização e eventos
 *   - Mock de hooks (useResetPassword)
 *
 * Verificações de segurança:
 *   - **Lei 1 (Never trust client)**: token é gerenciado pelo SDK Supabase,
 *     não manipulado pelo componente.
 *   - **Lei 9 (Exposição mínima)**: erros genéricos em pt-BR
 *   - **Lei 10 (XSS)**: mensagens renderizadas via escape default do React
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, test, vi, beforeEach, type Mock } from "vitest";

import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

vi.mock("@/features/auth/hooks/useResetPassword", () => ({
  useResetPassword: vi.fn(),
}));

import { useResetPassword } from "@/features/auth/hooks/useResetPassword";

function renderResetPasswordForm() {
  return render(
    <BrowserRouter>
      <ResetPasswordForm />
    </BrowserRouter>
  );
}

describe("ResetPasswordForm — AC-12 (Reset de senha via link)", () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useResetPassword as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  describe("Renderização inicial", () => {
    test("deve renderizar título e subtítulo em pt-BR", () => {
      renderResetPasswordForm();

      expect(screen.getByText(AUTH_MESSAGES.RESET_PASSWORD_TITLE)).toBeInTheDocument();
      expect(screen.getByText(AUTH_MESSAGES.RESET_PASSWORD_SUBTITLE)).toBeInTheDocument();
    });

    test("deve renderizar campos de nova senha e confirmação", () => {
      renderResetPasswordForm();

      expect(screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_NEW_LABEL)).toBeInTheDocument();
      expect(screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_CONFIRM_LABEL)).toBeInTheDocument();
    });

    test("deve renderizar botão de submit com texto correto", () => {
      renderResetPasswordForm();

      expect(screen.getByRole("button", { name: AUTH_MESSAGES.RESET_PASSWORD_SUBMIT })).toBeInTheDocument();
    });

    test("deve renderizar link para ir ao login", () => {
      renderResetPasswordForm();

      expect(screen.getByRole("link", { name: AUTH_MESSAGES.RESET_PASSWORD_GO_TO_LOGIN })).toBeInTheDocument();
    });
  });

  describe("Acessibilidade", () => {
    test("campos devem ter autocomplete=new-password", () => {
      renderResetPasswordForm();

      const newPasswordInput = screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_NEW_LABEL);
      const confirmInput = screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_CONFIRM_LABEL);

      expect(newPasswordInput).toHaveAttribute("autocomplete", "new-password");
      expect(confirmInput).toHaveAttribute("autocomplete", "new-password");
    });
  });

  describe("Submissão do formulário", () => {
    test("deve chamar mutate com dados corretos ao submeter", async () => {
      const user = userEvent.setup();
      renderResetPasswordForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_NEW_LABEL),
        "NovaSenha123"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_CONFIRM_LABEL),
        "NovaSenha123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.RESET_PASSWORD_SUBMIT }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          newPassword: "NovaSenha123",
          newPasswordConfirmation: "NovaSenha123",
        });
      });
    });
  });

  describe("Estado de loading", () => {
    test("deve exibir texto de loading e desabilitar botão quando isPending", () => {
      (useResetPassword as Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      renderResetPasswordForm();

      const button = screen.getByRole("button", { name: AUTH_MESSAGES.RESET_PASSWORD_SUBMITTING });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Tratamento de erros", () => {
    test("deve exibir mensagem de erro quando onError é chamado", async () => {
      let capturedOnError: (msg: string) => void = () => {};

      (useResetPassword as Mock).mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderResetPasswordForm();

      capturedOnError(AUTH_MESSAGES.WEAK_PASSWORD);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          AUTH_MESSAGES.WEAK_PASSWORD
        );
      });
    });

    test("erro deve ter role=alert para screen readers", async () => {
      let capturedOnError: (msg: string) => void = () => {};

      (useResetPassword as Mock).mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderResetPasswordForm();
      capturedOnError("Qualquer erro");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    test("erro deve ser limpo ao submeter novamente", async () => {
      const user = userEvent.setup();
      let capturedOnError: (msg: string) => void = () => {};

      (useResetPassword as Mock).mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderResetPasswordForm();

      capturedOnError("Erro inicial");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_NEW_LABEL),
        "NovaSenha123"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_CONFIRM_LABEL),
        "NovaSenha123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.RESET_PASSWORD_SUBMIT }));

      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });
    });
  });

  describe("Validação inline", () => {
    test("deve exibir erro para senha curta após blur", async () => {
      const user = userEvent.setup();
      renderResetPasswordForm();

      const passwordInput = screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_NEW_LABEL);
      await user.type(passwordInput, "123");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.PASSWORD_TOO_SHORT)).toBeInTheDocument();
      });
    });

    test("deve exibir erro para senha sem letra ou número após blur", async () => {
      const user = userEvent.setup();
      renderResetPasswordForm();

      const passwordInput = screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_NEW_LABEL);
      await user.type(passwordInput, "12345678");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.PASSWORD_WEAK)).toBeInTheDocument();
      });
    });

    test("deve exibir erro quando senhas não conferem", async () => {
      const user = userEvent.setup();
      renderResetPasswordForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_NEW_LABEL),
        "NovaSenha123"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.RESET_PASSWORD_CONFIRM_LABEL),
        "SenhaDiferente456"
      );

      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.RESET_PASSWORD_SUBMIT }));

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.PASSWORD_MISMATCH)).toBeInTheDocument();
      });
    });
  });
});
