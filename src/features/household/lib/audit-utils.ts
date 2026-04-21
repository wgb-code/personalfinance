/**
 * Utilitários de formatação do audit trail (AC-18).
 *
 * Gera descrições legíveis em pt-BR para cada tipo de ação.
 */

export type AuditAction = "joined" | "left" | "removed";

/**
 * Gera descrição legível para uma ação de audit.
 *
 * @example
 * formatAuditDescription('joined', 'João', 'João')
 * // "João entrou no household"
 *
 * formatAuditDescription('left', 'Carlos', 'Carlos')
 * // "Carlos saiu do household"
 *
 * formatAuditDescription('removed', 'Carlos', 'Maria')
 * // "Carlos foi removido por Maria"
 */
export function formatAuditDescription(
  action: AuditAction,
  userFullName: string,
  performerFullName: string
): string {
  switch (action) {
    case "joined":
      return `${userFullName} entrou no household`;
    case "left":
      return `${userFullName} saiu do household`;
    case "removed":
      return `${userFullName} foi removido por ${performerFullName}`;
    default: {
      const exhaustive: never = action;
      throw new Error(`Ação de audit desconhecida: ${exhaustive}`);
    }
  }
}
