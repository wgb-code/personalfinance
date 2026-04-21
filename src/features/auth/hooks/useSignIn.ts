/**
 * `useSignIn` — mutation React Query para login com email + senha
 * (AC-05). Mapeia erros via `mapAuthError` (AC-06/AC-07) e sincroniza
 * o `useAuthStore` ANTES de devolver o resultado.
 *
 * Por que sincronizar o store dentro do `mutationFn` (e não num
 * `onSuccess`)?
 *   - Componentes assinantes do store (ex.: `<ProtectedRoute>`) devem
 *     enxergar `isAuthenticated === true` no MESMO tick em que
 *     `result.isSuccess === true`. Mover para `onSuccess` introduz
 *     uma janela onde o React Query já reportou sucesso mas o store
 *     ainda está vazio — causa flash de "/login → /login → /destino"
 *     se o caller redirecionar imediatamente.
 *   - O `onAuthStateChange` do Supabase TAMBÉM popula o store via o
 *     bootstrap em `App.tsx`, mas é assíncrono. O `setSession` aqui é
 *     o "fast path" determinístico para o fluxo de login interativo.
 *
 * Defesas de segurança aplicadas:
 *   - **Lei 1 (Never trust client)**: input passa por `loginSchema.parse`
 *     antes de chegar ao Supabase. O `<LoginForm>` já valida via
 *     `zodResolver`, mas isto é cinto + suspensório (caller pode
 *     chamar `mutate` direto pulando o RHF).
 *   - **Lei 2 (Mass Assignment)**: ao chamar o Supabase, enviamos
 *     EXCLUSIVAMENTE `{ email, password }` extraídos por destructuring
 *     nominal. Sem `...input`, sem `...parsed` — qualquer campo extra
 *     que o caller injete é descartado pelo `.strict()` do schema E
 *     nunca chega à rede.
 *   - **Lei 9 (Exposição mínima)**: erros do Supabase são reescritos
 *     por `mapAuthError`. O usuário NUNCA vê "Invalid login credentials"
 *     em inglês nem stack do SDK.
 *   - **Lei 14 (Logging higiênico)**: ZERO `console.log/warn/error`.
 *     `password`, `email`, `access_token`, `refresh_token` jamais
 *     atravessam um `console.*` aqui.
 */
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";

import { mapAuthError } from "@/features/auth/lib/auth-errors";
import { loginSchema, type LoginInput } from "@/features/auth/lib/auth-schemas";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/useAuthStore";

export interface SignInResult {
  user: User;
  session: Session;
}

export interface UseSignInOptions {
  /**
   * Callback de conveniência. Chamado APÓS o store já estar populado
   * com a nova sessão — seguro para invocar `navigate(...)` aqui.
   */
  onSuccess?: (data: SignInResult) => void;
  /**
   * Callback de conveniência. Recebe a string pt-BR já mapeada por
   * `mapAuthError` — pronta para mostrar em `<FieldError>` ou toast.
   * NÃO recebe o `Error` cru: isso evitaria que o caller, por engano,
   * pegasse `error.stack` e logasse algo sensível.
   */
  onError?: (errorMessage: string) => void;
}

export type UseSignInReturn = UseMutationResult<SignInResult, Error, LoginInput>;

/**
 * Mutation de login. Use dentro de `<LoginForm>`:
 *
 * ```tsx
 * const { mutate, isPending, error } = useSignIn({
 *   onSuccess: () => navigateAfterAuth(),
 *   onError: (msg) => setFormError(msg),
 * });
 * ```
 *
 * O hook `usePostAuthRedirect` NÃO é chamado daqui de propósito —
 * hooks só podem ser usados dentro de componentes, e o destino do
 * redirect depende de `?redirectTo=` da URL (que é responsabilidade
 * do componente, não do hook de dados).
 */
export function useSignIn(options?: UseSignInOptions): UseSignInReturn {
  return useMutation<SignInResult, Error, LoginInput>({
    mutationFn: async (input: LoginInput): Promise<SignInResult> => {
      // Lei 1 — defesa em profundidade: o RHF do form já valida, mas
      // qualquer caller pode chamar `mutate` direto. Se algo passar,
      // NÃO repassamos o ZodError ao usuário (Lei 9).
      const parsed = loginSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(AUTH_MESSAGES.UNEXPECTED_ERROR);
      }

      // Lei 2 — destructuring nominal evita mass assignment. NÃO use
      // `...parsed.data` aqui: se o schema crescer no futuro, todo
      // campo novo vazaria automaticamente para o Supabase.
      const { email, password } = parsed.data;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(mapAuthError(error));
      }

      // Caso esquisito do SDK: sem `error` mas sem `session`. Tratamos
      // como credencial inválida (Lei 9 — não revele "session=null").
      // Não há teste explícito porque o SDK do Supabase normaliza esse
      // shape antes de devolver para nós; o guard fica como defesa em
      // profundidade caso uma versão futura mude o comportamento.
      if (!data.session || !data.user) {
        throw new Error(AUTH_MESSAGES.INVALID_CREDENTIALS);
      }

      // Sincronização eager do store: garante `isAuthenticated === true`
      // ANTES do `onSuccess` rodar. `getState()` é seguro fora de React.
      useAuthStore.getState().setSession(data.session);

      return { user: data.user, session: data.session };
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error.message);
    },
  });
}
