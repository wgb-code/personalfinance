/**
 * `useCurrentHousehold` — query para resolver o household atual do usuário (AC-13.1).
 *
 * Este hook é usado pelo `AuthBootstrap` (RN-28.1) para popular `householdId`
 * no `useAuthStore` logo após o `setSession`. A query chama o RPC
 * `get_current_household()` que retorna o household ativo do usuário.
 *
 * Comportamento:
 *   - Query é disabled quando `isAuthenticated === false`.
 *   - No `onSuccess`, chama `setHouseholdId(id | null)` (setter controlado).
 *   - `staleTime: 5 * 60 * 1000` (5 min) — evita refetch desnecessário.
 *
 * Invariantes de segurança:
 *   - **Lei 1**: a identidade vem do JWT (auth.uid() no RPC), não do cliente.
 *   - **RN-28**: usa `setHouseholdId`, nunca `setState({ householdId })` direto.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";

export interface CurrentHouseholdResponse {
  household_id: string | null;
  name: string | null;
  role: "owner" | "member" | null;
}

export function useCurrentHousehold() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setHouseholdId = useAuthStore((s) => s.setHouseholdId);

  return useQuery({
    queryKey: ["current-household"],
    queryFn: async (): Promise<CurrentHouseholdResponse> => {
      const { data, error } = await supabase.rpc("get_current_household");

      if (error) {
        throw error;
      }

      const response = data as CurrentHouseholdResponse;

      setHouseholdId(response?.household_id ?? null);

      return response;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}
