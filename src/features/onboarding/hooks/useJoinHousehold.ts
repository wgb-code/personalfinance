/**
 * Hook para entrar em um household via invite code (AC-06, AC-07, AC-08.1).
 *
 * Chama o RPC `join_household` e, em sucesso:
 *   - Atualiza `useAuthStore.householdId` via setter controlado (RN-28)
 *   - Invalida cache de `current-household` para sincronização
 *
 * Verificações de segurança:
 *   - **RN-15.1**: código normalizado para UPPERCASE + trim antes do RPC.
 *   - **Lei 9 (Exposição mínima)**: código inválido vs expirado = mesma mensagem.
 *   - **RN-17.2**: mensagem específica para ALREADY_MEMBER (exceção intencional).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";
import { mapOnboardingError } from "../lib/onboarding-errors";

export interface JoinHouseholdInput {
  code: string;
}

export interface JoinHouseholdResponse {
  household_id: string;
  name: string;
  role: "member";
}

export function useJoinHousehold() {
  const queryClient = useQueryClient();
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);

  return useMutation({
    mutationFn: async (
      input: JoinHouseholdInput
    ): Promise<JoinHouseholdResponse> => {
      const { data, error } = await supabase.rpc("join_household", {
        p_code: input.code.trim().toUpperCase(),
      });

      if (error) {
        throw new Error(mapOnboardingError(error));
      }

      return data as JoinHouseholdResponse;
    },
    onSuccess: (data) => {
      setHouseholdId(data.household_id);
      queryClient.invalidateQueries({ queryKey: ["current-household"] });
    },
  });
}
