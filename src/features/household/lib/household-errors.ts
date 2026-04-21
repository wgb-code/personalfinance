/**
 * Mapeamento de erros de RPC de household para mensagens pt-BR (Lei 9).
 *
 * Erros de domínio do Supabase vêm como SQLSTATE P0001 com message no padrão
 * `<CODE>: <descrição>` ou apenas `<CODE>`. Mapeamos para mensagens amigáveis.
 */
import { HOUSEHOLD_MESSAGES } from "@/features/household/lib/household-constants";

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
 * Mapeia erros de RPCs de household para mensagens pt-BR.
 *
 * Códigos de erro esperados (SQLSTATE P0001):
 *   - NOT_OWNER: usuário não é owner do household
 *   - NO_HOUSEHOLD: usuário não pertence a nenhum household
 *   - OWNER_HAS_ACTIVE_MEMBERS: owner não pode sair com membros ativos
 *   - TARGET_NOT_MEMBER: target não é membro ativo
 *   - CANNOT_REMOVE_SELF: owner não pode remover a si mesmo
 *   - GENERATION_FAILED: colisão de invite code após 5 tentativas
 */
export function mapHouseholdError(error: unknown): string {
  const shape = extractErrorShape(error);
  const msg = shape.message.toUpperCase();

  if (msg.includes("NOT_OWNER")) {
    return HOUSEHOLD_MESSAGES.NOT_OWNER;
  }

  if (msg.includes("NO_HOUSEHOLD")) {
    return HOUSEHOLD_MESSAGES.NO_HOUSEHOLD;
  }

  if (msg.includes("OWNER_HAS_ACTIVE_MEMBERS")) {
    return HOUSEHOLD_MESSAGES.OWNER_HAS_ACTIVE_MEMBERS;
  }

  if (msg.includes("TARGET_NOT_MEMBER")) {
    return HOUSEHOLD_MESSAGES.TARGET_NOT_MEMBER;
  }

  if (msg.includes("CANNOT_REMOVE_SELF")) {
    return HOUSEHOLD_MESSAGES.CANNOT_REMOVE_SELF;
  }

  return HOUSEHOLD_MESSAGES.UNEXPECTED_ERROR;
}
