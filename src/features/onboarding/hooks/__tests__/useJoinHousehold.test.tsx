/**
 * Testes de integração de `useJoinHousehold` (AC-06, AC-07, AC-08.1).
 *
 * Verificações de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: código inválido vs expirado retorna
 *     mesma mensagem "Código inválido ou expirado".
 *   - **RN-15.1**: código normalizado para UPPERCASE antes do RPC.
 *   - **RN-28**: `setHouseholdId` chamado via setter controlado (não setState direto).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import { useJoinHousehold } from "../useJoinHousehold";
import { useAuthStore } from "@/stores/useAuthStore";

const mockRpc = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (name: string, params: unknown) => mockRpc(name, params),
  },
}));

const mockHouseholdResponse = {
  household_id: "hh-uuid-123",
  name: "Casa Silva",
  role: "member" as const,
};

let testQueryClient: QueryClient;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

beforeEach(() => {
  mockRpc.mockClear();
  mockInvalidateQueries.mockClear();
  useAuthStore.getState().reset();

  testQueryClient = createTestQueryClient();
  testQueryClient.invalidateQueries = mockInvalidateQueries;

  mockRpc.mockResolvedValue({
    data: mockHouseholdResponse,
    error: null,
  });
});

afterEach(() => {
  useAuthStore.getState().reset();
});

function renderWithProviders<TResult>(callback: () => TResult) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
  );

  return { ...renderHook(callback, { wrapper }), queryClient: testQueryClient };
}

describe("useJoinHousehold — AC-06 (Join com código válido)", () => {
  test("deve chamar RPC join_household com código normalizado UPPERCASE", async () => {
    const { result } = renderWithProviders(() => useJoinHousehold());

    await act(async () => {
      result.current.mutate({ code: "  abc123  " });
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("join_household", {
      p_code: "ABC123",
    });
  });

  test("deve chamar setHouseholdId com o UUID retornado", async () => {
    const { result } = renderWithProviders(() => useJoinHousehold());

    expect(useAuthStore.getState().householdId).toBeNull();

    await act(async () => {
      result.current.mutate({ code: "ABC123" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(useAuthStore.getState().householdId).toBe("hh-uuid-123");
  });

  test("deve invalidar query 'current-household' após sucesso", async () => {
    const { result } = renderWithProviders(() => useJoinHousehold());

    await act(async () => {
      result.current.mutate({ code: "ABC123" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["current-household"],
    });
  });

  test("deve retornar dados do household após sucesso", async () => {
    const { result } = renderWithProviders(() => useJoinHousehold());

    await act(async () => {
      result.current.mutate({ code: "ABC123" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockHouseholdResponse);
  });
});

describe("useJoinHousehold — AC-07 (Rejeitar código inválido ou expirado)", () => {
  test("deve retornar erro 'Código inválido ou expirado' para código inexistente", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "INVALID_OR_EXPIRED_CODE: code not found" },
    });

    const { result } = renderWithProviders(() => useJoinHousehold());

    await act(async () => {
      result.current.mutate({ code: "ZZZZZ9" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Código inválido ou expirado");
    expect(useAuthStore.getState().householdId).toBeNull();
  });

  test("deve retornar mesma mensagem para código expirado (Lei 9)", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "INVALID_OR_EXPIRED_CODE: code expired" },
    });

    const { result } = renderWithProviders(() => useJoinHousehold());

    await act(async () => {
      result.current.mutate({ code: "ABC123" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Código inválido ou expirado");
  });
});

describe("useJoinHousehold — AC-08.1 (Rejeitar se já pertence a household)", () => {
  test("deve retornar mensagem específica para ALREADY_MEMBER", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "ALREADY_MEMBER" },
    });

    const { result } = renderWithProviders(() => useJoinHousehold());

    await act(async () => {
      result.current.mutate({ code: "XYZ789" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      "Você já pertence a um household. Saia primeiro para entrar em outro."
    );
  });
});

describe("useJoinHousehold — Rate Limiting (AC-23)", () => {
  test("deve retornar mensagem de rate limit quando excedido", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "RATE_LIMITED" },
    });

    const { result } = renderWithProviders(() => useJoinHousehold());

    await act(async () => {
      result.current.mutate({ code: "ABC123" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      "Muitas tentativas. Aguarde 1 minuto."
    );
  });
});

describe("useJoinHousehold — Erro genérico", () => {
  test("deve retornar mensagem genérica para erros desconhecidos", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "some_unexpected_error" },
    });

    const { result } = renderWithProviders(() => useJoinHousehold());

    await act(async () => {
      result.current.mutate({ code: "ABC123" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      "Não foi possível concluir a operação. Tente novamente."
    );
  });
});
