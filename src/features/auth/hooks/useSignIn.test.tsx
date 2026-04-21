/**
 * Testes de integração de `useSignIn` (AC-05 + fundação AC-06/AC-07).
 *
 * Stack:
 *   - jsdom (project "unit" do Vitest)
 *   - MSW interceptando o endpoint real do Supabase
 *     (`POST /auth/v1/token?grant_type=password`)
 *   - QueryClientProvider isolado por teste (sem retry, sem cache leak)
 *
 * Por que NÃO mockar o `supabase.auth.signInWithPassword` diretamente?
 *   - Mockar o SDK testaria que "chamamos um método", não que
 *     "integramos com a API real do Supabase". Substring de erro,
 *     normalização de email, formato do payload — tudo isso só é
 *     exercitado quando o request HTTP de fato sai e o MSW responde.
 *   - Quando o Supabase mudar contrato (ex.: `error_code` virar
 *     `errorCode`), o teste quebra; um mock teria mascarado.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import { server } from "../../../../tests/setup/msw.server";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";
import type { LoginInput } from "@/features/auth/lib/auth-schemas";
import { useSignIn } from "@/features/auth/hooks/useSignIn";
import { useAuthStore } from "@/stores/useAuthStore";

const SUPABASE_URL = "http://localhost:54321";
const TOKEN_ENDPOINT = `${SUPABASE_URL}/auth/v1/token`;

/**
 * Resposta de sucesso do endpoint `/auth/v1/token?grant_type=password`.
 * Espelha o shape REAL do Supabase Auth (verificado contra a v2 do SDK).
 * Campos extras (`app_metadata`, `aud`) são exigidos pelo tipo `User` do
 * `@supabase/supabase-js`.
 */
