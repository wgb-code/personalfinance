/**
 * `useLogout` — mutation React Query para logout manual (AC-10).
 *
 * Fluxo completo:
 *   1. Chama `supabase.auth.signOut()` para invalidar tokens no servidor
 *   2. Reseta `useAuthStore` (limpa sessão local)
 *   3. Limpa cache do React Query (evita dados do usuário anterior)
 *   4. Navega para `/login` (com `replace: true` para não poluir histórico)
 *   5. Exibe toast de confirmação em pt-BR
 *
 * Defesas de segurança aplicadas:
 *   - **Lei 9 (Exposição mínima)**: limpa TODA a sessão e cache, não
 *     deixando rastros de dados do usuário anterior para o próximo.
 *   - **Lei 14 (Logging higiênico)**: nenhum dado sensível (token,
 *     email, etc.) é logado durante o fluxo de logout.
 *
 * Resiliência: mesmo que `signOut()` falhe (rede, servidor down), ainda
 * limpamos a sessão local. O usuário não fica "preso" na UI autenticada
 * quando o servidor está inacessível. O token expira naturalmente e o
 * refresh falhará no próximo acesso.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";

const LOGOUT_SUCCESS_MESSAGE = "Você saiu com sucesso";
const LOGIN_PATH = "/login";

export interface UseLogoutReturn {
  logout: () => void;
  isPending: boolean;
}

export function useLogout(): UseLogoutReturn {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        await supabase.auth.signOut();
      } catch {
        // Resiliência: ignoramos erro de signOut mas continuamos
        // limpando a sessão local. Ver docstring acima.
      }
    },
    onSettled: () => {
      // Executado em AMBOS os casos (sucesso ou erro) — Lei 9:
      // sempre limpamos a sessão local, mesmo se o signOut falhar.
      useAuthStore.getState().reset();
      queryClient.clear();
      navigate(LOGIN_PATH, { replace: true });
      toast.success(LOGOUT_SUCCESS_MESSAGE);
    },
  });

  return {
    logout: () => mutation.mutate(),
    isPending: mutation.isPending,
  };
}
