/**
 * Constantes do módulo de household.
 *
 * Centraliza limites e mensagens para evitar "vibes coding" e garantir
 * consistência entre schemas Zod, mensagens de UI e RPCs.
 */

/**
 * Mensagens de validação e UI em pt-BR.
 *
 * Mantidas como `as const` para permitir asserts exatos nos testes.
 */
export const HOUSEHOLD_MESSAGES = {
  NOT_OWNER: "Apenas o dono do household pode realizar esta ação",
  NO_HOUSEHOLD: "Você não pertence a nenhum household",
  OWNER_HAS_ACTIVE_MEMBERS:
    "Não é possível sair com outros membros ativos. Transfira a ownership primeiro.",
  TARGET_NOT_MEMBER: "Este usuário não é membro ativo do household",
  CANNOT_REMOVE_SELF: "Não é possível remover a si mesmo",

  REGENERATE_SUCCESS: "Código regenerado com sucesso",
  LEAVE_SUCCESS: "Você saiu do household",
  REMOVE_SUCCESS: (name: string) => `${name} foi removido do household`,

  UNEXPECTED_ERROR: "Não foi possível concluir a operação. Tente novamente.",
} as const;

export type HouseholdMessageKey = keyof typeof HOUSEHOLD_MESSAGES;