const SUCCESS_BODY = {
  access_token: "eyJ.fake.jwt",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 9999999999,
  refresh_token: "ref-token",
  user: {
    id: "user-1",
    email: "joao@x.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  },
};

/**
 * Stubamos as envs ANTES de qualquer teste rodar para que o singleton
 * lazy do `@/lib/supabase` consiga inicializar contra o MSW.
 *
 * `vi.stubEnv` é a única forma segura no Vite — `import.meta.env` é
 * read-only via assignment direto.
 */
beforeAll(() => {
  vi.stubEnv("VITE_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  // Garante que cada teste começa com store limpa — caso contrário, sucesso
  // de um teste vaza para o próximo (`isAuthenticated === true` errado).
  useAuthStore.getState().reset();
});

function renderWithClient<TResult>(callback: () => TResult) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(callback, { wrapper });
}

describe("useSignIn — caminho feliz (AC-05)", () => {
  test("popula useAuthStore e retorna { user, session } em sucesso", async () => {
    server.use(
      http.post(TOKEN_ENDPOINT, () => HttpResponse.json(SUCCESS_BODY, { status: 200 })),
    );

    const { result } = renderWithClient(() => useSignIn());

    result.current.mutate({ email: "joao@x.com", password: "Segura123" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe("joao@x.com");
    expect(result.current.data?.user.id).toBe("user-1");
    expect(result.current.data?.session.access_token).toBe("eyJ.fake.jwt");
  });

  test("dispara options.onSuccess com { user, session }", async () => {
    server.use(
      http.post(TOKEN_ENDPOINT, () => HttpResponse.json(SUCCESS_BODY, { status: 200 })),
    );

    const onSuccess = vi.fn();
    const { result } = renderWithClient(() => useSignIn({ onSuccess }));

    result.current.mutate({ email: "joao@x.com", password: "Segura123" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const arg = onSuccess.mock.calls[0]?.[0];
    expect(arg?.user.id).toBe("user-1");
    expect(arg?.session.access_token).toBe("eyJ.fake.jwt");
  });
});

describe("useSignIn — credenciais inválidas (AC-06 + Lei 9)", () => {
  test("400 com error_code=invalid_credentials → mensagem genérica", async () => {
    server.use(
      http.post(TOKEN_ENDPOINT, () =>
        HttpResponse.json(
          { error_code: "invalid_credentials", msg: "Invalid login credentials" },
          { status: 400 },
        ),
      ),
    );

    const onError = vi.fn();
    const { result } = renderWithClient(() => useSignIn({ onError }));

    result.current.mutate({ email: "joao@x.com", password: "Segura123" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.INVALID_CREDENTIALS);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(onError).toHaveBeenCalledWith(AUTH_MESSAGES.INVALID_CREDENTIALS);
  });

  test("400 com msg='Email not confirmed' → mensagem EMAIL_NOT_CONFIRMED", async () => {
    server.use(
      http.post(TOKEN_ENDPOINT, () =>
        HttpResponse.json({ msg: "Email not confirmed" }, { status: 400 }),
      ),
    );

    const onError = vi.fn();
    const { result } = renderWithClient(() => useSignIn({ onError }));

    result.current.mutate({ email: "joao@x.com", password: "Segura123" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.EMAIL_NOT_CONFIRMED);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(onError).toHaveBeenCalledWith(AUTH_MESSAGES.EMAIL_NOT_CONFIRMED);
  });

  test("invariância: 'User not found' e 'Invalid login credentials' produzem mensagem IDÊNTICA", async () => {
    server.use(
      http.post(TOKEN_ENDPOINT, () =>
        HttpResponse.json({ msg: "User not found" }, { status: 400 }),
      ),
    );

    const first = renderWithClient(() => useSignIn());
    first.result.current.mutate({ email: "ghost@x.com", password: "Segura123" });
    await waitFor(() => expect(first.result.current.isError).toBe(true));
    const userNotFoundMessage = first.result.current.error?.message;

    server.use(
      http.post(TOKEN_ENDPOINT, () =>
        HttpResponse.json({ msg: "Invalid login credentials" }, { status: 400 }),
      ),
    );

    const second = renderWithClient(() => useSignIn());
    second.result.current.mutate({ email: "joao@x.com", password: "Errada123" });
    await waitFor(() => expect(second.result.current.isError).toBe(true));
    const wrongPasswordMessage = second.result.current.error?.message;

    // toBe: identidade textual estrita — qualquer divergência permite
    // enumeração de contas e quebra a Lei 9.
    expect(userNotFoundMessage).toBe(wrongPasswordMessage);
    expect(userNotFoundMessage).toBe(AUTH_MESSAGES.INVALID_CREDENTIALS);
  });
});

describe("useSignIn — rate limit (AC-07)", () => {
  test("429 → mensagem RATE_LIMITED", async () => {
    server.use(
      http.post(TOKEN_ENDPOINT, () =>
        HttpResponse.json(
          { error: "rate_limit", message: "Email rate limit exceeded" },
          { status: 429 },
        ),
      ),
    );

    const { result } = renderWithClient(() => useSignIn());
    result.current.mutate({ email: "joao@x.com", password: "Segura123" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.RATE_LIMITED);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe("useSignIn — falhas de rede", () => {
  test("HttpResponse.error() → mensagem NETWORK_ERROR", async () => {
    server.use(http.post(TOKEN_ENDPOINT, () => HttpResponse.error()));

    const { result } = renderWithClient(() => useSignIn());
    result.current.mutate({ email: "joao@x.com", password: "Segura123" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe(AUTH_MESSAGES.NETWORK_ERROR);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe("useSignIn — defesa em profundidade (Leis 1 e 2)", () => {
  test("schema rejeita email inválido SEM tocar o Supabase (Lei 1)", async () => {
    let supabaseCalls = 0;
    server.use(
      http.post(TOKEN_ENDPOINT, () => {
        supabaseCalls += 1;
        return HttpResponse.json(SUCCESS_BODY, { status: 200 });
      }),
    );

    const { result } = renderWithClient(() => useSignIn());
    result.current.mutate({ email: "naoeumemail", password: "123" } as LoginInput);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(supabaseCalls).toBe(0);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(result.current.error?.message).toBe(AUTH_MESSAGES.UNEXPECTED_ERROR);
  });

  test("normaliza email (trim + lowercase) antes de enviar (sanitização)", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(TOKEN_ENDPOINT, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(SUCCESS_BODY, { status: 200 });
      }),
    );

    const { result } = renderWithClient(() => useSignIn());
    result.current.mutate({ email: "  JOAO@X.COM  ", password: "Segura123" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const body = capturedBody as { email?: string; password?: string };
    expect(body.email).toBe("joao@x.com");
    expect(body.password).toBe("Segura123");
  });

  test("Lei 2: campos extras no input são rejeitados pelo schema .strict()", async () => {
    let supabaseCalls = 0;
    server.use(
      http.post(TOKEN_ENDPOINT, () => {
        supabaseCalls += 1;
        return HttpResponse.json(SUCCESS_BODY, { status: 200 });
      }),
    );

    const { result } = renderWithClient(() => useSignIn());
    result.current.mutate(
      { email: "x@y.com", password: "Segura123", isAdmin: true } as unknown as LoginInput,
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(supabaseCalls).toBe(0);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  test("Lei 2: payload enviado expõe APENAS email/password do nosso input — nada do user input vaza", async () => {
    // O SDK do Supabase pode adicionar campos próprios (ex.: `gotrue_meta_security`)
    // — isso é responsabilidade do SDK e não conta como mass assignment do
    // nosso lado. A invariância que importa é: NADA que veio do form do
    // usuário, além de email+password, alcança a rede.
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(TOKEN_ENDPOINT, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(SUCCESS_BODY, { status: 200 });
      }),
    );

    const { result } = renderWithClient(() => useSignIn());
    // Tentamos "envenenar" o input com o nome de uma flag privilegiada.
    // O schema `.strict()` deve rejeitar antes da rede; este `mutate` falhará.
    result.current.mutate(
      {
        email: "joao@x.com",
        password: "Segura123",
        sneaky_field: "x",
      } as unknown as LoginInput,
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Como o schema bloqueou, NADA chegou ao Supabase.
    expect(capturedBody).toBeNull();

    // Segundo round: input limpo, agora vai. Asseguramos que o body
    // contém email/password com VALORES corretos e que nenhum campo
    // chamado "sneaky_field" jamais foi enviado.
    result.current.mutate({ email: "joao@x.com", password: "Segura123" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    const body = capturedBody as unknown as Record<string, unknown>;
    expect(body.email).toBe("joao@x.com");
    expect(body.password).toBe("Segura123");
    expect(body).not.toHaveProperty("sneaky_field");
    expect(body).not.toHaveProperty("isAdmin");
  });
});
