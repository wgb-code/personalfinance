/**
 * Testes do componente `RegisterForm` (AC-01, AC-02).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - @testing-library/react para renderização e eventos
 *   - Mock de hooks (useRegister)
 *
 * Verificações de segurança:
 *   - **Lei 2 (Mass Assignment)**: schema .strict() testado em auth-schemas.test.ts
 *   - **Lei 9 (Exposição mínima)**: mensagens genéricas em erros
 *   - **Lei 10 (XSS)**: erros renderizados via escape default do React
 *   - **Lei 12 (Upload)**: AvatarUpload mockado (testado separadamente)
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, test, vi, beforeEach, type Mock } from "vitest";

import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

vi.mock("@/features/auth/hooks/useRegister", () => ({
  useRegister: vi.fn(),
}));

vi.mock("@/features/auth/components/AvatarUpload", () => ({
  AvatarUpload: ({ onChange, error }: { onChange: (file: File | null) => void; error?: string }) => (
    <div data-testid="avatar-upload-mock">
      <button type="button" onClick={() => onChange(null)}>Avatar Mock</button>
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

import { useRegister } from "@/features/auth/hooks/useRegister";

function renderRegisterForm() {
  return render(
    <BrowserRouter>
      <RegisterForm />
    </BrowserRouter>
  );
}

describe("RegisterForm — AC-01, AC-02", () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useRegister as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  describe("Renderização inicial", () => {
    test("deve renderizar título e subtítulo em pt-BR", () => {
      renderRegisterForm();

      expect(screen.getByRole("heading", { name: AUTH_MESSAGES.REGISTER_TITLE })).toBeInTheDocument();
      expect(screen.getByText(AUTH_MESSAGES.REGISTER_SUBTITLE)).toBeInTheDocument();
    });

    test("deve renderizar todos os campos obrigatórios", () => {
      renderRegisterForm();

      expect(screen.getByLabelText(AUTH_MESSAGES.REGISTER_FULL_NAME_LABEL)).toBeInTheDocument();
      expect(screen.getByLabelText(AUTH_MESSAGES.REGISTER_EMAIL_LABEL)).toBeInTheDocument();
      expect(screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_LABEL)).toBeInTheDocument();
      expect(screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_CONFIRM_LABEL)).toBeInTheDocument();
    });

    test("deve renderizar componente de avatar", () => {
      renderRegisterForm();

      expect(screen.getByTestId("avatar-upload-mock")).toBeInTheDocument();
    });

    test("deve renderizar hint do avatar", () => {
      renderRegisterForm();

      expect(screen.getByText(AUTH_MESSAGES.REGISTER_AVATAR_HINT)).toBeInTheDocument();
    });

    test("deve renderizar botão de submit com texto correto", () => {
      renderRegisterForm();

      expect(screen.getByRole("button", { name: AUTH_MESSAGES.REGISTER_SUBMIT })).toBeInTheDocument();
    });

    test("deve renderizar link para login", () => {
      renderRegisterForm();

      expect(screen.getByRole("link", { name: AUTH_MESSAGES.REGISTER_GO_TO_LOGIN })).toBeInTheDocument();
    });
  });

  describe("Acessibilidade", () => {
    test("campos devem ter autocomplete configurado", () => {
      renderRegisterForm();

      expect(screen.getByLabelText(AUTH_MESSAGES.REGISTER_FULL_NAME_LABEL)).toHaveAttribute("autocomplete", "name");
      expect(screen.getByLabelText(AUTH_MESSAGES.REGISTER_EMAIL_LABEL)).toHaveAttribute("autocomplete", "email");
      expect(screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_LABEL)).toHaveAttribute("autocomplete", "new-password");
      expect(screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_CONFIRM_LABEL)).toHaveAttribute("autocomplete", "new-password");
    });

    test("email deve ter inputMode=email para teclado mobile", () => {
      renderRegisterForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.REGISTER_EMAIL_LABEL);
      expect(emailInput).toHaveAttribute("inputMode", "email");
    });
  });

  describe("Submissão do formulário — AC-01", () => {
    test("deve chamar mutate com dados corretos ao submeter", async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_FULL_NAME_LABEL),
        "Maria Silva"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_EMAIL_LABEL),
        "maria@exemplo.com"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_LABEL),
        "Segura123"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_CONFIRM_LABEL),
        "Segura123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.REGISTER_SUBMIT }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "maria@exemplo.com",
            password: "Segura123",
            passwordConfirmation: "Segura123",
            fullName: "Maria Silva",
          }),
          expect.any(Object)
        );
      });
    });

    test("deve normalizar email para lowercase", async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_FULL_NAME_LABEL),
        "Maria"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_EMAIL_LABEL),
        "MARIA@EXEMPLO.COM"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_LABEL),
        "Segura123"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_CONFIRM_LABEL),
        "Segura123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.REGISTER_SUBMIT }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "maria@exemplo.com",
          }),
          expect.any(Object)
        );
      });
    });
  });

  describe("Estado de loading", () => {
    test("deve exibir texto de loading e desabilitar botão quando isPending", () => {
      (useRegister as Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      renderRegisterForm();

      const button = screen.getByRole("button", { name: AUTH_MESSAGES.REGISTER_SUBMITTING });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("Tratamento de erros", () => {
    test("deve exibir mensagem de erro quando mutate falha", async () => {
      const user = userEvent.setup();

      (useRegister as Mock).mockReturnValue({
        mutate: (_data: unknown, options: { onError: (e: Error) => void }) => {
          options.onError(new Error(AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED));
        },
        isPending: false,
      });

      renderRegisterForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_FULL_NAME_LABEL),
        "Maria"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_EMAIL_LABEL),
        "maria@exemplo.com"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_LABEL),
        "Segura123"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_CONFIRM_LABEL),
        "Segura123"
      );
      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.REGISTER_SUBMIT }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED
        );
      });
    });
  });

  describe("Validação inline — AC-02", () => {
    test("deve exibir erro para nome vazio após blur", async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const nameInput = screen.getByLabelText(AUTH_MESSAGES.REGISTER_FULL_NAME_LABEL);
      await user.click(nameInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.FULL_NAME_REQUIRED)).toBeInTheDocument();
      });
    });

    test("deve exibir erro para email inválido após blur", async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const emailInput = screen.getByLabelText(AUTH_MESSAGES.REGISTER_EMAIL_LABEL);
      await user.type(emailInput, "email-invalido");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.EMAIL_INVALID)).toBeInTheDocument();
      });
    });

    test("deve exibir erro para senha curta após blur", async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const passwordInput = screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_LABEL);
      await user.type(passwordInput, "123");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.PASSWORD_TOO_SHORT)).toBeInTheDocument();
      });
    });

    test("deve exibir erro para senha sem letra ou número após blur", async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      const passwordInput = screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_LABEL);
      await user.type(passwordInput, "12345678");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.PASSWORD_WEAK)).toBeInTheDocument();
      });
    });

    test("deve exibir erro quando senhas não conferem", async () => {
      const user = userEvent.setup();
      renderRegisterForm();

      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_LABEL),
        "Segura123"
      );
      await user.type(
        screen.getByLabelText(AUTH_MESSAGES.REGISTER_PASSWORD_CONFIRM_LABEL),
        "Diferente456"
      );

      await user.click(screen.getByRole("button", { name: AUTH_MESSAGES.REGISTER_SUBMIT }));

      await waitFor(() => {
        expect(screen.getByText(AUTH_MESSAGES.PASSWORD_MISMATCH)).toBeInTheDocument();
      });
    });
  });
});
