/**
 * Testes de integração de `useLeaveHousehold` (AC-11).
 *
 * Verifica:
 *   - Mutation chama RPC `leave_household` via Supabase
 *   - `setHouseholdId(null)` é chamado no sucesso
 *   - Queries dependentes de household são removidas
 *   - Erros são mapeados para pt-BR
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
import { useLeaveHousehold } from "@/features/household/hooks/useLeaveHousehold";
import { HOUSEHOLD_MESSAGES } from "@/features/household/lib/household-constants";

const SUPABASE_URL = "http://localhost:54321";
const RPC_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/leave_household`;

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
      email: "joao@x.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  });
  useAuthStore.getState().setHouseholdId("hh-1");
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

  queryClient.setQueryData(["household-members"], []);
  queryClient.setQueryData(["household-audit"], []);
  queryClient.setQueryData(["current-household"], { household_id: "hh-1" });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(callback, { wrapper }), queryClient };
}

describe("useLeaveHousehold — caminho feliz (AC-11)", () => {
  test("sai do household e chama setHouseholdId(null)", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () => HttpResponse.json(null, { status: 200 }))
    );

    const setHouseholdIdSpy = vi.spyOn(
      useAuthStore.getState(),
      "setHouseholdId"
    );

    const { result } = renderWithClient(() => useLeaveHousehold());

    expect(useAuthStore.getState().householdId).toBe("hh-1");

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setHouseholdIdSpy).toHaveBeenCalledWith(null);
    expect(useAuthStore.getState().householdId).toBeNull();

    setHouseholdIdSpy.mockRestore();
  });

  test("remove queries dependentes de household após sucesso", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () => HttpResponse.json(null, { status: 200 }))
    );

    const { result, queryClient } = renderWithClient(() => useLeaveHousehold());

    expect(queryClient.getQueryData(["household-members"])).toBeDefined();
    expect(queryClient.getQueryData(["current-household"])).toBeDefined();

    const removeQueriesSpy = vi.spyOn(queryClient, "removeQueries");

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(removeQueriesSpy).toHaveBeenCalled();

    expect(queryClient.getQueryData(["household-members"])).toBeUndefined();
    expect(queryClient.getQueryData(["current-household"])).toBeUndefined();

    removeQueriesSpy.mockRestore();
  });
});

describe("useLeaveHousehold — erros do RPC", () => {
  test("mapeia NO_HOUSEHOLD para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "NO_HOUSEHOLD", code: "P0001" },
          { status: 400 }
        )
      )
    );

    const { result } = renderWithClient(() => useLeaveHousehold());

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(HOUSEHOLD_MESSAGES.NO_HOUSEHOLD);
    expect(useAuthStore.getState().householdId).toBe("hh-1");
  });

  test("mapeia OWNER_HAS_ACTIVE_MEMBERS para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "OWNER_HAS_ACTIVE_MEMBERS", code: "P0001" },
          { status: 400 }
        )
      )
    );

    const { result } = renderWithClient(() => useLeaveHousehold());

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      HOUSEHOLD_MESSAGES.OWNER_HAS_ACTIVE_MEMBERS
    );
    expect(useAuthStore.getState().householdId).toBe("hh-1");
  });
});

describe("useLeaveHousehold — setter controlado (RN-28)", () => {
  test("usa setHouseholdId, não setState direto", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () => HttpResponse.json(null, { status: 200 }))
    );

    const setStateSpy = vi.spyOn(useAuthStore, "setState");
    const setHouseholdIdSpy = vi.spyOn(
      useAuthStore.getState(),
      "setHouseholdId"
    );

    const { result } = renderWithClient(() => useLeaveHousehold());

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setHouseholdIdSpy).toHaveBeenCalledWith(null);

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
