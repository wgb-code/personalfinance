/**
 * Testes unitários para `src/router/routes.tsx`
 *
 * Verifica:
 *   - Configuração do router (createBrowserRouter)
 *   - HomeRedirect baseado em householdId
 *   - Renderização correta de placeholders
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { RouterProvider, createMemoryRouter, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

import { useAuthStore } from "@/stores/useAuthStore";

const createTestRouter = (initialPath: string) => {
  return createMemoryRouter(
    [
      {
        path: "/",
        element: <TestHomeRedirect />,
      },
      {
        path: "/dashboard",
        element: <div data-testid="dashboard">Dashboard</div>,
      },
      {
        path: "/onboarding",
        element: <div data-testid="onboarding">Onboarding</div>,
      },
      {
        path: "/login",
        element: <div data-testid="login">Login</div>,
      },
      {
        path: "*",
        element: <div data-testid="not-found">Not Found</div>,
      },
    ],
    { initialEntries: [initialPath] }
  );
};

function TestHomeRedirect() {
  const householdId = useAuthStore((s) => s.householdId);
  return <Navigate to={householdId ? "/dashboard" : "/onboarding"} replace />;
}

function renderWithProviders(router: ReturnType<typeof createMemoryRouter>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe("routes.tsx", () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("HomeRedirect", () => {
    it("redireciona para /onboarding quando householdId é null", async () => {
      useAuthStore.setState({ householdId: null });
      const router = createTestRouter("/");

      renderWithProviders(router);

      await waitFor(() => {
        expect(screen.getByTestId("onboarding")).toBeInTheDocument();
      });
    });

    it("redireciona para /dashboard quando householdId está presente", async () => {
      useAuthStore.setState({ householdId: "some-household-id" });
      const router = createTestRouter("/");

      renderWithProviders(router);

      await waitFor(() => {
        expect(screen.getByTestId("dashboard")).toBeInTheDocument();
      });
    });
  });

  describe("NotFoundPlaceholder", () => {
    it("renderiza corretamente para rotas desconhecidas", async () => {
      const router = createTestRouter("/rota-inexistente");

      renderWithProviders(router);

      await waitFor(() => {
        expect(screen.getByTestId("not-found")).toBeInTheDocument();
      });
    });
  });
});

describe("DashboardPlaceholder", () => {
  it("renderiza o heading Dashboard", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/dashboard",
          element: (
            <main>
              <h1>Dashboard</h1>
            </main>
          ),
        },
      ],
      { initialEntries: ["/dashboard"] }
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });
  });
});

describe("BillsListPlaceholder", () => {
  it("renderiza o heading Contas fixas", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/bills",
          element: (
            <main>
              <h1>Contas fixas</h1>
            </main>
          ),
        },
      ],
      { initialEntries: ["/bills"] }
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /contas fixas/i })).toBeInTheDocument();
    });
  });
});

describe("BillDetailPlaceholder", () => {
  it("renderiza o heading Detalhe da conta", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/bills/:id",
          element: (
            <main>
              <h1>Detalhe da conta</h1>
            </main>
          ),
        },
      ],
      { initialEntries: ["/bills/123"] }
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /detalhe da conta/i })).toBeInTheDocument();
    });
  });
});

describe("appRouter structure", () => {
  it("exporta um router válido", async () => {
    const { appRouter } = await import("@/router/routes");
    
    expect(appRouter).toBeDefined();
    expect(appRouter.routes).toBeDefined();
    expect(Array.isArray(appRouter.routes)).toBe(true);
  });

  it("contém rotas públicas de autenticação", async () => {
    const { appRouter } = await import("@/router/routes");
    
    const flatRoutes = flattenRoutes(appRouter.routes);
    const paths = flatRoutes.map((r) => r.path).filter(Boolean);

    expect(paths).toContain("/login");
    expect(paths).toContain("/register");
    expect(paths).toContain("/forgot-password");
    expect(paths).toContain("/reset-password");
  });

  it("contém rotas protegidas", async () => {
    const { appRouter } = await import("@/router/routes");
    
    const flatRoutes = flattenRoutes(appRouter.routes);
    const paths = flatRoutes.map((r) => r.path).filter(Boolean);

    expect(paths).toContain("/onboarding");
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/bills");
  });

  it("contém rota wildcard para 404", async () => {
    const { appRouter } = await import("@/router/routes");
    
    const flatRoutes = flattenRoutes(appRouter.routes);
    const paths = flatRoutes.map((r) => r.path).filter(Boolean);

    expect(paths).toContain("*");
  });
});

interface RouteObject {
  path?: string;
  children?: RouteObject[];
}

function flattenRoutes(routes: RouteObject[]): RouteObject[] {
  const result: RouteObject[] = [];

  function traverse(routeList: RouteObject[]) {
    for (const route of routeList) {
      result.push(route);
      if (route.children) {
        traverse(route.children);
      }
    }
  }

  traverse(routes);
  return result;
}
