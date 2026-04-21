/**
 * `sanitizeRedirectPath` — defesa contra Open Redirect (RN-18).
 *
 * O atacante clássico envia um link como
 *   `https://app.exemplo.com/login?redirectTo=https://evil.com`
 * esperando que, após login, o usuário seja jogado num phishing
 * pixel-perfect. A defesa OBRIGATÓRIA é nunca confiar no parâmetro
 * `redirectTo` cru — apenas paths internos relativos podem passar.
 *
 * Vetores cobertos (testados em `safe-redirect.test.ts`):
 *   - URL absoluta (`http://`, `https://`, qualquer esquema).
 *   - Protocol-relative (`//evil.com`, `/\evil.com`, `\\evil.com`).
 *   - Esquemas perigosos (`javascript:`, `data:`, `vbscript:`,
 *     `file:`, `mailto:`, `tel:`, qualquer `<word>:`).
 *   - CRLF injection (cru `\r\n` ou codificado `%0d%0a`) — Lei 9
 *     (header injection no Set-Cookie).
 *   - Path traversal (`/../etc/passwd`, `/foo/../../bar`,
 *     codificado `%2e%2e`).
 *   - Decode malformado (`%E0%A4%A`, `%`) — devem retornar `null`,
 *     nunca lançar.
 *   - DoS por payload gigante (cap em `MAX_REDIRECT_LENGTH`).
 *
 * Princípio: WHITELIST agressiva. Quando em dúvida, `null`.
 *
 * Lei 14 (Logging higiênico): logamos APENAS uma mensagem genérica
 * via `console.warn`. NUNCA o valor original (que pode conter token
 * de phishing ou dados sensíveis colados pelo usuário).
 */
import {
  DEFAULT_REDIRECT,
  MAX_REDIRECT_LENGTH,
  REDIRECT_MESSAGES,
} from "@/features/auth/lib/constants";

export { DEFAULT_REDIRECT, MAX_REDIRECT_LENGTH };

/**
 * Caracteres ASCII considerados seguros num path/query/fragment URI
 * (subset de RFC 3986 expandido com `%` para encoding e `:` que pode
 * aparecer dentro de paths internos sem ser scheme delimiter).
 *
 * O ponto-chave é que JÁ rejeitamos backslash, controle, scheme e
 * protocol-relative em outras camadas — esta regex é a barreira final
 * contra qualquer caractere "exótico" não previsto (zero-width, RTL
 * override, etc.).
 */
const SAFE_URI_CHARS = /^[A-Za-z0-9\-._~!$&'()*+,;=:@/?#%]+$/;

/**
 * Caracteres de controle proibidos em qualquer posição.
 *
 * Inclui CR, LF, TAB, NULL, FF, VT — qualquer um habilitaria CRLF
 * injection ou parsing inconsistente entre camadas (proxy, browser,
 * router). O lint `no-control-regex` é desativado AQUI propositalmente:
 * detectar control chars é o objetivo desta regex.
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/**
 * Tenta decodificar uma string sem lançar.
 *
 * `decodeURIComponent` lança `URIError` em sequências como `%E0%A4%A`
 * ou `%G1`. Capturamos e retornamos `null` para que o caller trate
 * como "input inválido" sem propagar a exceção.
 */
function safeDecode(input: string): string | null {
  try {
    return decodeURIComponent(input);
  } catch {
    return null;
  }
}

/**
 * Verifica se há segmento `..` ou `.` em qualquer nível do pathname.
 *
 * Considera apenas a parte ANTES de `?` ou `#` (query/fragment podem
 * conter `..` legitimamente — ex.: `?range=1..10`).
 */
function hasTraversalSegment(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  const segments = pathname.split("/");
  for (const segment of segments) {
    if (segment === ".." || segment === ".") return true;
  }
  return false;
}

/**
 * Limite de iterações de decode recursivo.
 *
 * Atacantes podem encadear codificações (`%252e` → `%2e` → `.`) para
 * burlar uma única rodada de `decodeURIComponent`. Decodificamos até
 * estabilizar, com cap rígido para evitar DoS por payload artesanal.
 * 5 cobre folgadamente o pior caso prático (double-encode é o limite
 * que browsers reais aplicam ao normalizar URLs).
 */
const MAX_DECODE_ITERATIONS = 5;

/**
 * Sanitiza um valor de `?redirectTo=` ou similar.
 *
 * @returns o path original (com whitespace removido das bordas) se
 *   for um path interno seguro; `null` em qualquer outro caso.
 *
 * NÃO normaliza nem modifica o conteúdo além de `trim()` — devolver
 * o input "como está" mantém querystring e fragment intactos para
 * o consumer (ex.: `/bills/123?tab=fixed#nota` precisa preservar
 * `#nota`).
 *
 * Estratégia em camadas:
 *   1. Limites de tamanho e tipo (Lei 3 — DoS).
 *   2. Whitelist de caracteres no input cru — qualquer byte fora do
 *      conjunto seguro derruba (cobre `\`, controle, zero-width, etc.).
 *   3. Loop de decode até estabilizar (defesa contra double-encoding):
 *      em cada rodada validamos leading-`/`, ausência de protocol-relative,
 *      ausência de path traversal e ausência de chars de controle.
 *      Decodes que lançam `URIError` derrubam o input.
 */
export function sanitizeRedirectPath(
  input: string | null | undefined,
): string | null {
  if (input == null || typeof input !== "string") return null;
  if (input.length === 0 || input.length > MAX_REDIRECT_LENGTH) return null;

  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  if (!SAFE_URI_CHARS.test(trimmed)) return null;

  let current = trimmed;
  for (let i = 0; i < MAX_DECODE_ITERATIONS; i++) {
    if (FORBIDDEN_CONTROL_CHARS.test(current)) return null;
    if (current.includes("\\")) return null;
    if (current[0] !== "/") return null;
    if (current[1] === "/" || current[1] === "\\") return null;
    if (hasTraversalSegment(current)) return null;

    const next = safeDecode(current);
    if (next === null) return null;
    if (next === current) break;
    current = next;
  }

  return trimmed;
}

/**
 * Helper conveniência: sanitiza e cai num fallback se inválido.
 *
 * Quando o input é descartado, registramos um aviso GENÉRICO (sem o
 * valor) — Lei 14. Isso ajuda observabilidade ("alguém tentou abrir
 * um redirect inválido") sem virar vetor de log poisoning.
 */
export function safeRedirectOr(
  input: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  const sanitized = sanitizeRedirectPath(input);
  if (sanitized !== null) return sanitized;
  console.warn(REDIRECT_MESSAGES.DISCARDED);
  return fallback;
}
