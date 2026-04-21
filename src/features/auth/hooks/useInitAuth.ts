/**
 * `useInitAuth` — bootstrap de autenticação no mount do app.
 *
 * Responsável por:
 *   1. Chamar `supabase.auth.getSession()` para recuperar sessão persistida
 *   2. Registrar `onAuthStateChange()` para manter `useAuthStore` sincronizado
 *   3. Marcar `isInitializing = false` quando pronto
 *
 * AC-08: "Sessão persiste após reload"
 *
 * Leis de segurança:
 *   - Lei 1: sessão vem APENAS do SDK Supabase, nunca de input do usuário
 *   - Lei 9: NUNCA logar tokens, refresh_token ou sessão
 */
import { useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { useAuthStore, selectIsInitializing } from "@/stores/useAuthStore";

interface UseInitAuthReturn {
  isInitializing: boolean;
}

export function useInitAuth(): UseInitAuthReturn {
  const isInitializing = useAuthStore(selectIsInitializing);
  const setSession = useAuthStore((state) => state.setSession);
  const reset = useAuthStore((state) => state.reset);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          reset();
        } else {
          setSession(session);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, reset]);

  return { isInitializing };
}
