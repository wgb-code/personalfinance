/**
 * Testes de integração de `useCurrentHousehold` (AC-13.1 + RN-28.1).
 *
 * Verifica:
 *   - Query chama RPC `get_current_household` via Supabase
 *   - `setHouseholdId` é chamado no onSuccess (setter controlado)
 *   - Query fica disabled quando não autenticado
 *   - Resposta com household_id: null não quebra o fluxo
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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
import { useCurrentHousehold } from "@/features/household/hooks/useCurrentHousehold";

const SUPABASE_URL = "http://localhost:54321";
const RPC_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/get_current_household`;

const HOUSEHOLD_RESPONSE = {
  household_id: "hh-uuid-123",
  name: "Casa Silva",
  role: "owner",
};

const NO_HOUSEHOLD_RESPONSE = {
  household_id: null,
  name: null,
  role: null,
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
  return renderHook(callback, { wrapper });
}

function simulateAuthenticated() {
  useAuthStore.getState().setSession({
    access_token: "fake-token",
    refresh_token: "fake-refresh",
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
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
}

describe("useCurrentHousehold — caminho feliz (AC-13.1)", () => {
  test("retorna household e chama setHouseholdId no sucesso", async () => {
    simulateAuthenticated();

    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(HOUSEHOLD_RESPONSE, { status: 200 })
      )
    );

    const setHouseholdIdSpy = vi.spyOn(
      useAuthStore.getState(),
      "setHouseholdId"
    );

    const { result } = renderWithClient(() => useCurrentHousehold());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(HOUSEHOLD_RESPONSE);
    expect(useAuthStore.getState().householdId).toBe("hh-uuid-123");
    expect(setHouseholdIdSpy).toHaveBeenCalledWith("hh-uuid-123");

    setHouseholdIdSpy.mockRestore();
  });

  test("trata resposta sem household (household_id: null)", async () => {
    simulateAuthenticated();

    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(NO_HOUSEHOLD_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useCurrentHousehold());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.household_id).toBeNull();
    expect(useAuthStore.getState().householdId).toBeNull();
  });
});

describe("useCurrentHousehold — query disabled", () => {
  test("não executa query quando não autenticado", async () => {
    let rpcCalled = false;
    server.use(
      http.post(RPC_ENDPOINT, () => {
        rpcCalled = true;
        return HttpResponse.json(HOUSEHOLD_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useCurrentHousehold());

    await new Promise((r) => setTimeout(r, 100));

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
    expect(rpcCalled).toBe(false);
  });
});

describe("useCurrentHousehold — erros", () => {
  test("propaga erro do RPC", async () => {
    simulateAuthenticated();

    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    const { result } = renderWithClient(() => useCurrentHousehold());

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(useAuthStore.getState().householdId).toBeNull();
  });
});

describe("useCurrentHousehold — setter controlado (RN-28)", () => {
  test("usa setHouseholdId, não setState direto", async () => {
    simulateAuthenticated();

    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(HOUSEHOLD_RESPONSE, { status: 200 })
      )
    );

    const setStateSpy = vi.spyOn(useAuthStore, "setState");
    const setHouseholdIdSpy = vi.spyOn(
      useAuthStore.getState(),
      "setHouseholdId"
    );

    const { result } = renderWithClient(() => useCurrentHousehold());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setHouseholdIdSpy).toHaveBeenCalledWith("hh-uuid-123");

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
