/**
 * `useForgotPassword` — mutation React Query para solicitação de reset de senha
 * (AC-11). Chama `supabase.auth.resetPasswordForEmail` e SEMPRE retorna
 * mensagem genérica para evitar enumeração de contas (Lei 9).
 *
 * Por que sempre retornar sucesso mesmo com erro do Supabase?
 *   - **Lei 9 (Exposição mínima)**: um atacante não pode descobrir quais
 *     emails estão cadastrados testando este endpoint. A resposta é
 *     IDENTICA para emails existentes e inexistentes.
 *   - Exceção: erros de rede são propagados porque indicam problema
 *     técnico, não informação sobre o email.
 *
 * Defesas de segurança aplicadas:
 *   - **Lei 1 (Never trust client)**: input passa por `forgotPasswordSchema`
 *     antes de chegar ao Supabase. O schema normaliza email (trim + lowercase).
 *   - **Lei 2 (Mass Assignment)**: apenas `email` é extraído; campos extras
 *     são descartados pelo `.strict()` do schema.
 *   - **Lei 14 (Logging higiênico)**: ZERO `console.*`. Nunca logar email.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { mapAuthError } from "@/features/auth/lib/auth-errors";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/lib/auth-schemas";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";
import { supabase } from "@/lib/supabase";

export interface UseForgotPasswordOptions {
  /**
   * Callback de conveniência. Chamado após a mutation completar com sucesso.
   * Recebe a mensagem genérica (sempre a mesma, independente do resultado real).
   */
  onSuccess?: (message: string) => void;
  /**
   * Callback de erro. Chamado APENAS para erros de rede (não para "email não
   * encontrado", que é tratado como sucesso — Lei 9).
   */
  onError?: (errorMessage: string) => void;
}

export type UseForgotPasswordReturn = UseMutationResult<
  string,
  Error,
  ForgotPasswordInput
>;

/**
 * Mutation de solicitação de reset. Use dentro de `<ForgotPasswordForm>`:
 *
 * ```tsx
 * const { mutate, isPending, isSuccess, data } = useForgotPassword({
 *   onSuccess: (msg) => setSuccessMessage(msg),
 *   onError: (msg) => setFormError(msg),
 * });
 * ```
 */
export function useForgotPassword(
  options?: UseForgotPasswordOptions
): UseForgotPasswordReturn {
  return useMutation<string, Error, ForgotPasswordInput>({
    mutationFn: async (input: ForgotPasswordInput): Promise<string> => {
      const parsed = forgotPasswordSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(AUTH_MESSAGES.UNEXPECTED_ERROR);
      }

      const { email } = parsed.data;

      const redirectTo = `${window.location.origin}/reset-password`;

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });

        if (error) {
          const mapped = mapAuthError(error);
          if (mapped === AUTH_MESSAGES.NETWORK_ERROR) {
            throw new Error(mapped);
          }
        }
      } catch (err) {
        const mapped = mapAuthError(err);
        if (mapped === AUTH_MESSAGES.NETWORK_ERROR) {
          throw new Error(mapped);
        }
      }

      return AUTH_MESSAGES.FORGOT_PASSWORD_SUCCESS;
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error.message);
    },
  });
}
