/**
 * Constantes do módulo de onboarding.
 *
 * Centralizar limites e mensagens evita "vibes coding" e garante consistência
 * entre schemas Zod, mensagens de UI e RPCs.
 */

export const HOUSEHOLD_NAME_MIN_LENGTH = 1;
export const HOUSEHOLD_NAME_MAX_LENGTH = 100;

export const INVITE_CODE_LENGTH = 6;
export const INVITE_CODE_EXPIRY_HOURS = 48;

/**
 * Mensagens de validação e UI em pt-BR.
 *
 * Mantidas como `as const` para permitir asserts exatos nos testes.
 */
export const ONBOARDING_MESSAGES = {
  HOUSEHOLD_NAME_REQUIRED: "Nome é obrigatório",
  HOUSEHOLD_NAME_TOO_LONG: "Nome deve ter no máximo 100 caracteres",

  INVITE_CODE_LENGTH: "Código deve ter 6 caracteres",
  INVITE_CODE_INVALID_OR_EXPIRED: "Código inválido ou expirado",

  ALREADY_MEMBER: "Você já pertence a um household. Saia primeiro para entrar em outro.",
  RATE_LIMITED: "Muitas tentativas. Aguarde 1 minuto.",

  CREATE_SUCCESS: "Household criado com sucesso",
  JOIN_SUCCESS: "Você entrou no household",
  SKIP_SUCCESS: "Household solo criado com sucesso",

  GENERATION_FAILED: "Não foi possível gerar código, tente novamente.",
  UNEXPECTED_ERROR: "Não foi possível concluir a operação. Tente novamente.",
} as const;

export type OnboardingMessageKey = keyof typeof ONBOARDING_MESSAGES;
