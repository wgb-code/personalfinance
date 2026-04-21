/**
 * Testes em browser-mode (Chromium real via @vitest/browser-playwright)
 * do `<JoinHouseholdForm />` — AC-06, AC-07.
 *
 * Verifica:
 *   - Renderização do form com input de código
 *   - Auto-uppercase no input
 *   - Validação de formato (6 chars)
 *   - Chamada de useJoinHousehold no submit válido
 *   - Exibição de erro genérico em falha da API
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import axe from "axe-core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { JoinHouseholdForm } from "@/features/onboarding/components/JoinHouseholdForm";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/lib/onboarding-constants";
import { useAuthStore } from "@/stores/useAuthStore";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return Wrapper;
}

function setJoinHouseholdSuccess() {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: {
      household_id: "joined-household-id",
      name: "Casa da Família Silva",
      role: "member",
    },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);
}

function setJoinHouseholdError(message: string) {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: null,
    error: {
      message,
      code: "P0001",
    },
  } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);
}

beforeEach(() => {
  useAuthStore.getState().reset();
  useAuthStore.setState({
    isAuthenticated: true,
    isInitializing: false,
  });
  vi.mocked(supabase.rpc).mockReset();
});

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe("<JoinHouseholdForm /> — renderização inicial", () => {
  test("renderiza form com input de código, botões Entrar e Voltar", async () => {
    const Wrapper = createWrapper();
    const onBack = vi.fn();
    const onSuccess = vi.fn();

    await render(
      <JoinHouseholdForm onBack={onBack} onSuccess={onSuccess} />,
      { wrapper: Wrapper }
    );

    await expect
      .element(page.getByRole("heading", { name: /entrar com código/i }))
      .toBeVisible();
    await expect
      .element(page.getByLabelText(/código de convite/i))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /^entrar$/i }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /voltar/i }))
      .toBeVisible();
  });

  test("input tem maxLength de 6 e classe font-mono", async () => {
    const Wrapper = createWrapper();

    await render(
      <JoinHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    const input = page.getByLabelText(/código de convite/i);
    await expect.element(input).toHaveAttribute("maxLength", "6");
    await expect.element(input).toHaveClass("font-mono");
  });

  test("axe-core não reporta violações no estado limpo", async () => {
    const Wrapper = createWrapper();
    const result = await render(
      <JoinHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    const axeResults = await axe.run(result.container);
    expect(axeResults.violations).toEqual([]);
  });
});

describe("<JoinHouseholdForm /> — auto-uppercase", () => {
  test("converte input para uppercase automaticamente", async () => {
    const Wrapper = createWrapper();

    await render(
      <JoinHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    const input = page.getByLabelText(/código de convite/i);
    await userEvent.fill(input, "abc123");

    await expect.element(input).toHaveValue("ABC123");
  });
});

describe("<JoinHouseholdForm /> — validação inline (RHF + Zod)", () => {
  test("mostra erro para código com menos de 6 caracteres", async () => {
    const Wrapper = createWrapper();

    await render(
      <JoinHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    const input = page.getByLabelText(/código de convite/i);
    await userEvent.fill(input, "ABC");
    await userEvent.tab();

    await expect
      .element(page.getByText(ONBOARDING_MESSAGES.INVITE_CODE_LENGTH))
      .toBeVisible();
  });
});

describe("<JoinHouseholdForm /> — submit com sucesso", () => {
  test("chama supabase.rpc e onSuccess com código válido", async () => {
    setJoinHouseholdSuccess();
    const Wrapper = createWrapper();
    const onBack = vi.fn();
    const onSuccess = vi.fn();

    await render(
      <JoinHouseholdForm onBack={onBack} onSuccess={onSuccess} />,
      { wrapper: Wrapper }
    );

    await userEvent.fill(page.getByLabelText(/código de convite/i), "ABC123");
    await userEvent.click(page.getByRole("button", { name: /^entrar$/i }));

    await vi.waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("join_household", {
        p_code: "ABC123",
      });
    });

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

describe("<JoinHouseholdForm /> — loading state", () => {
  test("exibe loading state durante pending", async () => {
    let resolveRpc: ((value: unknown) => void) | undefined;
    vi.mocked(supabase.rpc).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRpc = resolve;
        })
    );

    const Wrapper = createWrapper();

    await render(
      <JoinHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    await userEvent.fill(page.getByLabelText(/código de convite/i), "ABC123");
    await userEvent.click(page.getByRole("button", { name: /^entrar$/i }));

    const submitting = page.getByRole("button", { name: /entrando/i });
    await expect.element(submitting).toBeDisabled();
    await expect.element(submitting).toHaveAttribute("aria-busy", "true");

    const backButton = page.getByRole("button", { name: /voltar/i });
    await expect.element(backButton).toBeDisabled();

    resolveRpc?.({
      data: {
        household_id: "joined-household-id",
        name: "Casa da Família Silva",
        role: "member",
      },
      error: null,
    });
  });
});

describe("<JoinHouseholdForm /> — submit com erro (AC-07)", () => {
  test("exibe erro genérico 'Código inválido ou expirado'", async () => {
    setJoinHouseholdError("INVALID_OR_EXPIRED_CODE");
    const Wrapper = createWrapper();

    await render(
      <JoinHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    await userEvent.fill(page.getByLabelText(/código de convite/i), "ABC123");
    await userEvent.click(page.getByRole("button", { name: /^entrar$/i }));

    await expect.element(page.getByRole("alert")).toBeVisible();
    await expect
      .element(
        page.getByText(ONBOARDING_MESSAGES.INVITE_CODE_INVALID_OR_EXPIRED)
      )
      .toBeVisible();
  });

  test("axe-core não reporta violações com Alert de erro visível", async () => {
    setJoinHouseholdError("INVALID_OR_EXPIRED_CODE");
    const Wrapper = createWrapper();
    const result = await render(
      <JoinHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    await userEvent.fill(page.getByLabelText(/código de convite/i), "ABC123");
    await userEvent.click(page.getByRole("button", { name: /^entrar$/i }));

    await expect.element(page.getByRole("alert")).toBeVisible();

    const axeResults = await axe.run(result.container);
    expect(axeResults.violations).toEqual([]);
  });
});

describe("<JoinHouseholdForm /> — callback onBack", () => {
  test("chama onBack quando botão Voltar é clicado", async () => {
    const Wrapper = createWrapper();
    const onBack = vi.fn();

    await render(
      <JoinHouseholdForm onBack={onBack} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    await userEvent.click(page.getByRole("button", { name: /voltar/i }));

    expect(onBack).toHaveBeenCalled();
  });
});
