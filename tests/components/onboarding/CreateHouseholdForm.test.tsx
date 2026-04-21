/**
 * Testes em browser-mode (Chromium real via @vitest/browser-playwright)
 * do `<CreateHouseholdForm />` — AC-01, AC-02.
 *
 * Verifica:
 *   - Renderização do form com input de nome
 *   - Validação de nome vazio
 *   - Validação de nome > 100 chars
 *   - Chamada de useCreateHousehold no submit válido
 *   - Loading state durante submission
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
import { CreateHouseholdForm } from "@/features/onboarding/components/CreateHouseholdForm";
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

function setCreateHouseholdSuccess() {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: {
      household_id: "new-household-id",
      name: "Casa da Família",
      invite_code: "ABC123",
      invite_code_expires_at: "2026-04-23T14:30:00Z",
      role: "owner",
    },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);
}

function setCreateHouseholdError(message: string) {
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

describe("<CreateHouseholdForm /> — renderização inicial", () => {
  test("renderiza form com input de nome, botões Criar e Voltar", async () => {
    const Wrapper = createWrapper();
    const onBack = vi.fn();
    const onSuccess = vi.fn();

    await render(
      <CreateHouseholdForm onBack={onBack} onSuccess={onSuccess} />,
      { wrapper: Wrapper }
    );

    await expect
      .element(page.getByRole("heading", { name: /criar meu household/i }))
      .toBeVisible();
    await expect
      .element(page.getByLabelText(/nome do household/i))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /^criar$/i }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /voltar/i }))
      .toBeVisible();
  });

  test("axe-core não reporta violações no estado limpo", async () => {
    const Wrapper = createWrapper();
    const result = await render(
      <CreateHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    const axeResults = await axe.run(result.container);
    expect(axeResults.violations).toEqual([]);
  });
});

describe("<CreateHouseholdForm /> — validação inline (RHF + Zod)", () => {
  test("mostra erro para nome vazio após blur", async () => {
    const Wrapper = createWrapper();
    await render(
      <CreateHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    const input = page.getByLabelText(/nome do household/i);
    await userEvent.click(input);
    await userEvent.tab();

    await expect
      .element(page.getByText(ONBOARDING_MESSAGES.HOUSEHOLD_NAME_REQUIRED))
      .toBeVisible();
  });

  test("mostra erro para nome > 100 caracteres", async () => {
    const Wrapper = createWrapper();
    await render(
      <CreateHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    const input = page.getByLabelText(/nome do household/i);
    const longName = "a".repeat(101);
    await userEvent.fill(input, longName);
    await userEvent.tab();

    await expect
      .element(page.getByText(ONBOARDING_MESSAGES.HOUSEHOLD_NAME_TOO_LONG))
      .toBeVisible();
  });
});

describe("<CreateHouseholdForm /> — submit com sucesso", () => {
  test("chama supabase.rpc e onSuccess com nome válido", async () => {
    setCreateHouseholdSuccess();
    const Wrapper = createWrapper();
    const onBack = vi.fn();
    const onSuccess = vi.fn();

    await render(
      <CreateHouseholdForm onBack={onBack} onSuccess={onSuccess} />,
      { wrapper: Wrapper }
    );

    await userEvent.fill(
      page.getByLabelText(/nome do household/i),
      "Casa da Família"
    );
    await userEvent.click(page.getByRole("button", { name: /^criar$/i }));

    await vi.waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith("create_household", {
        p_name: "Casa da Família",
      });
    });

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

describe("<CreateHouseholdForm /> — loading state", () => {
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
      <CreateHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    await userEvent.fill(
      page.getByLabelText(/nome do household/i),
      "Casa da Família"
    );
    await userEvent.click(page.getByRole("button", { name: /^criar$/i }));

    const submitting = page.getByRole("button", { name: /criando/i });
    await expect.element(submitting).toBeDisabled();
    await expect.element(submitting).toHaveAttribute("aria-busy", "true");

    const backButton = page.getByRole("button", { name: /voltar/i });
    await expect.element(backButton).toBeDisabled();

    resolveRpc?.({
      data: {
        household_id: "new-household-id",
        name: "Casa da Família",
        invite_code: "ABC123",
        invite_code_expires_at: "2026-04-23T14:30:00Z",
        role: "owner",
      },
      error: null,
    });
  });
});

describe("<CreateHouseholdForm /> — submit com erro", () => {
  test("exibe Alert com mensagem de erro", async () => {
    setCreateHouseholdError("NAME_REQUIRED");
    const Wrapper = createWrapper();

    await render(
      <CreateHouseholdForm onBack={vi.fn()} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    await userEvent.fill(
      page.getByLabelText(/nome do household/i),
      "Casa da Família"
    );
    await userEvent.click(page.getByRole("button", { name: /^criar$/i }));

    await expect.element(page.getByRole("alert")).toBeVisible();
  });
});

describe("<CreateHouseholdForm /> — callback onBack", () => {
  test("chama onBack quando botão Voltar é clicado", async () => {
    const Wrapper = createWrapper();
    const onBack = vi.fn();

    await render(
      <CreateHouseholdForm onBack={onBack} onSuccess={vi.fn()} />,
      { wrapper: Wrapper }
    );

    await userEvent.click(page.getByRole("button", { name: /voltar/i }));

    expect(onBack).toHaveBeenCalled();
  });
});
