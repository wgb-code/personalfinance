/**
 * Testes de integração de `useCreateHousehold` (AC-01 + RN-28).
 *
 * Verifica:
 *   - Mutation chama RPC `create_household` via Supabase
 *   - `setHouseholdId` é chamado no onSuccess (setter controlado)
 *   - Query `current-household` é invalidada após sucesso
 *   - Erros de validação são mapeados para pt-BR
 *   - Campos extras são rejeitados pelo schema (Lei 2)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import type { ReactNode } from "react";

import { server } from "../../../../../tests/setup/msw.server";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCreateHousehold } from "@/features/onboarding/hooks/useCreateHousehold";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/lib/onboarding-constants";
import type { CreateHouseholdInput } from "@/features/onboarding/lib/onboarding-schemas";

const SUPABASE_URL = "http://localhost:54321";
const RPC_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/create_household`;

const SUCCESS_RESPONSE = {
  household_id: "hh-new-uuid",
  name: "Casa Silva",
  invite_code: "ABC123",
  invite_code_expires_at: "2026-04-23T14:30:00Z",
  role: "owner",
};

beforeAll(() => {
  vi.stubEnv("VITE_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  useAuthStore.getState().reset();
  useAuthStore.getState().setSession({
    access_token: "fake-token",
    refresh_token: "fake-refresh",
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
    token_type: "bearer",
    user: {
      id: "user-1",
      email: "maria@x.com",
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

function renderWithClient<TResult>(callback: () => TResult) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(callback, { wrapper }), queryClient };
}

describe("useCreateHousehold — caminho feliz (AC-01)", () => {
  test("cria household e chama setHouseholdId no sucesso", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(SUCCESS_RESPONSE, { status: 200 })
      )
    );

    const setHouseholdIdSpy = vi.spyOn(
      useAuthStore.getState(),
      "setHouseholdId"
    );

    const { result } = renderWithClient(() => useCreateHousehold());

    act(() => {
      result.current.mutate({ name: "Casa Silva" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(SUCCESS_RESPONSE);
    expect(useAuthStore.getState().householdId).toBe("hh-new-uuid");
    expect(setHouseholdIdSpy).toHaveBeenCalledWith("hh-new-uuid");

    setHouseholdIdSpy.mockRestore();
  });

  test("invalida query current-household após sucesso", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(SUCCESS_RESPONSE, { status: 200 })
      )
    );

    const { result, queryClient } = renderWithClient(() => useCreateHousehold());

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      result.current.mutate({ name: "Casa Silva" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["current-household"],
    });

    invalidateSpy.mockRestore();
  });

  test("aplica trim no nome antes de enviar", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(RPC_ENDPOINT, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(SUCCESS_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useCreateHousehold());

    act(() => {
      result.current.mutate({ name: "  Casa Silva  " });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const body = capturedBody as { p_name?: string };
    expect(body.p_name).toBe("Casa Silva");
  });
});

describe("useCreateHousehold — validação (AC-02)", () => {
  test("rejeita nome vazio sem chamar RPC", async () => {
    let rpcCalled = false;
    server.use(
      http.post(RPC_ENDPOINT, () => {
        rpcCalled = true;
        return HttpResponse.json(SUCCESS_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useCreateHousehold());

    act(() => {
      result.current.mutate({ name: "" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(rpcCalled).toBe(false);
    expect(result.current.error?.message).toBe(
      ONBOARDING_MESSAGES.HOUSEHOLD_NAME_REQUIRED
    );
    expect(useAuthStore.getState().householdId).toBeNull();
  });

  test("rejeita nome > 100 chars sem chamar RPC", async () => {
    let rpcCalled = false;
    server.use(
      http.post(RPC_ENDPOINT, () => {
        rpcCalled = true;
        return HttpResponse.json(SUCCESS_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useCreateHousehold());

    act(() => {
      result.current.mutate({ name: "a".repeat(101) });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(rpcCalled).toBe(false);
    expect(result.current.error?.message).toBe(
      ONBOARDING_MESSAGES.HOUSEHOLD_NAME_TOO_LONG
    );
  });
});

describe("useCreateHousehold — erros do RPC", () => {
  test("mapeia NAME_REQUIRED do RPC para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "NAME_REQUIRED", code: "P0001" },
          { status: 400 }
        )
      )
    );

    const { result } = renderWithClient(() => useCreateHousehold());

    act(() => {
      result.current.mutate({ name: "Casa" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      ONBOARDING_MESSAGES.HOUSEHOLD_NAME_REQUIRED
    );
  });

  test("mapeia GENERATION_FAILED do RPC para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "GENERATION_FAILED", code: "P0001" },
          { status: 500 }
        )
      )
    );

    const { result } = renderWithClient(() => useCreateHousehold());

    act(() => {
      result.current.mutate({ name: "Casa Silva" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      ONBOARDING_MESSAGES.GENERATION_FAILED
    );
  });
});

describe("useCreateHousehold — defesa em profundidade (Lei 2)", () => {
  test("rejeita campos extras no input sem chamar RPC", async () => {
    let rpcCalled = false;
    server.use(
      http.post(RPC_ENDPOINT, () => {
        rpcCalled = true;
        return HttpResponse.json(SUCCESS_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useCreateHousehold());

    act(() => {
      result.current.mutate({
        name: "Casa Silva",
        owner_id: "hacker-uuid",
      } as unknown as CreateHouseholdInput);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(rpcCalled).toBe(false);
    expect(useAuthStore.getState().householdId).toBeNull();
  });
});

describe("useCreateHousehold — setter controlado (RN-28)", () => {
  test("usa setHouseholdId, não setState direto", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(SUCCESS_RESPONSE, { status: 200 })
      )
    );

    const setStateSpy = vi.spyOn(useAuthStore, "setState");
    const setHouseholdIdSpy = vi.spyOn(
      useAuthStore.getState(),
      "setHouseholdId"
    );

    const { result } = renderWithClient(() => useCreateHousehold());

    act(() => {
      result.current.mutate({ name: "Casa Silva" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setHouseholdIdSpy).toHaveBeenCalledWith("hh-new-uuid");

    const setStateHouseholdCalls = setStateSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        "householdId" in (call[0] as Record<string, unknown>)
    );
    expect(setStateHouseholdCalls.length).toBe(0);

    setStateSpy.mockRestore();
    setHouseholdIdSpy.mockRestore();
  });
});
