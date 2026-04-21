/**
 * Testes do componente `ForgotPasswordForm` (AC-11).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - @testing-library/react para renderização e eventos
 *   - Mock de hooks (useForgotPassword)
 *
 * Verificações de segurança:
 *   - **Lei 9 (Exposição mínima)**: SEMPRE mostra mensagem genérica,
 *     independente do email existir ou não (evita enumeração de contas).
 *   - **Lei 10 (XSS)**: mensagens renderizadas via escape default do React
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, test, vi, beforeEach, type Mock } from "vitest";

import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

vi.mock("@/features/auth/hooks/useForgotPassword", () => ({
  useForgotPassword: vi.fn(),
}));

import { useForgotPassword } from "@/features/auth/hooks/useForgotPassword";

function renderForgotPasswordForm() {
  return render(
    <BrowserRouter>
      <ForgotPasswordForm />
    </BrowserRouter>
  );
}

describe("ForgotPasswordForm — AC-11 (Solicitação de reset)", () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useForgotPassword as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  describe("Renderização inicial", () => {
    test("deve renderizar título e subtítulo em pt-BR", () => {
      renderForgotPasswordForm();

      expect(screen.getByText(AUTH_MESSAGES.FORGOT_PASSWORD_TITLE)).toBeInTheDocument();
      expect(screen.getByText(AUTH_MESSAGES.FORGOT_PASSWORD_SUBTITLE)).toBeInTheDocument();
    });

    test("deve renderizar campo de email", () => {
      renderForgotPasswordForm();

      expect(screen.getByLabelText(AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_LABEL)).toBeInTheDocument();
    });

    test("deve renderizar botão de submit com texto correto", () => {
      renderForgotPasswordForm();

      expect(screen.getByRole("button", { name: AUTH_MESSAGES.FORGOT_PASSWORD_SUBMIT })).toBeInTheDocument();
    });

    test("deve renderizar link para voltar ao login", () => {
      renderForgotPasswordForm();

      expect(screen.getByRole("link", { name: AUTH_MESSAGES.FORGOT_PASSWORD_GO_TO_LOGIN })).toBeInTheDocument();
    });
  });

  describe("Acessibilidade", () => {
    test("campo email deve ter autocomplete configurado", () => {
      renderForgotPasswordForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_LABEL);
      expect(emailInput).toHaveAttribute("autocomplete", "email");
    });

    test("email deve ter inputMode=email para teclado mobile", () => {
      renderForgotPasswordForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_LABEL);
      expect(emailInput).toHaveAttribute("inputMode", "email");
    });
  });

  describe("Submissão do formulário", () => {
    test("deve chamar mutate com email ao submeter", async () => {
      const user = userEvent.setup();
      renderForgotPasswordForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_LABEL),
        "maria@exemplo.com"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.FORGOT_PASSWORD_SUBMIT }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          email: "maria@exemplo.com",
        });
      });
    });

    test("deve normalizar email para lowercase", async () => {
      const user = userEvent.setup();
      renderForgotPasswordForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_LABEL),
        "MARIA@EXEMPLO.COM"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.FORGOT_PASSWORD_SUBMIT }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          email: "maria@exemplo.com",
        });
      });
    });
  });

  describe("Estado de loading", () => {
    test("deve exibir texto de loading e desabilitar botão quando isPending", () => {
      (useForgotPassword as Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      renderForgotPasswordForm();

      const button = screen.getByRole("button", { name: AUTH_MESSAGES.FORGOT_PASSWORD_SUBMITTING });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Mensagem de sucesso — Lei 9 (mensagem genérica)", () => {
    test("deve exibir mensagem genérica de sucesso quando onSuccess é chamado", async () => {
      let capturedOnSuccess: (msg: string) => void = () => {};

      (useForgotPassword as Mock).mockImplementation(({ onSuccess }) => {
        capturedOnSuccess = onSuccess;
        return { mutate: mockMutate, isPending: false };
      });

      renderForgotPasswordForm();

      capturedOnSuccess(AUTH_MESSAGES.FORGOT_PASSWORD_SUCCESS);

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent(
          AUTH_MESSAGES.FORGOT_PASSWORD_SUCCESS
        );
      });
    });

    test("mensagem de sucesso deve ter role=status para screen readers", async () => {
      let capturedOnSuccess: (msg: string) => void = () => {};

      (useForgotPassword as Mock).mockImplementation(({ onSuccess }) => {
        capturedOnSuccess = onSuccess;
        return { mutate: mockMutate, isPending: false };
      });

      renderForgotPasswordForm();
      capturedOnSuccess(AUTH_MESSAGES.FORGOT_PASSWORD_SUCCESS);

      await waitFor(() => {
        expect(screen.getByRole("status")).toBeInTheDocument();
      });
    });
  });

  describe("Tratamento de erros (apenas rede)", () => {
    test("deve exibir mensagem de erro quando onError é chamado", async () => {
      let capturedOnError: (msg: string) => void = () => {};

      (useForgotPassword as Mock).mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderForgotPasswordForm();

      capturedOnError(AUTH_MESSAGES.NETWORK_ERROR);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          AUTH_MESSAGES.NETWORK_ERROR
        );
      });
    });

    test("erro deve ser limpo quando sucesso acontece", async () => {
      let capturedOnSuccess: (msg: string) => void = () => {};
      let capturedOnError: (msg: string) => void = () => {};

      (useForgotPassword as Mock).mockImplementation(({ onSuccess, onError }) => {
        capturedOnSuccess = onSuccess;
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderForgotPasswordForm();

      capturedOnError("Erro de rede");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      capturedOnSuccess(AUTH_MESSAGES.FORGOT_PASSWORD_SUCCESS);

      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toBeInTheDocument();
      });
    });
  });

  describe("Validação inline", () => {
    test("deve exibir erro para email inválido após blur", async () => {
      const user = userEvent.setup();
      renderForgotPasswordForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_LABEL);
      await user.type(emailInput, "email-invalido");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.EMAIL_INVALID)).toBeInTheDocument();
      });
    });

    test("deve exibir erro para email vazio após blur", async () => {
      const user = userEvent.setup();
      renderForgotPasswordForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_LABEL);
      await user.click(emailInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.EMAIL_INVALID)).toBeInTheDocument();
      });
    });
  });
});
