/**
 * Testes de integração de `useHouseholdAudit` (AC-18).
 *
 * Verifica:
 *   - Query retorna audit trail com JOIN em user_profiles
 *   - Ordena por performed_at DESC (mais recente primeiro)
 *   - Formata descrição legível ("João entrou no household")
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
import { useHouseholdAudit } from "@/features/household/hooks/useHouseholdAudit";

const SUPABASE_URL = "http://localhost:54321";
const AUDIT_ENDPOINT = `${SUPABASE_URL}/rest/v1/household_member_audit`;

const AUDIT_RESPONSE = [
  {
    id: "a3",
    household_id: "hh-1",
    user_id: "user-3",
    action: "removed",
    performed_by: "user-1",
    performed_at: "2026-04-18T10:00:00Z",
    metadata: {},
    user_profile: { full_name: "Carlos Oliveira" },
    performer_profile: { full_name: "Maria Silva" },
  },
  {
    id: "a2",
    household_id: "hh-1",
    user_id: "user-2",
    action: "joined",
    performed_by: "user-2",
    performed_at: "2026-04-15T14:30:00Z",
    metadata: {},
    user_profile: { full_name: "João Santos" },
    performer_profile: { full_name: "João Santos" },
  },
  {
    id: "a1",
    household_id: "hh-1",
    user_id: "user-1",
    action: "joined",
    performed_by: "user-1",
    performed_at: "2026-04-10T10:00:00Z",
    metadata: {},
    user_profile: { full_name: "Maria Silva" },
    performer_profile: { full_name: "Maria Silva" },
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

function simulateAuthenticatedOwnerWithHousehold() {
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

describe("useHouseholdAudit — caminho feliz (AC-18)", () => {
  test("retorna audit trail com dados de perfil", async () => {
    simulateAuthenticatedOwnerWithHousehold();

    server.use(
      http.get(AUDIT_ENDPOINT, () =>
        HttpResponse.json(AUDIT_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useHouseholdAudit());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });

  test("formata descrição legível para joined", async () => {
    simulateAuthenticatedOwnerWithHousehold();

    server.use(
      http.get(AUDIT_ENDPOINT, () =>
        HttpResponse.json(AUDIT_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useHouseholdAudit());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const joinedEntry = result.current.data?.find(
      (e) => e.userFullName === "João Santos"
    );
    expect(joinedEntry?.description).toBe("João Santos entrou no household");
  });

  test("formata descrição legível para removed", async () => {
    simulateAuthenticatedOwnerWithHousehold();

    server.use(
      http.get(AUDIT_ENDPOINT, () =>
        HttpResponse.json(AUDIT_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useHouseholdAudit());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const removedEntry = result.current.data?.find(
      (e) => e.action === "removed"
    );
    expect(removedEntry?.description).toBe(
      "Carlos Oliveira foi removido por Maria Silva"
    );
  });

  test("ordena por performed_at DESC (mais recente primeiro)", async () => {
    simulateAuthenticatedOwnerWithHousehold();

    server.use(
      http.get(AUDIT_ENDPOINT, () =>
        HttpResponse.json(AUDIT_RESPONSE, { status: 200 })
      )
    );

    const { result } = renderWithClient(() => useHouseholdAudit());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].action).toBe("removed");
    expect(result.current.data?.[0].performedAt).toBe("2026-04-18T10:00:00Z");
  });
});

describe("useHouseholdAudit — query disabled", () => {
  test("não executa query quando não autenticado", async () => {
    let requestCalled = false;
    server.use(
      http.get(AUDIT_ENDPOINT, () => {
        requestCalled = true;
        return HttpResponse.json(AUDIT_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useHouseholdAudit());

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
      http.get(AUDIT_ENDPOINT, () => {
        requestCalled = true;
        return HttpResponse.json(AUDIT_RESPONSE, { status: 200 });
      })
    );

    const { result } = renderWithClient(() => useHouseholdAudit());

    await new Promise((r) => setTimeout(r, 100));

    expect(result.current.fetchStatus).toBe("idle");
    expect(requestCalled).toBe(false);
  });
});

describe("useHouseholdAudit — erros", () => {
  test("propaga erro da API (ex: 403 para não-owner)", async () => {
    simulateAuthenticatedOwnerWithHousehold();

    server.use(
      http.get(AUDIT_ENDPOINT, () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 })
      )
    );

    const { result } = renderWithClient(() => useHouseholdAudit());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
