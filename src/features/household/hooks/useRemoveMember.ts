/**
 * `useRemoveMember` — mutation para owner remover membro (AC-12).
 *
 * Chama RPC `remove_member(p_target_user_id)`:
 *   - Invalida `['household-members']` e `['household-audit']` no success
 *   - **NÃO** altera `householdId` do caller (é owner)
 *
 * Invariantes de segurança:
 *   - **Lei 1**: RPC valida que caller é owner via `auth.uid()`.
 *   - **RN-19**: Owner pode remover qualquer member.
 *   - **RN-21**: Owner não pode se auto-remover.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { mapHouseholdError } from "@/features/household/lib/household-errors";
import { invalidateHouseholdMemberQueries } from "@/features/household/lib/query-helpers";

export interface RemoveMemberInput {
  targetUserId: string;
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RemoveMemberInput): Promise<void> => {
      const { error } = await supabase.rpc("remove_member", {
        p_target_user_id: input.targetUserId,
      });

      if (error) {
        throw new Error(mapHouseholdError(error));
      }
    },
    onSuccess: () => {
      invalidateHouseholdMemberQueries(queryClient);
    },
  });
}
