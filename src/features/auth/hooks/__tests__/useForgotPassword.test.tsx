/**
 * Testes de integração de `useForgotPassword` (AC-11 — Recuperação de senha).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - Mock do módulo `@/lib/supabase` para interceptar `resetPasswordForEmail`
 *   - QueryClientProvider isolado por teste (sem retry, sem cache leak)
 *
 * Por que mockar `supabase` diretamente em vez de MSW?
 *   O Supabase SDK usa vários endpoints e headers internos. Mockar o método
 *   `resetPasswordForEmail` é mais robusto e menos acoplado à implementação
 *   interna do SDK.
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: SEMPRE retorna mensagem genérica
 *     "Se o email existir, enviamos as instruções" — nunca revela se
 *     o email existe ou não no sistema (evita enumeração de contas).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import { useForgotPassword } from "@/features/auth/hooks/useForgotPassword";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

const mockResetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) =>
        mockResetPasswordForEmail(email, options),
    },
  },
}));

beforeEach(() => {
  mockResetPasswordForEmail.mockClear();
  mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderWithProviders<TResult>(callback: () => TResult) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );

  return { ...renderHook(callback, { wrapper }), queryClient: testQueryClient };
}

describe("useForgotPassword — AC-11 (Solicitação de reset)", () => {
  test("deve chamar resetPasswordForEmail com email fornecido", async () => {
    const { result } = renderWithProviders(() => useForgotPassword());

    await act(async () => {
      result.current.mutate({ email: "maria@exemplo.com" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      "maria@exemplo.com",
      expect.objectContaining({ redirectTo: expect.any(String) })
    );
  });

  test("deve retornar mensagem genérica mesmo quando Supabase retorna sucesso", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { result } = renderWithProviders(() => useForgotPassword());

    await act(async () => {
      result.current.mutate({ email: "existe@exemplo.com" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(AUTH_MESSAGES.FORGOT_PASSWORD_SUCCESS);
  });

  test("deve retornar mensagem genérica mesmo com erro do Supabase (Lei 9)", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: "User not found", status: 400 },
    });

    const { result } = renderWithProviders(() => useForgotPassword());

    await act(async () => {
      result.current.mutate({ email: "naoexiste@exemplo.com" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(AUTH_MESSAGES.FORGOT_PASSWORD_SUCCESS);
  });

  test("deve retornar isPending true durante a mutation", async () => {
    mockResetPasswordForEmail.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: {}, error: null }), 100)
        )
    );

    const { result } = renderWithProviders(() => useForgotPassword());

    act(() => {
      result.current.mutate({ email: "teste@exemplo.com" });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  test("deve normalizar email (trim + lowercase) antes de enviar", async () => {
    const { result } = renderWithProviders(() => useForgotPassword());

    await act(async () => {
      result.current.mutate({ email: "  MARIA@Exemplo.COM  " });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      "maria@exemplo.com",
      expect.any(Object)
    );
  });
});

describe("useForgotPassword — erros de rede", () => {
  test("deve propagar erro de rede como mensagem pt-BR", async () => {
    mockResetPasswordForEmail.mockRejectedValue(new Error("Network error"));

    const { result } = renderWithProviders(() => useForgotPassword());

    await act(async () => {
      result.current.mutate({ email: "teste@exemplo.com" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.NETWORK_ERROR);
  });
});
