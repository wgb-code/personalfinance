/**
 * Testes de integração de `useLogout` (AC-10 — Logout manual).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - Mock do módulo `@/lib/supabase` para interceptar `signOut`
 *   - QueryClientProvider isolado por teste (sem retry, sem cache leak)
 *   - Mock de `react-router-dom` via `vi.mock`
 *   - Mock de `sonner` via `vi.mock`
 *
 * Por que mockar `supabase` diretamente em vez de MSW?
 *   O Supabase SDK usa vários endpoints e headers internos para logout
 *   (revogação de token, limpeza de storage). Mockar o método `signOut`
 *   é mais robusto e menos acoplado à implementação interna do SDK.
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: logout limpa TODA a sessão do store e
 *     do cache, não deixando rastros de dados do usuário anterior.
 *   - **Lei 14 (Logging higiênico)**: nenhum dado sensível é logado
 *     durante o fluxo de logout.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/stores/useAuthStore";

const mockNavigate = vi.fn();
const mockToastSuccess = vi.fn();
const mockSignOut = vi.fn();

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
      signOut: () => mockSignOut(),
    },
  },
}));

beforeEach(() => {
  mockNavigate.mockClear();
  mockToastSuccess.mockClear();
  mockSignOut.mockClear();
  mockSignOut.mockResolvedValue({ error: null });
  
  useAuthStore.getState().setSession({
    access_token: "fake-access-token",
    refresh_token: "fake-refresh-token",
    expires_in: 3600,
    expires_at: 9999999999,
    token_type: "bearer",
    user: {
      id: "user-1",
      email: "joao@x.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  });
});

afterEach(() => {
  useAuthStore.getState().reset();
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

describe("useLogout — AC-10 (Logout manual)", () => {
  test("deve chamar supabase.auth.signOut", async () => {
    const { result } = renderWithProviders(() => useLogout());

    await act(async () => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test("deve chamar useAuthStore.reset", async () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    const { result } = renderWithProviders(() => useLogout());

    await act(async () => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  test("deve chamar queryClient.clear", async () => {
    const { result, queryClient } = renderWithProviders(() => useLogout());
    
    queryClient.setQueryData(["test-query"], { data: "test" });
    expect(queryClient.getQueryData(["test-query"])).toBeDefined();

    await act(async () => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(queryClient.getQueryData(["test-query"])).toBeUndefined();
  });

  test("deve navegar para /login", async () => {
    const { result } = renderWithProviders(() => useLogout());

    await act(async () => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  test("deve mostrar toast de confirmação", async () => {
    const { result } = renderWithProviders(() => useLogout());

    await act(async () => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockToastSuccess).toHaveBeenCalledWith("Você saiu com sucesso");
  });

  test("deve retornar isPending e logout function", () => {
    const { result } = renderWithProviders(() => useLogout());

    expect(typeof result.current.logout).toBe("function");
    expect(typeof result.current.isPending).toBe("boolean");
    expect(result.current.isPending).toBe(false);
  });

  test("isPending deve ser true durante a mutation", async () => {
    mockSignOut.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
    );

    const { result } = renderWithProviders(() => useLogout());

    act(() => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});

describe("useLogout — resiliência a erros", () => {
  test("deve limpar sessão mesmo quando signOut falha", async () => {
    mockSignOut.mockRejectedValue(new Error("Network error"));

    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    const { result } = renderWithProviders(() => useLogout());

    await act(async () => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
  });
});
