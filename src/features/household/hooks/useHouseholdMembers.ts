/**
 * `useHouseholdMembers` — query para listar membros do household (AC-10).
 *
 * Retorna lista de membros com:
 *   - JOIN com `user_profiles` para nome
 *   - Inclui `left_at` para mostrar histórico
 *   - Ordena por `role` (owner primeiro) e `joined_at`
 *
 * Invariantes de segurança:
 *   - **Lei 1**: RLS garante que apenas membros do mesmo household veem a lista.
 *   - **RN-22**: Inclui membros com `left_at IS NOT NULL` para histórico.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";

export interface HouseholdMember {
  id: string;
  userId: string;
  fullName: string;
  role: "owner" | "member";
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
}

interface RawMemberRow {
  id: string;
  user_id: string;
  household_id: string;
  role: "owner" | "member";
  joined_at: string;
  left_at: string | null;
  user_profiles: { full_name: string } | null;
}

function transformMember(row: RawMemberRow): HouseholdMember {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.user_profiles?.full_name ?? "Usuário",
    role: row.role,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    isActive: row.left_at === null,
  };
}

export function useHouseholdMembers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const householdId = useAuthStore((s) => s.householdId);

  return useQuery({
    queryKey: ["household-members", householdId],
    queryFn: async (): Promise<HouseholdMember[]> => {
      const { data, error } = await supabase
        .from("household_members")
        .select(
          `
          id,
          user_id,
          household_id,
          role,
          joined_at,
          left_at,
          user_profiles!inner(full_name)
        `
        )
        .order("role", { ascending: true })
        .order("joined_at", { ascending: true });

      if (error) {
        throw error;
      }

      const rows = data as unknown as RawMemberRow[];
      return rows.map(transformMember);
    },
    enabled: isAuthenticated && householdId !== null,
    staleTime: 2 * 60 * 1000,
  });
}
