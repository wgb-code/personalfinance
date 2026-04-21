/**
 * `usePostAuthRedirect` — destino seguro pós-login/cadastro/reset.
 *
 * Lê `?redirectTo=` da URL atual, sanitiza via `sanitizeRedirectPath`
 * (RN-18 — open redirect prevention) e expõe:
 *
 *   - `redirectTo`: o path validado (ou `DEFAULT_REDIRECT` se ausente
 *     ou descartado).
 *   - `navigateAfterAuth`: efetua o `navigate(redirectTo, { replace: true })`.
 *     `replace: true` é proposital — evita que o botão "voltar" leve
 *     o usuário recém-autenticado de volta para a tela de login.
 *
 * @todo (AC-04) Quando o módulo 02 popular `householdId` no
 *   `useAuthStore`, o fallback deve passar a ser `/onboarding` quando
 *   `householdId === null` e `/dashboard` quando presente. Por ora, o
 *   roteador resolve `/` → tela apropriada, então `DEFAULT_REDIRECT`
 *   serve como ponto de indireção único e seguro.
 */
import { useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  DEFAULT_REDIRECT,
  safeRedirectOr,
} from "@/features/auth/lib/safe-redirect";

const REDIRECT_PARAM = "redirectTo";

export interface UsePostAuthRedirectResult {
  /** Path interno seguro para navegação. Nunca `null`. */
  redirectTo: string;
  /** Navega para `redirectTo` substituindo a entrada atual no histórico. */
  navigateAfterAuth: () => void;
}

export function usePostAuthRedirect(): UsePostAuthRedirectResult {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawParam = searchParams.get(REDIRECT_PARAM);

  const redirectTo = useMemo<string>(
    () => safeRedirectOr(rawParam, DEFAULT_REDIRECT),
    [rawParam],
  );

  const navigateAfterAuth = useCallback((): void => {
    navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);

  return { redirectTo, navigateAfterAuth };
}
