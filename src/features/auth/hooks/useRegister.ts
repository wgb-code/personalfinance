/**
 * `useRegister` — mutation React Query para cadastro com email + senha
 * (AC-01). Mapeia erros via `mapAuthError` e sincroniza o `useAuthStore`
 * ANTES de devolver o resultado.
 *
 * Fluxo:
 *   1. Valida input via `registerSchema` (Lei 1 — defesa em profundidade).
 *   2. Chama `supabase.auth.signUp` com `raw_user_meta_data.full_name`.
 *   3. Se avatar fornecido, valida magic bytes e faz upload para Storage.
 *   4. Sincroniza `useAuthStore` com a nova sessão.
 *   5. Navega para `/onboarding`.
 *
 * Defesas de segurança aplicadas:
 *   - **Lei 1 (Never trust client)**: input passa por `registerSchema.parse`
 *     antes de chegar ao Supabase.
 *   - **Lei 2 (Mass Assignment)**: ao chamar o Supabase, enviamos
 *     EXCLUSIVAMENTE `{ email, password, options: { data: { full_name }}}`.
 *   - **Lei 9 (Exposição mínima)**: erros do Supabase são reescritos
 *     por `mapAuthError`. O usuário NUNCA vê mensagens em inglês.
 *   - **Lei 12 (Upload Zero-Trust)**: avatar validado via magic bytes
 *     antes do upload via `validateAndProcessAvatar`.
 *   - **Lei 14 (Logging higiênico)**: ZERO `console.log/warn/error`.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";

import { mapAuthError } from "@/features/auth/lib/auth-errors";
import {
  registerSchema,
  type RegisterInput,
} from "@/features/auth/lib/auth-schemas";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";
import { validateAndProcessAvatar } from "@/features/auth/lib/avatar-validation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";

export interface RegisterResult {
  user: User;
  session: Session | null;
}

export type UseRegisterReturn = UseMutationResult<
  RegisterResult,
  Error,
  RegisterInput
>;

/**
 * Mutation de cadastro. Use dentro de `<RegisterForm>`:
 *
 * ```tsx
 * const { mutate, isPending, error } = useRegister();
 * ```
 *
 * Após sucesso, o hook automaticamente:
 *   1. Sincroniza `useAuthStore` com a sessão criada
 *   2. Navega para `/onboarding` (replace: true)
 */
export function useRegister(): UseRegisterReturn {
  const navigate = useNavigate();

  return useMutation<RegisterResult, Error, RegisterInput>({
    mutationFn: async (input: RegisterInput): Promise<RegisterResult> => {
      const parsed = registerSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(AUTH_MESSAGES.UNEXPECTED_ERROR);
      }

      const { email, password, fullName, avatar } = parsed.data;

      let response;
      try {
        response = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
      } catch (error) {
        throw new Error(mapAuthError(error));
      }

      const { data, error } = response;

      if (error) {
        throw new Error(mapAuthError(error));
      }

      if (!data.user) {
        throw new Error(AUTH_MESSAGES.UNEXPECTED_ERROR);
      }

      if (avatar) {
        const processed = await validateAndProcessAvatar({ file: avatar });
        const filePath = `${data.user.id}/${crypto.randomUUID()}.${processed.extension}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, processed.blob, {
            contentType: processed.mimeType,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(mapAuthError(uploadError));
        }
      }

      if (data.session) {
        useAuthStore.getState().setSession(data.session);
      }

      return { user: data.user, session: data.session };
    },
    onSuccess: (result) => {
      if (result.session) {
        navigate("/onboarding", { replace: true });
      }
    },
  });
}
