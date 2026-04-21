/**
 * `useCreateHousehold` — mutation para criar household (AC-01).
 *
 * Fluxo:
 *   1. Valida input com `createHouseholdSchema` (defesa em profundidade).
 *   2. Chama RPC `create_household(p_name)`.
 *   3. No sucesso: `setHouseholdId(id)` + invalida `current-household`.
 *
 * Invariantes de segurança:
 *   - **Lei 1**: `owner_id` vem do `auth.uid()` no RPC, não do cliente.
 *   - **Lei 2**: schema `.strict()` rejeita campos extras.
 *   - **RN-28**: usa `setHouseholdId`, nunca `setState` direto.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  createHouseholdSchema,
  type CreateHouseholdInput,
} from "@/features/onboarding/lib/onboarding-schemas";
import { mapOnboardingError } from "@/features/onboarding/lib/onboarding-errors";

export interface CreateHouseholdResponse {
  household_id: string;
  name: string;
  invite_code: string;
  invite_code_expires_at: string;
  role: "owner";
}

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);

  return useMutation({
    mutationFn: async (
      input: CreateHouseholdInput
    ): Promise<CreateHouseholdResponse> => {
      const parsed = createHouseholdSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0].message);
      }

      const { data, error } = await supabase.rpc("create_household", {
        p_name: parsed.data.name,
      });

      if (error) {
        throw new Error(mapOnboardingError(error));
      }

      return data as CreateHouseholdResponse;
    },
    onSuccess: (data) => {
      setHouseholdId(data.household_id);
      queryClient.invalidateQueries({ queryKey: ["current-household"] });
    },
  });
}
