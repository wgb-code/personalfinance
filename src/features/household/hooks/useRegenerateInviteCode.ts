/**
 * `useRegenerateInviteCode` — mutation para regenerar invite code (AC-04).
 *
 * Chama RPC `regenerate_invite_code()`:
 *   - Invalida query `['household']` no success
 *   - Retorna novo código e expiração
 *
 * Invariantes de segurança:
 *   - **Lei 1**: RPC valida que caller é owner via `auth.uid()`.
 *   - **RN-9**: Apenas owner pode regenerar.
 *   - **RN-10**: Código anterior se torna inválido imediatamente.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { mapHouseholdError } from "@/features/household/lib/household-errors";

export interface RegenerateInviteCodeResponse {
  invite_code: string;
  invite_code_expires_at: string;
}

export function useRegenerateInviteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<RegenerateInviteCodeResponse> => {
      const { data, error } = await supabase.rpc("regenerate_invite_code");

      if (error) {
        throw new Error(mapHouseholdError(error));
      }

      return data as RegenerateInviteCodeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["household"] });
    },
  });
}
