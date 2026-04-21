/**
 * Testes de integração de `useRegenerateInviteCode` (AC-04).
 *
 * Verifica:
 *   - Mutation chama RPC `regenerate_invite_code` via Supabase
 *   - Invalida query `['household']` no sucesso
 *   - Retorna novo código e expiração
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
import { useRegenerateInviteCode } from "@/features/household/hooks/useRegenerateInviteCode";
import { HOUSEHOLD_MESSAGES } from "@/features/household/lib/household-constants";

const SUPABASE_URL = "http://localhost:54321";
const RPC_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/regenerate_invite_code`;

const SUCCESS_RESPONSE = {
  invite_code: "XYZ789",
  invite_code_expires_at: "2026-04-23T14:30:00Z",
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
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(callback, { wrapper }), queryClient };
}

describe("useRegenerateInviteCode — caminho feliz (AC-04)", () => {
  test("regenera código e retorna novo código com expiração", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(SUCCESS_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useRegenerateInviteCode());

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(SUCCESS_RESPONSE);
    expect(result.current.data?.invite_code).toBe("XYZ789");
  });

  test("invalida query household no sucesso", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(SUCCESS_RESPONSE, { status: 200 })
      )
    );

    const { result, queryClient } = renderWithClient(() =>
      useRegenerateInviteCode()
    );

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["household"],
    });

    invalidateSpy.mockRestore();
  });
});

describe("useRegenerateInviteCode — erros do RPC", () => {
  test("mapeia NOT_OWNER para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "NOT_OWNER", code: "P0001" },
          { status: 403 }
        )
      )
    );

    const { result } = renderWithClient(() => useRegenerateInviteCode());

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(HOUSEHOLD_MESSAGES.NOT_OWNER);
  });

  test("mapeia NO_HOUSEHOLD para mensagem pt-BR", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(
          { message: "NO_HOUSEHOLD", code: "P0001" },
          { status: 400 }
        )
      )
    );

    const { result } = renderWithClient(() => useRegenerateInviteCode());

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(HOUSEHOLD_MESSAGES.NO_HOUSEHOLD);
  });
});

describe("useRegenerateInviteCode — não altera store", () => {
  test("NÃO chama setHouseholdId (código não muda household)", async () => {
    server.use(
      http.post(RPC_ENDPOINT, () =>
        HttpResponse.json(SUCCESS_RESPONSE, { status: 200 })
      )
    );

    const setHouseholdIdSpy = vi.spyOn(
      useAuthStore.getState(),
      "setHouseholdId"
    );

    const { result } = renderWithClient(() => useRegenerateInviteCode());

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setHouseholdIdSpy).not.toHaveBeenCalled();

    setHouseholdIdSpy.mockRestore();
  });
});
