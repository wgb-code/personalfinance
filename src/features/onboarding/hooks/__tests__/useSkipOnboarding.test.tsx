/**
 * Testes de integração de `useSkipOnboarding` (AC-09).
 *
 * O hook é um wrapper fino sobre `useCreateHousehold` que passa
 * o nome fixo "Meu Lar" (RN-16).
 *
 * Verificações:
 *   - Chama `create_household` com nome "Meu Lar"
 *   - `setHouseholdId` é chamado após sucesso
 *   - Cache invalidado corretamente
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import { useSkipOnboarding } from "../useSkipOnboarding";
import { useAuthStore } from "@/stores/useAuthStore";

const mockRpc = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (name: string, params: unknown) => mockRpc(name, params),
  },
}));

const mockHouseholdResponse = {
  household_id: "hh-uuid-solo",
  name: "Meu Lar",
  invite_code: "ABC234",
  invite_code_expires_at: "2026-04-23T14:30:00Z",
  role: "owner" as const,
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

describe("useSkipOnboarding — AC-09 (Pular cria household solo)", () => {
  test("deve chamar RPC create_household com nome 'Meu Lar'", async () => {
    const { result } = renderWithProviders(() => useSkipOnboarding());

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("create_household", {
      p_name: "Meu Lar",
    });
  });

  test("deve chamar setHouseholdId com o UUID retornado", async () => {
    const { result } = renderWithProviders(() => useSkipOnboarding());

    expect(useAuthStore.getState().householdId).toBeNull();

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(useAuthStore.getState().householdId).toBe("hh-uuid-solo");
  });

  test("deve invalidar query 'current-household' após sucesso", async () => {
    const { result } = renderWithProviders(() => useSkipOnboarding());

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["current-household"],
    });
  });

  test("mutateAsync deve funcionar corretamente", async () => {
    const { result } = renderWithProviders(() => useSkipOnboarding());

    let data: typeof mockHouseholdResponse | undefined;

    await act(async () => {
      data = await result.current.mutateAsync();
    });

    expect(data).toEqual(mockHouseholdResponse);
    expect(useAuthStore.getState().householdId).toBe("hh-uuid-solo");
  });

  test("deve retornar dados do household após sucesso", async () => {
    const { result } = renderWithProviders(() => useSkipOnboarding());

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockHouseholdResponse);
  });
});

describe("useSkipOnboarding — Tratamento de erros", () => {
  test("deve retornar erro quando RPC falha", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "GENERATION_FAILED" },
    });

    const { result } = renderWithProviders(() => useSkipOnboarding());

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      "Não foi possível gerar código, tente novamente."
    );
    expect(useAuthStore.getState().householdId).toBeNull();
  });
});
