/**
 * `useAuthStore` — fonte de verdade da sessão no cliente (Zustand).
 *
 * Por que Zustand para SESSÃO e não React Query?
 *   - Sessão é estado global de UI/cliente: 100+ componentes podem ler
 *     `isAuthenticated` sem que isso justifique queries em cache de servidor.
 *   - O Supabase já é o "servidor de verdade" — o store é apenas um
 *     espelho local sincronizado por `supabase.auth.onAuthStateChange()`.
 *
 * Invariantes de segurança (Leis 1, 2, 9):
 *   - **Lei 1 (Never trust client)**: NUNCA aceitamos `user.id` /
 *     `householdId` vindos de input de componente. O store só é
 *     mutado via `setSession(session | null)` e `reset()` — ambos
 *     receem dados produzidos pelo SDK do Supabase (que valida JWT).
 *   - **Lei 2 (Mass Assignment)**: NÃO existe setter público para
 *     `isAuthenticated` — é DERIVADO de `session !== null` em tempo
 *     de set. Componentes não podem "logar" o usuário sem sessão real.
 *   - **Lei 9 (Exposição mínima)**: este arquivo NÃO loga `session`,
 *     `access_token`, `refresh_token` em nenhuma circunstância.
 *
 * Sobre `householdId`:
 *   Permanece `null` em todo o módulo 01. O módulo 02 (household
 *   onboarding) é quem populará via uma chamada a `getCurrentHousehold()`
 *   logo após `setSession`. Mantemos o slot aqui para que o shape do
 *   store já seja estável e o `<ProtectedRoute>` futuro possa decidir
 *   `/onboarding` vs `/dashboard` sem refactor.
 */
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthState {
  /**
   * Sessão crua devolvida pelo Supabase. `null` = sem sessão.
   * NUNCA logar este campo em produção.
   */
  session: Session | null;

  /** Atalho para `session?.user ?? null`, mantido em sincronia. */
  user: User | null;

  /**
   * `null` neste módulo. O módulo 02 popula após resolver o household
   * do usuário. Componentes devem tratar `null` como "ainda não sei".
   */
  householdId: string | null;

  /**
   * Derivado: `session !== null`. Existe como campo (não getter) para
   * que selectors do Zustand compartilhem referência estável e evitem
   * re-render desnecessário.
   */
  isAuthenticated: boolean;

  /**
   * `true` enquanto `supabase.auth.getSession()` ainda não respondeu
   * no boot do app. Componentes que dependem de "sei se há sessão ou não"
   * (ex.: `<ProtectedRoute>`) devem aguardar `false` antes de decidir
   * redirecionar — caso contrário o usuário vê um flash de tela de login
   * mesmo com sessão válida persistida.
   */
  isInitializing: boolean;

  /**
   * Único caminho legítimo para preencher/limpar a sessão.
   * Aceita `null` para logout (sinônimo de `reset()` mantendo
   * `isInitializing=false`).
   */
  setSession: (session: Session | null) => void;

  /**
   * Limpa toda a sessão e marca init como concluído. Usado em logout
   * explícito e como reset entre testes.
   */
  reset: () => void;
}

const INITIAL_STATE = {
  session: null,
  user: null,
  householdId: null,
  isAuthenticated: false,
  isInitializing: true,
} as const;

export const useAuthStore = create<AuthState>((set) => ({
  ...INITIAL_STATE,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isInitializing: false,
    }),

  reset: () =>
    set({
      session: null,
      user: null,
      householdId: null,
      isAuthenticated: false,
      isInitializing: false,
    }),
}));

/**
 * Selectors auxiliares — uso opcional, mas recomendados para evitar
 * subscrição ao objeto inteiro do store em componentes que só leem 1 campo.
 */
export const selectIsAuthenticated = (state: AuthState): boolean =>
  state.isAuthenticated;

export const selectIsInitializing = (state: AuthState): boolean =>
  state.isInitializing;

export const selectUser = (state: AuthState): User | null => state.user;
