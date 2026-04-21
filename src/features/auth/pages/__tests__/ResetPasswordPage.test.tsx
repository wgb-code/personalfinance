/**
 * Testes unitários para ResetPasswordPage
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { ResetPasswordPage } from "../ResetPasswordPage";
import { useAuthStore } from "@/stores/useAuthStore";

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      session: {
        access_token: "test",
        refresh_token: "test",
        expires_in: 3600,
        expires_at: 9999999999,
        token_type: "bearer",
        user: {
          id: "user-1",
          email: "test@test.com",
          aud: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      } as Parameters<typeof useAuthStore.setState>[0]["session"],
      isAuthenticated: true,
      isInitializing: false,
    });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().reset();
  });

  it("renderiza o título da página", () => {
    renderWithProviders();
    expect(document.title).toBe("Redefinir senha — Organizador Financeiro");
  });

  it("renderiza o heading identificador", () => {
    renderWithProviders();
    expect(screen.getByText("Organizador Financeiro")).toBeInTheDocument();
  });

  it("tem estrutura acessível com aria-labelledby", () => {
    renderWithProviders();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-labelledby", "reset-password-heading");
  });
});
