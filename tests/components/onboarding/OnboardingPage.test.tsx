/**
 * Testes em browser-mode (Chromium real via @vitest/browser-playwright)
 * do `<OnboardingPage />` — AC-08.
 *
 * Verifica:
 *   - Renderização da view de escolha por default
 *   - Navegação entre views (criar, entrar)
 *   - Skip de onboarding
 *   - Redirect quando householdId presente
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { OnboardingPage } from "@/features/onboarding/components/OnboardingPage";
import { useAuthStore } from "@/stores/useAuthStore";

function createWrapper(initialAuth: { householdId: string | null }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/onboarding"]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  useAuthStore.setState({
    session: {
      access_token: "test",
      refresh_token: "test",
      expires_in: 3600,
      expires_at: 9999999999,
      token_type: "bearer",
      user: {
        id: "user-1",
        email: "test@example.com",
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      },
    } as Parameters<typeof useAuthStore.setState>[0]["session"],
    user: {
      id: "user-1",
      email: "test@example.com",
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    } as Parameters<typeof useAuthStore.setState>[0]["user"],
    isAuthenticated: true,
    isInitializing: false,
    householdId: initialAuth.householdId,
  });

  return Wrapper;
}

beforeEach(() => {
  useAuthStore.getState().reset();
  vi.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe("<OnboardingPage /> — renderização inicial", () => {
  test("renderiza view de escolha por default", async () => {
    const Wrapper = createWrapper({ householdId: null });
    await render(<OnboardingPage />, { wrapper: Wrapper });

    await expect
      .element(page.getByRole("heading", { name: /bem-vindo/i }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /criar meu household/i }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /tenho um código/i }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /pular por enquanto/i }))
      .toBeVisible();
  });
});

describe("<OnboardingPage /> — navegação entre views", () => {
  test('muda para view create quando "Criar meu household" é clicado', async () => {
    const Wrapper = createWrapper({ householdId: null });
    await render(<OnboardingPage />, { wrapper: Wrapper });

    await userEvent.click(
      page.getByRole("button", { name: /criar meu household/i })
    );

    await expect
      .element(page.getByRole("heading", { name: /criar meu household/i }))
      .toBeVisible();
    await expect
      .element(page.getByLabelText(/nome do household/i))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /voltar/i }))
      .toBeVisible();
  });

  test('muda para view join quando "Tenho um código" é clicado', async () => {
    const Wrapper = createWrapper({ householdId: null });
    await render(<OnboardingPage />, { wrapper: Wrapper });

    await userEvent.click(
      page.getByRole("button", { name: /tenho um código/i })
    );

    await expect
      .element(page.getByRole("heading", { name: /entrar com código/i }))
      .toBeVisible();
    await expect
      .element(page.getByLabelText(/código de convite/i))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /voltar/i }))
      .toBeVisible();
  });

  test("volta para view choice quando botão Voltar é clicado na view create", async () => {
    const Wrapper = createWrapper({ householdId: null });
    await render(<OnboardingPage />, { wrapper: Wrapper });

    await userEvent.click(
      page.getByRole("button", { name: /criar meu household/i })
    );
    await userEvent.click(page.getByRole("button", { name: /voltar/i }));

    await expect
      .element(page.getByRole("button", { name: /criar meu household/i }))
      .toBeVisible();
  });

  test("volta para view choice quando botão Voltar é clicado na view join", async () => {
    const Wrapper = createWrapper({ householdId: null });
    await render(<OnboardingPage />, { wrapper: Wrapper });

    await userEvent.click(
      page.getByRole("button", { name: /tenho um código/i })
    );
    await userEvent.click(page.getByRole("button", { name: /voltar/i }));

    await expect
      .element(page.getByRole("button", { name: /tenho um código/i }))
      .toBeVisible();
  });
});

describe("<OnboardingPage /> — skip onboarding", () => {
  test('botão "Pular" está visível e clicável', async () => {
    const Wrapper = createWrapper({ householdId: null });
    await render(<OnboardingPage />, { wrapper: Wrapper });

    const skipButton = page.getByRole("button", { name: /pular por enquanto/i });
    await expect.element(skipButton).toBeVisible();
    await expect.element(skipButton).toBeEnabled();
  });
});

describe("<OnboardingPage /> — redirect com householdId", () => {
  test("não renderiza conteúdo se householdId está presente", async () => {
    const Wrapper = createWrapper({ householdId: "some-household-id" });
    await render(<OnboardingPage />, { wrapper: Wrapper });

    await expect
      .element(page.getByRole("heading", { name: /bem-vindo/i }))
      .not.toBeInTheDocument();
  });
});
