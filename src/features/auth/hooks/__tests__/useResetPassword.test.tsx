/**
 * Testes de integração de `useResetPassword` (AC-12 — Reset via link).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - Mock do módulo `@/lib/supabase` para interceptar `updateUser`
 *   - QueryClientProvider isolado por teste (sem retry, sem cache leak)
 *   - Mock de `react-router-dom` via `vi.mock`
 *   - Mock de `sonner` via `vi.mock`
 *
 * Por que mockar `supabase` diretamente em vez de MSW?
 *   O Supabase SDK usa vários endpoints e headers internos para update de
 *   senha. Mockar o método `updateUser` é mais robusto e menos acoplado
 *   à implementação interna do SDK.
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: erros do Supabase são mapeados via
 *     `mapAuthError` para mensagens pt-BR genéricas.
 *   - **Lei 1 (Never trust client)**: input passa por `resetPasswordSchema`
 *     antes de chegar ao Supabase.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { useResetPassword } from "@/features/auth/hooks/useResetPassword";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

const mockNavigate = vi.fn();
const mockToastSuccess = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => mockToastSuccess(message),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: (data: { password: string }) => mockUpdateUser(data),
    },
  },
}));

beforeEach(() => {
  mockNavigate.mockClear();
  mockToastSuccess.mockClear();
  mockUpdateUser.mockClear();
  mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });
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
    <MemoryRouter>
      <QueryClientProvider client={testQueryClient}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );

  return { ...renderHook(callback, { wrapper }), queryClient: testQueryClient };
}

describe("useResetPassword — AC-12 (Reset via link)", () => {
  test("deve chamar updateUser com nova senha", async () => {
    const { result } = renderWithProviders(() => useResetPassword());

    await act(async () => {
      result.current.mutate({
        newPassword: "NovaSenha123",
        newPasswordConfirmation: "NovaSenha123",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "NovaSenha123" });
  });

  test("deve navegar para /login após sucesso", async () => {
    const { result } = renderWithProviders(() => useResetPassword());

    await act(async () => {
      result.current.mutate({
        newPassword: "NovaSenha123",
        newPasswordConfirmation: "NovaSenha123",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  test("deve mostrar toast de sucesso após reset", async () => {
    const { result } = renderWithProviders(() => useResetPassword());

    await act(async () => {
      result.current.mutate({
        newPassword: "NovaSenha123",
        newPasswordConfirmation: "NovaSenha123",
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockToastSuccess).toHaveBeenCalledWith(
      AUTH_MESSAGES.RESET_PASSWORD_SUCCESS
    );
  });

  test("deve retornar error quando falha", async () => {
    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { message: "Invalid token", status: 400 },
    });

    const { result } = renderWithProviders(() => useResetPassword());

    await act(async () => {
      result.current.mutate({
        newPassword: "NovaSenha123",
        newPasswordConfirmation: "NovaSenha123",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("deve retornar isPending true durante a mutation", async () => {
    mockUpdateUser.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: { user: {} }, error: null }), 100)
        )
    );

    const { result } = renderWithProviders(() => useResetPassword());

    act(() => {
      result.current.mutate({
        newPassword: "NovaSenha123",
        newPasswordConfirmation: "NovaSenha123",
      });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});

describe("useResetPassword — validação de schema", () => {
  test("deve rejeitar senhas que não conferem", async () => {
    const { result } = renderWithProviders(() => useResetPassword());

    await act(async () => {
      result.current.mutate({
        newPassword: "NovaSenha123",
        newPasswordConfirmation: "SenhaDiferente123",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test("deve rejeitar senha fraca", async () => {
    const { result } = renderWithProviders(() => useResetPassword());

    await act(async () => {
      result.current.mutate({
        newPassword: "123",
        newPasswordConfirmation: "123",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe("useResetPassword — erros do Supabase", () => {
  test("deve mapear erro de senha fraca para pt-BR", async () => {
    mockUpdateUser.mockResolvedValue({
      data: null,
      error: { message: "Password should be at least 6 characters", status: 400 },
    });

    const { result } = renderWithProviders(() => useResetPassword());

    await act(async () => {
      result.current.mutate({
        newPassword: "NovaSenha123",
        newPasswordConfirmation: "NovaSenha123",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.WEAK_PASSWORD);
  });

  test("deve mapear erro de rede para pt-BR", async () => {
    mockUpdateUser.mockRejectedValue(new Error("Network error"));

    const { result } = renderWithProviders(() => useResetPassword());

    await act(async () => {
      result.current.mutate({
        newPassword: "NovaSenha123",
        newPasswordConfirmation: "NovaSenha123",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.NETWORK_ERROR);
  });
});
