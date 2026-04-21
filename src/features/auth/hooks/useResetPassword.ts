/**
 * `useResetPassword` — mutation React Query para redefinição de senha via link
 * (AC-12). Chama `supabase.auth.updateUser({ password })` e navega para /login
 * após sucesso.
 *
 * Pré-requisito: o usuário deve ter chegado via link de reset enviado pelo
 * Supabase. O token é extraído automaticamente pelo SDK do Supabase via
 * hash/query da URL e aplicado na sessão antes de `updateUser` ser chamado.
 *
 * Defesas de segurança aplicadas:
 *   - **Lei 1 (Never trust client)**: input passa por `resetPasswordSchema`
 *     antes de chegar ao Supabase. O schema valida força e confirmação.
 *   - **Lei 2 (Mass Assignment)**: apenas `newPassword` é extraído via
 *     destructuring nominal; campos extras são descartados.
 *   - **Lei 9 (Exposição mínima)**: erros do Supabase são reescritos por
 *     `mapAuthError`. O usuário NUNCA vê mensagens internas em inglês.
 *   - **Lei 14 (Logging higiênico)**: ZERO `console.*`. Nunca logar senha.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { mapAuthError } from "@/features/auth/lib/auth-errors";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/auth/lib/auth-schemas";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";
import { supabase } from "@/lib/supabase";

export interface UseResetPasswordOptions {
  /**
   * Callback de conveniência. Chamado após a senha ser alterada com sucesso
   * (antes da navegação para /login).
   */
  onSuccess?: () => void;
  /**
   * Callback de erro. Recebe a string pt-BR já mapeada por `mapAuthError`.
   */
  onError?: (errorMessage: string) => void;
}

export type UseResetPasswordReturn = UseMutationResult<
  void,
  Error,
  ResetPasswordInput
>;

/**
 * Mutation de reset de senha. Use dentro de `<ResetPasswordForm>`:
 *
 * ```tsx
 * const { mutate, isPending, error } = useResetPassword({
 *   onSuccess: () => {},
 *   onError: (msg) => setFormError(msg),
 * });
 * ```
 */
export function useResetPassword(
  options?: UseResetPasswordOptions
): UseResetPasswordReturn {
  const navigate = useNavigate();

  return useMutation<void, Error, ResetPasswordInput>({
    mutationFn: async (input: ResetPasswordInput): Promise<void> => {
      const parsed = resetPasswordSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(AUTH_MESSAGES.UNEXPECTED_ERROR);
      }

      const { newPassword } = parsed.data;

      let result: Awaited<ReturnType<typeof supabase.auth.updateUser>>;
      try {
        result = await supabase.auth.updateUser({
          password: newPassword,
        });
      } catch (err) {
        throw new Error(mapAuthError(err));
      }

      if (result.error) {
        throw new Error(mapAuthError(result.error));
      }
    },
    onSuccess: () => {
      toast.success(AUTH_MESSAGES.RESET_PASSWORD_SUCCESS);
      options?.onSuccess?.();
      navigate("/login", { replace: true });
    },
    onError: (error) => {
      options?.onError?.(error.message);
    },
  });
}
