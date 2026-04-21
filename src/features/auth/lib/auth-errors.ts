/**
 * `mapAuthError` — tradução defensiva de erros do Supabase Auth para
 * mensagens em pt-BR mostradas ao usuário final.
 *
 * Por que esta camada existe?
 *   - **Lei 9 (Exposição Mínima)**: o Supabase devolve mensagens em
 *     inglês com fingerprint do backend (ex.: "duplicate key value
 *     violates unique constraint \"users_email_key\""). Expor isso ao
 *     usuário (a) confunde quem fala português, (b) revela detalhes
 *     internos exploráveis (nome de constraint, schema, versão).
 *   - **Lei 14 (Logging Higiênico)**: esta função NÃO loga. Quem
 *     decidir logar é o caller — e mesmo assim deve logar APENAS a
 *     categoria mapeada, nunca `error.stack` ou `error.message` cru.
 *   - **Estabilidade contratual**: o texto exato de cada mensagem é
 *     verificado por testes com `toBe` (ver `auth-errors.test.ts` e
 *     os testes de `<LoginForm>`). Mudar uma string aqui é uma
 *     mudança de contrato — atualize os testes deliberadamente.
 *
 * Filosofia do mapeamento:
 *   1. Comparar pela MENSAGEM (substring case-insensitive) — o Supabase
 *      muda formatos de erro entre versões; substring é mais resiliente
 *      que `===`.
 *   2. Distinguir "email não confirmado" para orientar o usuário que
 *      acabou de se cadastrar, sem expor detalhes técnicos.
 *   3. Para credenciais inválidas, colapsar os ramos (email inexistente
 *      e senha errada) numa única mensagem para reduzir enumeração.
 *   4. Defensivo contra `unknown`: a borda da função aceita qualquer
 *      coisa — `null`, `undefined`, primitivos, Error sem `message`.
 *      Tudo cai em `UNEXPECTED_ERROR`.
 */
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

interface ErrorShape {
  message: string;
  status?: number;
  code?: string;
  name?: string;
}

/**
 * Extrai um shape canônico de `unknown` para que o restante da função
 * raciocine sobre um objeto previsível.
 *
 * Por que `unknown` em vez de `Error | AuthError`?
 *   - O bloco `catch` em TS é tipicamente `unknown` por padrão
 *     (`useUnknownInCatchVariables`). Forçar a tipagem aqui empurra
 *     o ônus para os callers e abre brecha para `as any` casual.
 *   - SDKs de terceiros (incluindo o Supabase) ocasionalmente lançam
 *     objetos plain (`{ message, status }`), Error real, ou strings.
 *     Tratar `unknown` é a única forma honesta.
 */
function extractErrorShape(error: unknown): ErrorShape {
  if (error instanceof Error) {
    const maybeStatus = (error as Error & { status?: unknown }).status;
    const maybeCode = (error as Error & { code?: unknown }).code;
    return {
      message: error.message ?? "",
      status: typeof maybeStatus === "number" ? maybeStatus : undefined,
      code: typeof maybeCode === "string" ? maybeCode : undefined,
      name: error.name,
    };
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      message: typeof obj.message === "string" ? obj.message : "",
      status: typeof obj.status === "number" ? obj.status : undefined,
      code: typeof obj.code === "string" ? obj.code : undefined,
      name: typeof obj.name === "string" ? obj.name : undefined,
    };
  }

  return { message: "" };
}

/**
 * Heurística para "isso parece um erro de rede?". Coberta em
 * `auth-errors.test.ts`. Mantida como função própria porque é o ramo
 * mais sensível a falsos positivos: classificar credencial inválida
 * como "rede" levaria o usuário a achar que está tudo bem com a senha.
 */
function isNetworkError(shape: ErrorShape): boolean {
  if (shape.name === "TypeError") return true;
  const msg = shape.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network")
  );
}

/**
 * Traduz qualquer erro de auth/Supabase para uma mensagem pt-BR
 * adequada ao usuário final.
 *
 * Garantias:
 *   - Sempre retorna uma string não vazia (nunca `undefined`).
 *   - Lei 9: credenciais inválidas e usuário inexistente retornam
 *     EXATAMENTE a mesma string (`AUTH_MESSAGES.INVALID_CREDENTIALS`).
 *   - Lei 14: NÃO loga.
 *
 * Ordem de avaliação importa:
 *   1. Rate limit (status 429 OU substring) — checar antes de
 *      "credenciais" porque o Supabase às vezes devolve 429 com message
 *      vazia, e queremos a UX correta de "espere uns minutos".
 *   2. Email não confirmado (login).
 *   3. Credenciais inválidas.
 *   4. Email já cadastrado (signup).
 *   5. Senha fraca (reset).
 *   6. Rede (TypeError ou substrings clássicas).
 *   7. Fallback `UNEXPECTED_ERROR`.
 */
/**
 * Verifica se um erro é de rate limit (AC-07).
 *
 * Útil para o caller decidir se deve mostrar countdown ou mensagem simples.
 * Aceita o `unknown` original ou a string já mapeada por `mapAuthError`.
 */
export function isRateLimitError(error: unknown): boolean {
  if (typeof error === "string") {
    return error === AUTH_MESSAGES.RATE_LIMITED;
  }
  const shape = extractErrorShape(error);
  const msg = shape.message.toLowerCase();
  return (
    shape.status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("429")
  );
}

export function mapAuthError(error: unknown): string {
  const shape = extractErrorShape(error);
  const msg = shape.message.toLowerCase();

  if (shape.status === 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("429")) {
    return AUTH_MESSAGES.RATE_LIMITED;
  }

  if (msg.includes("email not confirmed")) {
    return AUTH_MESSAGES.EMAIL_NOT_CONFIRMED;
  }

  if (
    shape.code === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid email or password") ||
    msg.includes("user not found")
  ) {
    return AUTH_MESSAGES.INVALID_CREDENTIALS;
  }

  if (
    msg.includes("user already registered") ||
    msg.includes("email already") ||
    msg.includes("already exists")
  ) {
    return AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED;
  }

  if (msg.includes("weak password") || msg.includes("password should be at least")) {
    return AUTH_MESSAGES.WEAK_PASSWORD;
  }

  if (isNetworkError(shape)) {
    return AUTH_MESSAGES.NETWORK_ERROR;
  }

  return AUTH_MESSAGES.UNEXPECTED_ERROR;
}
