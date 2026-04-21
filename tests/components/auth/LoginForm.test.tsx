/**
 * Testes em browser-mode (Chromium real via @vitest/browser-playwright)
 * do `<LoginForm>` — AC-05 (caminho feliz) + a11y/microcopy preparada
 * para AC-06 (mensagem genérica) e AC-07 (rate limit / loading state).
 *
 * Estratégia:
 *  - Mockamos APENAS a borda I/O (`@/lib/supabase`). O resto da pirâmide
 *    (RHF + Zod + `useSignIn` + `usePostAuthRedirect` + `mapAuthError`
 *    + Zustand) roda real para validar a integração ponta-a-ponta visual.
 *  - `MemoryRouter` com `?redirectTo=` na URL inicial garante que o
 *    `usePostAuthRedirect` é exercitado mesmo sem assertion direta de
 *    `navigate` (assert via `useAuthStore.isAuthenticated`).
 *  - `axe-core` corre 2x: estado limpo + estado com `<Alert>` visível,
 *    para cobrir o caminho de erro com a11y.
 *  - Lei 14: spy em `console.*` com regex sobre a senha real para falhar
 *    se algum log vazar input do usuário.
 *
 * Notas sobre APIs (Vitest 4.x browser-mode):
 *  - `render()` de `vitest-browser-react` retorna `Promise<RenderResult>` —
 *    SEMPRE precisa `await`. Esquecer o await dá `getByText is not a
 *    function` (acessando método em Promise).
 *  - Queries acessadas via `page.*` (de `vitest/browser`) consultam o
 *    documento real do navegador, deixando explícito que estamos em
 *    Chromium e não num wrapper jsdom.
 *  - `vitest-axe@0.1.0` quebra no browser (usa `createRequire` de Node).
 *    Trocado por `axe-core` direto, que roda nativo no browser.
 *  - `page.getByLabelText` (Playwright accessibility locator) usa
 *    *partial match* por padrão. Precisamos `{ exact: true }` para o
 *    label "Senha", senão também casa com o botão de toggle (cujo
 *    `aria-label` é "Mostrar senha" / "Ocultar senha"), violando o
 *    strict-mode do Playwright.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { render, cleanup } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"
import axe from "axe-core"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import type { ReactNode } from "react"

// IMPORTANT: o mock precisa ser declarado ANTES de qualquer import que
// indiretamente importe `@/lib/supabase` (todos os hooks de auth fazem
// isso). `vi.mock` é hoisted, mas a fábrica retornada é avaliada lazy
// — então devolvemos um objeto plano que mimetiza a forma usada pelo
// `useSignIn`.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}))

import { supabase } from "@/lib/supabase"
import { LoginForm } from "@/features/auth/components/LoginForm"
import { AUTH_MESSAGES } from "@/features/auth/lib/constants"
import { useAuthStore } from "@/stores/useAuthStore"

const TEST_PASSWORD = "Segura123"
const TEST_EMAIL = "joao@exemplo.com"

const VALID_SESSION = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: "bearer",
  user: {
    id: "user-1",
    email: TEST_EMAIL,
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
}

function createWrapper() {
  // Cliente isolado por teste — sem retry e sem cache leak entre specs.
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/login?redirectTo=%2Fdashboard"]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return Wrapper
}

function setSignInSuccess() {
  vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
    data: { user: VALID_SESSION.user, session: VALID_SESSION },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)
}

function setSignInInvalidCredentials() {
  vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
    data: { user: null, session: null },
    error: {
      name: "AuthApiError",
      message: "Invalid login credentials",
      status: 400,
    },
  } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)
}

beforeEach(() => {
  // Store global (Zustand). Limpar antes de cada teste evita falsos
  // positivos do tipo "isAuthenticated já estava true do teste anterior".
  useAuthStore.getState().reset()
  vi.mocked(supabase.auth.signInWithPassword).mockReset()

  // Silencia o aviso intencional do `safe-redirect.ts` quando o
  // `usePostAuthRedirect` recebe um `redirectTo` inválido. NÃO é bug —
  // é Lei 14 trabalhando. Mantemos o spy para o cenário "Lei 14 — não
  // loga senha" inspecionar as chamadas.
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(async () => {
  // Cleanup explícito do DOM entre testes — vitest-browser-react não
  // registra o auto-cleanup global quando o setup file não importa de
  // `vitest-browser-react/cleanup`.
  await cleanup()
  vi.restoreAllMocks()
})

describe("<LoginForm /> — renderização inicial e a11y básica", () => {
  test("renderiza inputs com label associado e botão habilitado", async () => {
    const Wrapper = createWrapper()
    await render(<LoginForm />, { wrapper: Wrapper })

    await expect
      .element(page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true }))
      .toBeVisible()
    await expect
      .element(page.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL, { exact: true }))
      .toBeVisible()
    await expect
      .element(
        page.getByRole("button", {
          name: AUTH_MESSAGES.LOGIN_SUBMIT,
          exact: true,
        }),
      )
      .toBeEnabled()
  })

  test("axe-core não reporta violações no estado limpo", async () => {
    const Wrapper = createWrapper()
    const result = await render(<LoginForm />, { wrapper: Wrapper })

    const axeResults = await axe.run(result.container)
    expect(axeResults.violations).toEqual([])
  })
})

describe("<LoginForm /> — validação inline (RHF + Zod)", () => {
  test("submeter vazio mostra erros e NÃO chama supabase", async () => {
    const Wrapper = createWrapper()
    await render(<LoginForm />, { wrapper: Wrapper })

    const submit = page.getByRole("button", {
      name: AUTH_MESSAGES.LOGIN_SUBMIT,
      exact: true,
    })
    await userEvent.click(submit)

    // Email vazio cai no schema do Zod email() — vira "Informe um email válido".
    await expect
      .element(page.getByText(AUTH_MESSAGES.EMAIL_INVALID))
      .toBeVisible()
    // Password vazia cai em PASSWORD_REQUIRED (min(1)).
    await expect
      .element(page.getByText(AUTH_MESSAGES.PASSWORD_REQUIRED))
      .toBeVisible()

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  test("email malformado dispara erro inline e NÃO chama supabase", async () => {
    const Wrapper = createWrapper()
    await render(<LoginForm />, { wrapper: Wrapper })

    const emailInput = page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true })
    await userEvent.fill(emailInput, "naoeumemail")
    // Tira foco do campo via Tab — ativa o `mode: "onBlur"` do RHF.
    await userEvent.tab()

    await expect
      .element(page.getByText(AUTH_MESSAGES.EMAIL_INVALID))
      .toBeVisible()
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe("<LoginForm /> — submit com sucesso (AC-05)", () => {
  test("popula useAuthStore e chama mutate com input correto", async () => {
    setSignInSuccess()
    const Wrapper = createWrapper()
    await render(<LoginForm />, { wrapper: Wrapper })

    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true }),
      TEST_EMAIL,
    )
    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL, { exact: true }),
      TEST_PASSWORD,
    )

    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )

    // Loading idealmente é capturado DURANTE pending. Como o mock resolve
    // sincronamente em microtask, o button já pode ter voltado ao texto
    // normal. Verificamos a invariância principal: a sessão chegou no
    // store (Lei 1: store é fonte de verdade). O cenário separado abaixo
    // ("ARIA: submit em pending …") trava o mock para observar o pending.
    await vi.waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      // Schema normaliza email para lowercase + trim antes de chegar à rede.
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    expect(useAuthStore.getState().user?.email).toBe(TEST_EMAIL)
  })

  test("ARIA: submit em pending expõe aria-busy + texto Entrando…", async () => {
    // Travamos o mock numa promise nunca resolvida para garantir que
    // o estado pending fica visível durante o assert.
    let resolveSignIn: ((value: unknown) => void) | undefined
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve
        }),
    )

    const Wrapper = createWrapper()
    await render(<LoginForm />, { wrapper: Wrapper })

    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true }),
      TEST_EMAIL,
    )
    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL, { exact: true }),
      TEST_PASSWORD,
    )
    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )

    const submitting = page.getByRole("button", {
      name: AUTH_MESSAGES.LOGIN_SUBMITTING,
    })
    await expect.element(submitting).toBeDisabled()
    await expect.element(submitting).toHaveAttribute("aria-busy", "true")

    // Cleanup: resolve a promise para o teste não vazar o pending.
    resolveSignIn?.({
      data: { user: VALID_SESSION.user, session: VALID_SESSION },
      error: null,
    })
  })
})

describe("<LoginForm /> — credenciais inválidas (AC-06 prep)", () => {
  test("exibe Alert com mensagem genérica e mantém store limpo", async () => {
    setSignInInvalidCredentials()
    const Wrapper = createWrapper()
    await render(<LoginForm />, { wrapper: Wrapper })

    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true }),
      TEST_EMAIL,
    )
    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL, { exact: true }),
      TEST_PASSWORD,
    )
    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )

    await expect
      .element(page.getByText(AUTH_MESSAGES.INVALID_CREDENTIALS))
      .toBeVisible()

    // Botão voltou ao estado idle, pronto para nova tentativa.
    await expect
      .element(
        page.getByRole("button", {
          name: AUTH_MESSAGES.LOGIN_SUBMIT,
          exact: true,
        }),
      )
      .toBeEnabled()

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  test("axe-core não reporta violações com Alert visível", async () => {
    setSignInInvalidCredentials()
    const Wrapper = createWrapper()
    const result = await render(<LoginForm />, { wrapper: Wrapper })

    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true }),
      TEST_EMAIL,
    )
    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL, { exact: true }),
      TEST_PASSWORD,
    )
    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )

    await expect
      .element(page.getByText(AUTH_MESSAGES.INVALID_CREDENTIALS))
      .toBeVisible()

    const axeResults = await axe.run(result.container)
    expect(axeResults.violations).toEqual([])
  })

  test("re-submeter limpa o Alert antes do próximo resultado", async () => {
    setSignInInvalidCredentials()
    const Wrapper = createWrapper()
    const result = await render(<LoginForm />, { wrapper: Wrapper })

    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true }),
      TEST_EMAIL,
    )
    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL, { exact: true }),
      TEST_PASSWORD,
    )
    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )

    await expect
      .element(page.getByText(AUTH_MESSAGES.INVALID_CREDENTIALS))
      .toBeVisible()

    // Próxima tentativa: travamos o mock para conseguir observar a
    // janela em que o `submitError` foi resetado para null mas o
    // resultado novo ainda não chegou.
    let resolveSignIn: ((value: unknown) => void) | undefined
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve
        }),
    )

    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )

    await vi.waitFor(() => {
      expect(
        result.container.querySelector("[data-slot='alert']"),
      ).toBeNull()
    })

    resolveSignIn?.({
      data: { user: VALID_SESSION.user, session: VALID_SESSION },
      error: null,
    })
  })
})

describe("<LoginForm /> — toggle de senha (a11y)", () => {
  test("aria-label e aria-pressed alternam; type do input troca entre password e text", async () => {
    const Wrapper = createWrapper()
    await render(<LoginForm />, { wrapper: Wrapper })

    const passwordInput = page.getByLabelText(
      AUTH_MESSAGES.LOGIN_PASSWORD_LABEL,
      { exact: true },
    )
    await expect.element(passwordInput).toHaveAttribute("type", "password")

    const toggle = page.getByRole("button", {
      name: AUTH_MESSAGES.PASSWORD_SHOW,
    })
    await expect.element(toggle).toHaveAttribute("aria-pressed", "false")

    await userEvent.click(toggle)

    const toggleAfter = page.getByRole("button", {
      name: AUTH_MESSAGES.PASSWORD_HIDE,
    })
    await expect.element(toggleAfter).toHaveAttribute("aria-pressed", "true")
    await expect.element(passwordInput).toHaveAttribute("type", "text")
  })
})

describe("<LoginForm /> — Lei 14 (logging higiênico)", () => {
  test("nenhum console.* é chamado com a senha em todos os caminhos", async () => {
    // O `beforeEach` global já espia `console.warn`. Aqui complementamos
    // com `log` e `error` para inspecionar TODOS os canais.
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const warnSpy = vi.mocked(console.warn)

    const Wrapper = createWrapper()
    await render(<LoginForm />, { wrapper: Wrapper })

    // 1) Validação vazia
    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )

    // 2) Submit com erro
    setSignInInvalidCredentials()
    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true }),
      TEST_EMAIL,
    )
    await userEvent.fill(
      page.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL, { exact: true }),
      TEST_PASSWORD,
    )
    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )
    await expect
      .element(page.getByText(AUTH_MESSAGES.INVALID_CREDENTIALS))
      .toBeVisible()

    // 3) Submit com sucesso
    setSignInSuccess()
    await userEvent.click(
      page.getByRole("button", {
        name: AUTH_MESSAGES.LOGIN_SUBMIT,
        exact: true,
      }),
    )
    await vi.waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    // Concatena qualquer chamada console.* que tenha acontecido durante
    // os 3 fluxos. Falhar aqui = vazamento real (Lei 14).
    const allCalls = JSON.stringify([
      logSpy.mock.calls,
      warnSpy.mock.calls,
      errorSpy.mock.calls,
    ])

    expect(allCalls).not.toContain(TEST_PASSWORD)
  })
})
