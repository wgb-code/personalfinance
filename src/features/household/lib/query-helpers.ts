/**
 * Helpers para gerenciamento de queries de household (RN-22.1).
 *
 * Após `leave`/`remove`, React Query invalida queries dependentes de household.
 * Este helper centraliza a lógica de limpeza para evitar duplicação.
 */
import { QueryClient } from "@tanstack/react-query";

/**
 * Remove todas as queries relacionadas a household do cache.
 *
 * Usado após:
 *   - `useLeaveHousehold` (member sai)
 *   - `useRemoveMember` quando o target é o próprio usuário
 *
 * Queries removidas:
 *   - `current-household`
 *   - `household`
 *   - `household-members`
 *   - `household-audit`
 *   - Qualquer query cujo primeiro elemento comece com "household"
 */
export function clearHouseholdQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return (
        typeof key === "string" &&
        (key.startsWith("household") || key === "current-household")
      );
    },
  });
}

/**
 * Invalida queries de membros e audit (não remove).
 *
 * Usado após:
 *   - `useRemoveMember` (owner remove outro member)
 *   - `useRegenerateInviteCode`
 *
 * Queries invalidadas:
 *   - `household-members`
 *   - `household-audit`
 */
export function invalidateHouseholdMemberQueries(
  queryClient: QueryClient
): void {
  queryClient.invalidateQueries({ queryKey: ["household-members"] });
  queryClient.invalidateQueries({ queryKey: ["household-audit"] });
}
