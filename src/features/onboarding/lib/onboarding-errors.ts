/**
 * Mapeamento de erros de RPC de onboarding para mensagens pt-BR (Lei 9).
 *
 * Erros de domínio do Supabase vêm como SQLSTATE P0001 com message no padrão
 * `<CODE>: <descrição>` ou apenas `<CODE>`. Mapeamos para mensagens amigáveis.
 */
import { ONBOARDING_MESSAGES } from "@/features/onboarding/lib/onboarding-constants";

interface ErrorShape {
  message: string;
  code?: string;
  status?: number;
}

function extractErrorShape(error: unknown): ErrorShape {
  if (error instanceof Error) {
    const maybeCode = (error as Error & { code?: unknown }).code;
    const maybeStatus = (error as Error & { status?: unknown }).status;
    return {
      message: error.message ?? "",
      code: typeof maybeCode === "string" ? maybeCode : undefined,
      status: typeof maybeStatus === "number" ? maybeStatus : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      message: typeof obj.message === "string" ? obj.message : "",
      code: typeof obj.code === "string" ? obj.code : undefined,
      status: typeof obj.status === "number" ? obj.status : undefined,
    };
  }

  return { message: "" };
}

/**
 * Mapeia erros de RPCs de onboarding para mensagens pt-BR.
 *
 * Códigos de erro esperados (SQLSTATE P0001):
 *   - NAME_REQUIRED: nome vazio
 *   - NAME_TOO_LONG: nome > 100 chars
 *   - GENERATION_FAILED: colisão de invite code após 5 tentativas
 *   - INVALID_OR_EXPIRED_CODE: código inválido ou expirado (Lei 9 — mesma msg)
 *   - ALREADY_MEMBER: usuário já pertence a um household
 *   - RATE_LIMITED: 5 tentativas de join por minuto
 */
export function mapOnboardingError(error: unknown): string {
  const shape = extractErrorShape(error);
  const msg = shape.message.toUpperCase();

  if (shape.status === 429 || msg.includes("RATE_LIMITED")) {
    return ONBOARDING_MESSAGES.RATE_LIMITED;
  }

  if (msg.includes("NAME_REQUIRED")) {
    return ONBOARDING_MESSAGES.HOUSEHOLD_NAME_REQUIRED;
  }

  if (msg.includes("NAME_TOO_LONG")) {
    return ONBOARDING_MESSAGES.HOUSEHOLD_NAME_TOO_LONG;
  }

  if (msg.includes("GENERATION_FAILED")) {
    return ONBOARDING_MESSAGES.GENERATION_FAILED;
  }

  if (msg.includes("INVALID_OR_EXPIRED_CODE")) {
    return ONBOARDING_MESSAGES.INVITE_CODE_INVALID_OR_EXPIRED;
  }

  if (msg.includes("ALREADY_MEMBER")) {
    return ONBOARDING_MESSAGES.ALREADY_MEMBER;
  }

  return ONBOARDING_MESSAGES.UNEXPECTED_ERROR;
}

/**
 * Verifica se o erro é de rate limit (para exibir countdown).
 */
export function isRateLimitError(error: unknown): boolean {
  if (typeof error === "string") {
    return error === ONBOARDING_MESSAGES.RATE_LIMITED;
  }
  const shape = extractErrorShape(error);
  return (
    shape.status === 429 || shape.message.toUpperCase().includes("RATE_LIMITED")
  );
}
