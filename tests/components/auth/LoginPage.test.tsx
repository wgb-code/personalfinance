/**
 * Smoke test em browser-mode (Chromium real) — apenas verifica que a
 * `<LoginPage />` renderiza o `<LoginForm />` no shell de página.
 * Toda a lógica de submit/erro/a11y vive em `LoginForm.test.tsx`.
 *
 * APIs Vitest 4.x browser-mode (idênticas ao LoginForm.test.tsx para
 * consistência):
 *   - `render()` de `vitest-browser-react` é assíncrono (Promise).
 *   - `page.*` de `vitest/browser` consulta o documento real.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { render, cleanup } from "vitest-browser-react"
import { page } from "vitest/browser"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import type { ReactNode } from "react"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}))

import { LoginPage } from "@/features/auth/pages/LoginPage"
import { AUTH_MESSAGES } from "@/features/auth/lib/constants"

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  // Silencia o aviso intencional do `safe-redirect.ts` quando
  // `usePostAuthRedirect` recebe `redirectTo` ausente/inválido (Lei 14).
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(async () => {
  await cleanup()
  vi.restoreAllMocks()
})

describe("<LoginPage /> — smoke", () => {
  test("renderiza shell com wordmark da marca e o LoginForm interno", async () => {
    await render(<LoginPage />, { wrapper: Wrapper })

    // Wordmark sutil acima do card.
    await expect.element(page.getByText("Organizador Financeiro")).toBeVisible()

    // O form aparece via título "Entrar" no <CardTitle h3>.
    await expect
      .element(page.getByRole("heading", { name: AUTH_MESSAGES.LOGIN_TITLE }))
      .toBeVisible()

    // Email e senha vindos do <LoginForm /> aninhado.
    await expect
      .element(
        page.getByLabelText(AUTH_MESSAGES.LOGIN_EMAIL_LABEL, { exact: true }),
      )
      .toBeVisible()
    // `exact: true` é necessário porque o botão de toggle do password
    // tem `aria-label="Mostrar senha"`, que casa parcialmente com "Senha".
    await expect
      .element(
        page.getByLabelText(AUTH_MESSAGES.LOGIN_PASSWORD_LABEL, {
          exact: true,
        }),
      )
      .toBeVisible()
  })
})
