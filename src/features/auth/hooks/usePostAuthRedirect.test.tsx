import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { DEFAULT_REDIRECT } from "@/features/auth/lib/safe-redirect";
import { usePostAuthRedirect } from "@/features/auth/hooks/usePostAuthRedirect";

/**
 * Integração leve do hook em jsdom + MemoryRouter.
 *
 * O foco aqui é o CÁLCULO do destino seguro (consumindo `?redirectTo=`
 * via React Router). Não exercitamos `navigate()` real — apenas
 * verificamos o valor exposto via `redirectTo` para evitar acoplamento
 * com a história de navegação interna do router (cobertura de
 * navegação real fica no E2E + testes de `<ProtectedRoute />`).
 */

function makeWrapper(initialUrl: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>;
  };
}

describe("usePostAuthRedirect — cálculo do destino", () => {
  test("retorna o path sanitizado quando ?redirectTo= é interno e válido", () => {
    const { result } = renderHook(() => usePostAuthRedirect(), {
      wrapper: makeWrapper("/login?redirectTo=%2Fdashboard"),
    });
    expect(result.current.redirectTo).toBe("/dashboard");
  });

  test("preserva querystring e hash codificados em ?redirectTo=", () => {
    const target = "/bills/123?tab=fixed#anchor";
    const { result } = renderHook(() => usePostAuthRedirect(), {
      wrapper: makeWrapper(`/login?redirectTo=${encodeURIComponent(target)}`),
    });
    expect(result.current.redirectTo).toBe(target);
  });

  test("retorna fallback default quando ?redirectTo= é malicioso (URL absoluta)", () => {
    const { result } = renderHook(() => usePostAuthRedirect(), {
      wrapper: makeWrapper("/login?redirectTo=https%3A%2F%2Fevil.com"),
    });
    expect(result.current.redirectTo).toBe(DEFAULT_REDIRECT);
  });

  test("retorna fallback default quando ?redirectTo= é protocol-relative", () => {
    const { result } = renderHook(() => usePostAuthRedirect(), {
      wrapper: makeWrapper("/login?redirectTo=%2F%2Fevil.com"),
    });
    expect(result.current.redirectTo).toBe(DEFAULT_REDIRECT);
  });

  test("retorna fallback default quando ?redirectTo= é esquema javascript", () => {
    const { result } = renderHook(() => usePostAuthRedirect(), {
      wrapper: makeWrapper(
        "/login?redirectTo=javascript%3Aalert(1)",
      ),
    });
    expect(result.current.redirectTo).toBe(DEFAULT_REDIRECT);
  });

  test("retorna fallback default quando não há ?redirectTo=", () => {
    const { result } = renderHook(() => usePostAuthRedirect(), {
      wrapper: makeWrapper("/login"),
    });
    expect(result.current.redirectTo).toBe(DEFAULT_REDIRECT);
  });

  test("retorna fallback default quando ?redirectTo= está vazio", () => {
    const { result } = renderHook(() => usePostAuthRedirect(), {
      wrapper: makeWrapper("/login?redirectTo="),
    });
    expect(result.current.redirectTo).toBe(DEFAULT_REDIRECT);
  });

  test("expõe `navigateAfterAuth` como função estável", () => {
    const { result } = renderHook(() => usePostAuthRedirect(), {
      wrapper: makeWrapper("/login?redirectTo=%2Fdashboard"),
    });
    expect(typeof result.current.navigateAfterAuth).toBe("function");
  });
});
