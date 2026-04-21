/**
 * `<ProtectedRoute />` — guarda de roteamento para AC-13, AC-14, AC-14.1 / RN-19, RN-29, RN-30, RN-30.1.
 *
 * Comportamento:
 *
 *   1. `isInitializing === true`: renderiza placeholder com
 *      `role="status"` e `aria-busy="true"`. NÃO redireciona — caso
 *      contrário, qualquer reload em rota protegida geraria flash de
 *      tela de login mesmo com sessão persistida válida.
 *
 *   2. `isAuthenticated === false`: redireciona para `/login` com
 *      `?redirectTo=<path-original>` URL-encoded (path + search + hash).
 *      `<Navigate replace />` evita poluir o histórico — o "voltar" do
 *      browser não deve trazer o usuário de volta à tela protegida que
 *      ele nem chegou a ver.
 *
 *   3. `isAuthenticated === true` + `requiresHousehold === true`:
 *      - Se `isHouseholdLoading` e `householdId === null`: loading (RN-30.1)
 *      - Se `householdId === null`: redireciona para `/onboarding` (RN-29)
 *      - Caso contrário, renderiza children/Outlet
 *
 *   4. `isAuthenticated === true` + `requiresHousehold === false`:
 *      - Se `householdId !== null`: redireciona para `/dashboard` (RN-30)
 *      - Caso contrário, renderiza children/Outlet (rotas de onboarding)
 *
 * NOTA: este componente é PURA lógica de sessão/roteamento. A versão
 * estilizada do estado "carregando" (skeleton, spinner, branding) será
 * polida pelo `layout-architect` no AC-04. O placeholder atual existe
 * apenas para destravar testes e ter `role="status"` acessível.
 */
import { type ReactElement, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useCurrentHousehold } from "@/features/household/hooks/useCurrentHousehold";
import {
  selectIsAuthenticated,
  selectIsInitializing,
  useAuthStore,
} from "@/stores/useAuthStore";

const LOGIN_PATH = "/login";
const ONBOARDING_PATH = "/onboarding";
const DASHBOARD_PATH = "/dashboard";
const REDIRECT_PARAM = "redirectTo";
const LOADING_LABEL = "Carregando…";

export interface ProtectedRouteProps {
  children?: ReactNode;
  requiresHousehold?: boolean;
}

export function ProtectedRoute({
  children,
  requiresHousehold = true,
}: ProtectedRouteProps): ReactElement {
  const isInitializing = useAuthStore(selectIsInitializing);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const householdId = useAuthStore((s) => s.householdId);
  const location = useLocation();

  const { isLoading: isHouseholdLoading } = useCurrentHousehold();

  if (isInitializing) {
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        {LOADING_LABEL}
      </div>
    );
  }

  if (!isAuthenticated) {
    const target = `${location.pathname}${location.search}${location.hash}`;
    const search = `?${REDIRECT_PARAM}=${encodeURIComponent(target)}`;
    return <Navigate to={`${LOGIN_PATH}${search}`} replace />;
  }

  if (requiresHousehold && isHouseholdLoading && householdId === null) {
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        {LOADING_LABEL}
      </div>
    );
  }

  if (requiresHousehold && !householdId) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }

  if (!requiresHousehold && householdId) {
    return <Navigate to={DASHBOARD_PATH} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
