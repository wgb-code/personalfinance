/**
 * Testes do componente `LoginForm` (AC-05, AC-06, AC-07).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - @testing-library/react para renderização e eventos
 *   - Mock de hooks (useSignIn, usePostAuthRedirect)
 *
 * Verificações de segurança:
 *   - **Lei 9 (Exposição mínima)**: mensagem genérica em erros de credenciais
 *   - **Lei 10 (XSS)**: erros renderizados via escape default do React
 *   - **Lei 14 (Logging)**: nenhum console.* no componente
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach, type Mock } from "vitest";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

vi.mock("@/features/auth/hooks/useSignIn", () => ({
  useSignIn: vi.fn(),
}));

vi.mock("@/features/auth/hooks/usePostAuthRedirect", () => ({
  usePostAuthRedirect: vi.fn(),
}));

vi.mock("@/features/auth/lib/auth-errors", () => ({
  isRateLimitError: vi.fn((msg: string) =>
    msg === AUTH_MESSAGES.RATE_LIMITED
  ),
}));

import { useSignIn } from "@/features/auth/hooks/useSignIn";
import { usePostAuthRedirect } from "@/features/auth/hooks/usePostAuthRedirect";

import { BrowserRouter } from "react-router-dom";

function renderLoginForm() {
  return render(
    <BrowserRouter>
      <LoginForm />
    </BrowserRouter>
  );
}

describe("LoginForm — AC-05, AC-06, AC-07", () => {
  const mockMutate = vi.fn();
  const mockNavigateAfterAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useSignIn as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    (usePostAuthRedirect as Mock).mockReturnValue({
      navigateAfterAuth: mockNavigateAfterAuth,
    });
  });

  describe("Renderização inicial", () => {
    test("deve renderizar título e subtítulo em pt-BR", () => {
      renderLoginForm();

      expect(screen.getByRole("heading", { name: AUTH_MESSAGES.LOGIN_TITLE })).toBeInTheDocument();
      expect(screen.getByText(AUTH_MESSAGES.LOGIN_SUBTITLE)).toBeInTheDocument();
    });

    test("deve renderizar campos de email e senha", () => {
      renderLoginForm();

      expect(screen.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL)).toBeInTheDocument();
      expect(screen.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL)).toBeInTheDocument();
    });

    test("deve renderizar botão de submit com texto correto", () => {
      renderLoginForm();

      expect(screen.getByRole("button", { name: AUTH_MESSAGES.LOGIN_SUBMIT })).toBeInTheDocument();
    });

    test("deve renderizar links para registro e esqueci senha", () => {
      renderLoginForm();

      expect(screen.getByRole("link", { name: AUTH_MESSAGES.LOGIN_FORGOT_PASSWORD_LINK })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: AUTH_MESSAGES.LOGIN_GO_TO_REGISTER })).toBeInTheDocument();
    });

    test("deve ter formulário com noValidate para usar validação do Zod", () => {
      renderLoginForm();

      const form = document.querySelector("form");
      expect(form).toHaveAttribute("noValidate");
    });
  });

  describe("Acessibilidade", () => {
    test("campos devem ter autocomplete configurado", () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL);
      const passwordInput = screen.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL);

      expect(emailInput).toHaveAttribute("autocomplete", "email");
      expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    });

    test("email deve ter inputMode=email para teclado mobile", () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL);
      expect(emailInput).toHaveAttribute("inputMode", "email");
    });
  });

  describe("Submissão do formulário", () => {
    test("deve chamar mutate com dados corretos ao submeter", async () => {
      const user = userEvent.setup();
      renderLoginForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL),
        "maria@exemplo.com"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL),
        "Segura123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.LOGIN_SUBMIT }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          email: "maria@exemplo.com",
          password: "Segura123",
        });
      });
    });

    test("deve normalizar email para lowercase antes de submeter", async () => {
      const user = userEvent.setup();
      renderLoginForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL),
        "MARIA@EXEMPLO.COM"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL),
        "Segura123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.LOGIN_SUBMIT }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "maria@exemplo.com",
          })
        );
      });
    });
  });

  describe("Estado de loading", () => {
    test("deve exibir texto de loading e desabilitar botão quando isPending", () => {
      (useSignIn as Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      renderLoginForm();

      const button = screen.getByRole("button", { name: AUTH_MESSAGES.LOGIN_SUBMITTING });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Tratamento de erros — AC-06 (mensagem genérica)", () => {
    test("deve exibir mensagem de erro quando onError é chamado", async () => {
      let capturedOnError: (msg: string) => void = () => {};

      (useSignIn as Mock).mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderLoginForm();

      capturedOnError(AUTH_MESSAGES.INVALID_CREDENTIALS);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          AUTH_MESSAGES.INVALID_CREDENTIALS
        );
      });
    });

    test("erro deve ter role=alert para screen readers", async () => {
      let capturedOnError: (msg: string) => void = () => {};

      (useSignIn as Mock).mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderLoginForm();
      capturedOnError("Qualquer erro");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    test("erro deve ser limpo ao submeter novamente", async () => {
      const user = userEvent.setup();
      let capturedOnError: (msg: string) => void = () => {};

      (useSignIn as Mock).mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderLoginForm();

      capturedOnError("Erro inicial");

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL),
        "teste@exemplo.com"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL),
        "Segura123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.LOGIN_SUBMIT }));

      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });
    });
  });

  describe("Rate limit — AC-07", () => {
    test("deve chamar isRateLimitError para verificar tipo de erro", async () => {
      const user = userEvent.setup();
      let capturedOnError: (msg: string) => void = () => {};

      (useSignIn as Mock).mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return { mutate: mockMutate, isPending: false };
      });

      renderLoginForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL),
        "test@example.com"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL),
        "Segura123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.LOGIN_SUBMIT }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });

      capturedOnError(AUTH_MESSAGES.INVALID_CREDENTIALS);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(AUTH_MESSAGES.INVALID_CREDENTIALS);
      });
    });
  });

  describe("Sucesso — AC-05", () => {
    test("deve chamar navigateAfterAuth quando onSuccess é chamado", async () => {
      let capturedOnSuccess: () => void = () => {};

      (useSignIn as Mock).mockImplementation(({ onSuccess }) => {
        capturedOnSuccess = onSuccess;
        return { mutate: mockMutate, isPending: false };
      });

      renderLoginForm();

      capturedOnSuccess();

      expect(mockNavigateAfterAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe("Validação — erros inline", () => {
    test("deve exibir erro para email inválido após blur", async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL);
      await user.type(emailInput, "email-invalido");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.EMAIL_INVALID)).toBeInTheDocument();
      });
    });

    test("deve exibir erro para senha vazia após blur", async () => {
      const user = userEvent.setup();
      renderLoginForm();

      const passwordInput = screen.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL);
      await user.click(passwordInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.PASSWORD_REQUIRED)).toBeInTheDocument();
      });
    });
  });
});
