/**
 * `useLeaveHousehold` — mutation para member sair do household (AC-11).
 *
 * Chama RPC `leave_household()`:
 *   - No success: `setHouseholdId(null)` + remove queries dependentes
 *   - Usa helper `clearHouseholdQueries(queryClient)` para limpeza
 *
 * Invariantes de segurança:
 *   - **Lei 1**: Identidade vem do `auth.uid()` no RPC.
 *   - **RN-28**: Usa `setHouseholdId`, nunca `setState` direto.
 *   - **RN-20**: Owner não pode sair com outros membros ativos.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";
import { mapHouseholdError } from "@/features/household/lib/household-errors";
import { clearHouseholdQueries } from "@/features/household/lib/query-helpers";

export function useLeaveHousehold() {
  const queryClient = useQueryClient();
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc("leave_household");

      if (error) {
        throw new Error(mapHouseholdError(error));
      }
    },
    onSuccess: () => {
      setHouseholdId(null);
      clearHouseholdQueries(queryClient);
    },
  });
}
