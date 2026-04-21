/**
 * `useHouseholdAudit` — query para audit trail do household (AC-18).
 *
 * Retorna audit trail com:
 *   - JOIN com `user_profiles` para resolver nomes
 *   - Ordena por `performed_at DESC` (mais recente primeiro)
 *   - Formata descrição legível ("João entrou no household")
 *
 * Invariantes de segurança:
 *   - **Lei 1**: RLS garante que apenas owner vê o audit (RN-26).
 *   - **RN-25**: Audit é imutável (apenas SELECT permitido).
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  formatAuditDescription,
  type AuditAction,
} from "@/features/household/lib/audit-utils";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  performedAt: string;
  userFullName: string;
  performerFullName: string;
  description: string;
}

interface RawAuditRow {
  id: string;
  household_id: string;
  user_id: string;
  action: AuditAction;
  performed_by: string;
  performed_at: string;
  metadata: Record<string, unknown>;
  user_profile: { full_name: string } | null;
  performer_profile: { full_name: string } | null;
}

function transformAuditEntry(row: RawAuditRow): AuditEntry {
  const userFullName = row.user_profile?.full_name ?? "Usuário";
  const performerFullName = row.performer_profile?.full_name ?? "Usuário";

  return {
    id: row.id,
    action: row.action,
    performedAt: row.performed_at,
    userFullName,
    performerFullName,
    description: formatAuditDescription(
      row.action,
      userFullName,
      performerFullName
    ),
  };
}

export function useHouseholdAudit() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const householdId = useAuthStore((s) => s.householdId);

  return useQuery({
    queryKey: ["household-audit", householdId],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from("household_member_audit")
        .select(
          `
          id,
          household_id,
          user_id,
          action,
          performed_by,
          performed_at,
          metadata,
          user_profile:user_profiles!household_member_audit_user_id_fkey(full_name),
          performer_profile:user_profiles!household_member_audit_performed_by_fkey(full_name)
        `
        )
        .order("performed_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = data as unknown as RawAuditRow[];
      return rows.map(transformAuditEntry);
    },
    enabled: isAuthenticated && householdId !== null,
    staleTime: 2 * 60 * 1000,
  });
}
