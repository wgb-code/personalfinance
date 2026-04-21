import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Integração jsdom + MemoryRouter cobrindo AC-13.
 *
 * Sem MSW/Supabase aqui — exercitamos só o roteamento + decisão do
 * componente. O store é arranjado diretamente via `setState` (Zustand
 * suporta isso explicitamente para testes; é o equivalente honesto de
 * "dado uma sessão ativa" sem precisar mockar `onAuthStateChange`).
 */

function LoginScreen() {
  const location = useLocation();
  return (
    <div>
      <h1>Login</h1>
      <p data-testid="login-search">{location.search}</p>
    </div>
  );
}

function DashboardScreen() {
  return <h1>Dashboard</h1>;
}

function BillsDetailScreen() {
  return <h1>Detalhes da conta</h1>;
}

function makeSessionStub(): Session {
  return {
    access_token: "access-stub",
    refresh_token: "refresh-stub",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
  } as unknown as Session;
}

function renderAt(initialUrl: string, children: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/bills/:id" element={<BillsDetailScreen />} />
        </Route>
        <Route
          path="/protegido-children"
          element={
            <ProtectedRoute>
              <div>Conteúdo via children</div>
            </ProtectedRoute>
          }
        />
      </Routes>
      {children}
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.getState().reset();
});

afterEach(() => {
  useAuthStore.getState().reset();
});

describe("<ProtectedRoute /> — sem sessão", () => {
  test("AC-13: acesso a /dashboard sem sessão redireciona para /login com redirectTo=%2Fdashboard", () => {
    useAuthStore.setState({ isInitializing: false });
    renderAt("/dashboard", null);

    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByTestId("login-search").textContent).toBe(
      "?redirectTo=%2Fdashboard",
    );
  });

  test("AC-13/RN-19: preserva path + search + hash codificados em redirectTo", () => {
    useAuthStore.setState({ isInitializing: false });
    renderAt("/bills/123?tab=x#anchor", null);

    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
    const expected = `?redirectTo=${encodeURIComponent("/bills/123?tab=x#anchor")}`;
    expect(screen.getByTestId("login-search").textContent).toBe(expected);
  });
});

describe("<ProtectedRoute /> — inicializando", () => {
  test("não redireciona enquanto isInitializing=true; renderiza placeholder com role=status", () => {
    useAuthStore.setState({ isInitializing: true, session: null, user: null });
    renderAt("/dashboard", null);

    expect(screen.queryByRole("heading", { name: /login/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /dashboard/i })).not.toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
  });
});

describe("<ProtectedRoute /> — com sessão", () => {
  test("renderiza Outlet quando autenticado (uso como route element)", () => {
    useAuthStore.getState().setSession(makeSessionStub());
    renderAt("/dashboard", null);

    expect(
      screen.getByRole("heading", { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /login/i })).not.toBeInTheDocument();
  });

  test("renderiza children quando autenticado (uso como wrapper)", () => {
    useAuthStore.getState().setSession(makeSessionStub());
    renderAt("/protegido-children", null);

    expect(screen.getByText(/conteúdo via children/i)).toBeInTheDocument();
  });
});
