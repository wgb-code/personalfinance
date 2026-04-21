/**
 * Testes unitários para ForgotPasswordPage
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { ForgotPasswordPage } from "../ForgotPasswordPage";

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renderiza o título da página", () => {
    renderWithProviders();
    expect(document.title).toBe("Recuperar senha — Organizador Financeiro");
  });

  it("renderiza o heading identificador", () => {
    renderWithProviders();
    expect(screen.getByText("Organizador Financeiro")).toBeInTheDocument();
  });

  it("renderiza o formulário de recuperação", () => {
    renderWithProviders();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("tem estrutura acessível com aria-labelledby", () => {
    renderWithProviders();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-labelledby", "forgot-password-heading");
  });
});
