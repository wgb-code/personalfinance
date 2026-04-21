/**
 * `AuthBootstrap` — wrapper que inicializa autenticação antes de renderizar children.
 *
 * Responsabilidades:
 *   - AC-08: Inicializa sessão via `useInitAuth`
 *   - AC-09: Monitora inatividade via `useIdleTimer`
 *   - AC-13.1: Após autenticação, busca `householdId` via `useCurrentHousehold`
 *
 * Enquanto `isInitializing === true` OU (autenticado E household loading),
 * exibe um spinner centralizado.
 * Após ambos resolverem, renderiza os children (rotas).
 * Se o usuário ficar 4h inativo, exibe modal e faz logout.
 *
 * Leis de segurança:
 *   - Lei 1: sessão vem APENAS do SDK Supabase via `useInitAuth`
 *   - Lei 14: logout em `onSettled` garante limpeza mesmo em falha
 *   - RN-28: householdId via `setHouseholdId` (setter controlado)
 */
import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";

import { useCurrentHousehold } from "@/features/household/hooks/useCurrentHousehold";
import { SessionExpiredModal } from "@/features/auth/components/SessionExpiredModal";
import { useIdleTimer } from "@/features/auth/hooks/useIdleTimer";
import { useInitAuth } from "@/features/auth/hooks/useInitAuth";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore, selectIsAuthenticated } from "@/stores/useAuthStore";

interface AuthBootstrapProps {
  children?: ReactNode;
}

export function AuthBootstrap({ children }: AuthBootstrapProps) {
  const { isInitializing: isAuthLoading } = useInitAuth();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const { logout } = useLogout();
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  const { isLoading: isHouseholdLoading } = useCurrentHousehold();

  useIdleTimer({
    onIdle: () => {
      if (isAuthenticated) {
        setShowSessionExpired(true);
      }
    },
  });

  const handleSessionExpiredClose = () => {
    setShowSessionExpired(false);
    logout();
  };

  const isInitializing =
    isAuthLoading || (isAuthenticated && isHouseholdLoading);

  if (isInitializing) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-label="Carregando aplicação"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {children ?? <Outlet />}
      <SessionExpiredModal
        isOpen={showSessionExpired}
        onClose={handleSessionExpiredClose}
      />
    </>
  );
}
