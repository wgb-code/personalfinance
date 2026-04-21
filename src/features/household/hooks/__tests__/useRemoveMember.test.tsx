/**
 * Testes de integração de `useRemoveMember` (AC-12).
 *
 * Verifica:
 *   - Mutation chama RPC `remove_member(p_target_user_id)` via Supabase
 *   - Invalida queries `household-members` e `household-audit` no sucesso
 *   - **NÃO** altera `householdId` do caller (é owner)
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
import { useRemoveMember } from "@/features/household/hooks/useRemoveMember";
import { HOUSEHOLD_MESSAGES } from "@/features/household/lib/household-constants";

const SUPABASE_URL = "http://localhost:54321";
const RPC_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/remove_member`;

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
      id: "owner-1",
      email: "maria@x.com",
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

  queryClient.setQueryData(["household-members"], [{ id: "m1" }]);
  queryClient.setQueryData(["household-audit"], [{ id: "a1" }]);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(callback, { wrapper }), queryClient };
}

describe("useRemoveMember — caminho feliz (AC-12)", () => {
  test("remove membro e envia target_user_id no payload", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(RPC_ENDPOINT, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(null, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useRemoveMember());

    act(() => {
      result.current.mutate({ targetUserId: "user-2" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const body = capturedBody as { p_target_user_id?: string };
    expect(body.p_target_user_id).toBe("user-2");
  });

  test("invalida queries household-members e household-audit no sucesso", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () => HttpResponse.json(null, { status: 200 }))
    );

    const { result, queryClient } = renderWithClient(() => useRemoveMember());

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      result.current.mutate({ targetUserId: "user-2" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["household-members"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["household-audit"],
    });

    invalidateSpy.mockRestore();
  });

  test("NÃO altera householdId do caller (owner)", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () => HttpResponse.json(null, { status: 200 }))
    );

    const setHouseholdIdSpy = vi.spyOn(
      useAuthStore.getState(),
      "setHouseholdId"
    );

    const { result } = renderWithClient(() => useRemoveMember());

    expect(useAuthStore.getState().householdId).toBe("hh-1");

    act(() => {
      result.current.mutate({ targetUserId: "user-2" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setHouseholdIdSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().householdId).toBe("hh-1");

    setHouseholdIdSpy.mockRestore();
  });
});

describe("useRemoveMember — erros do RPC", () => {
  test("mapeia NOT_OWNER para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "NOT_OWNER", code: "P0001" },
          { status: 403 }
        )
      )
    );

    const { result } = renderWithClient(() => useRemoveMember());

    act(() => {
      result.current.mutate({ targetUserId: "user-2" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(HOUSEHOLD_MESSAGES.NOT_OWNER);
  });

  test("mapeia TARGET_NOT_MEMBER para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "TARGET_NOT_MEMBER", code: "P0001" },
          { status: 400 }
        )
      )
    );

    const { result } = renderWithClient(() => useRemoveMember());

    act(() => {
      result.current.mutate({ targetUserId: "user-2" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      HOUSEHOLD_MESSAGES.TARGET_NOT_MEMBER
    );
  });

  test("mapeia CANNOT_REMOVE_SELF para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "CANNOT_REMOVE_SELF", code: "P0001" },
          { status: 400 }
        )
      )
    );

    const { result } = renderWithClient(() => useRemoveMember());

    act(() => {
      result.current.mutate({ targetUserId: "owner-1" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(
      HOUSEHOLD_MESSAGES.CANNOT_REMOVE_SELF
    );
  });
});
