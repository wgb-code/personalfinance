/**
 * Testes unitários para RegisterPage
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { RegisterPage } from "../RegisterPage";

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renderiza o título da página", () => {
    renderWithProviders();
    expect(document.title).toBe("Criar conta — Organizador Financeiro");
  });

  it("renderiza o heading identificador", () => {
    renderWithProviders();
    expect(screen.getByText("Organizador Financeiro")).toBeInTheDocument();
  });

  it("renderiza o formulário de registro", () => {
    renderWithProviders();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
  });

  it("tem estrutura acessível com aria-labelledby", () => {
    renderWithProviders();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-labelledby", "register-heading");
  });
});
