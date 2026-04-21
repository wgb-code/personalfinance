/**
 * Testes de integração de `useHouseholdMembers` (AC-10).
 *
 * Verifica:
 *   - Query retorna lista de membros com JOIN em user_profiles
 *   - Inclui membros com left_at (histórico)
 *   - Ordena por role (owner primeiro) e joined_at
 *   - Query fica disabled quando não autenticado ou sem household
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
import { useHouseholdMembers } from "@/features/household/hooks/useHouseholdMembers";

const SUPABASE_URL = "http://localhost:54321";
const MEMBERS_ENDPOINT = `${SUPABASE_URL}/rest/v1/household_members`;

const MEMBERS_RESPONSE = [
  {
    id: "m1",
    user_id: "user-1",
    household_id: "hh-1",
    role: "owner",
    joined_at: "2026-04-10T10:00:00Z",
    left_at: null,
    user_profiles: { full_name: "Maria Silva" },
  },
  {
    id: "m2",
    user_id: "user-2",
    household_id: "hh-1",
    role: "member",
    joined_at: "2026-04-15T14:30:00Z",
    left_at: null,
    user_profiles: { full_name: "João Santos" },
  },
  {
    id: "m3",
    user_id: "user-3",
    household_id: "hh-1",
    role: "member",
    joined_at: "2026-04-12T09:00:00Z",
    left_at: "2026-04-18T10:00:00Z",
    user_profiles: { full_name: "Carlos Oliveira" },
  },
];

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
  return { ...renderHook(callback, { wrapper }), queryClient };
}

function simulateAuthenticatedWithHousehold() {
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
}

describe("useHouseholdMembers — caminho feliz (AC-10)", () => {
  test("retorna lista de membros com dados de perfil", async () => {
    simulateAuthenticatedWithHousehold();

    server.use(
      http.get(MEMBERS_ENDPOINT, () =>
        HttpResponse.json(MEMBERS_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useHouseholdMembers());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].fullName).toBe("Maria Silva");
    expect(result.current.data?.[0].role).toBe("owner");
    expect(result.current.data?.[0].isActive).toBe(true);
  });

  test("inclui membros inativos (com left_at)", async () => {
    simulateAuthenticatedWithHousehold();

    server.use(
      http.get(MEMBERS_ENDPOINT, () =>
        HttpResponse.json(MEMBERS_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useHouseholdMembers());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const inactiveMember = result.current.data?.find(
      (m) => m.fullName === "Carlos Oliveira"
    );
    expect(inactiveMember).toBeDefined();
    expect(inactiveMember?.isActive).toBe(false);
    expect(inactiveMember?.leftAt).toBe("2026-04-18T10:00:00Z");
  });

  test("ordena por role (owner primeiro) e joined_at", async () => {
    simulateAuthenticatedWithHousehold();

    server.use(
      http.get(MEMBERS_ENDPOINT, () =>
        HttpResponse.json(MEMBERS_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useHouseholdMembers());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].role).toBe("owner");
  });
});

describe("useHouseholdMembers — query disabled", () => {
  test("não executa query quando não autenticado", async () => {
    let requestCalled = false;
    server.use(
      http.get(MEMBERS_ENDPOINT, () => {
        requestCalled = true;
        return HttpResponse.json(MEMBERS_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useHouseholdMembers());

    await new Promise((r) => setTimeout(r, 100));

    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe("idle");
    expect(requestCalled).toBe(false);
  });

  test("não executa query quando sem household", async () => {
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

    let requestCalled = false;
    server.use(
      http.get(MEMBERS_ENDPOINT, () => {
        requestCalled = true;
        return HttpResponse.json(MEMBERS_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useHouseholdMembers());

    await new Promise((r) => setTimeout(r, 100));

    expect(result.current.fetchStatus).toBe("idle");
    expect(requestCalled).toBe(false);
  });
});

describe("useHouseholdMembers — erros", () => {
  test("propaga erro da API", async () => {
    simulateAuthenticatedWithHousehold();

    server.use(
      http.get(MEMBERS_ENDPOINT, () =>
        HttpResponse.json(
          { message: "Internal Server Error" },
          { status: 500 }
        )
      )
    );

    const { result } = renderWithClient(() => useHouseholdMembers());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
