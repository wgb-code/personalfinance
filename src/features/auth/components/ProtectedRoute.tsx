/**
 * `<ProtectedRoute />` — guarda de roteamento para AC-13 / RN-19.
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
 *   3. `isAuthenticated === true`: renderiza `children` se fornecido,
 *      caso contrário `<Outlet />` (suporta os DOIS estilos de uso do
 *      React Router v7 — wrapper inline e route element).
 *
 * NOTA: este componente é PURA lógica de sessão/roteamento. A versão
 * estilizada do estado "carregando" (skeleton, spinner, branding) será
 * polida pelo `layout-architect` no AC-04. O placeholder atual existe
 * apenas para destravar testes e ter `role="status"` acessível.
 */
import { type ReactElement, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import {
  selectIsAuthenticated,
  selectIsInitializing,
  useAuthStore,
} from "@/stores/useAuthStore";

const LOGIN_PATH = "/login";
const REDIRECT_PARAM = "redirectTo";
const LOADING_LABEL = "Carregando…";

export interface ProtectedRouteProps {
  children?: ReactNode;
}

export function ProtectedRoute({
  children,
}: ProtectedRouteProps): ReactElement {
  const isInitializing = useAuthStore(selectIsInitializing);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const location = useLocation();

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

  return <>{children ?? <Outlet />}</>;
}
