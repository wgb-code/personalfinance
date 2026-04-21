/**
 * Instância singleton do React Query.
 *
 * Defaults:
 * - `retry: 1` — uma única retentativa para erros transitórios; mais que
 *   isso esconde bugs reais e pune o usuário com latência.
 * - `staleTime: 60_000` — dados ficam "frescos" por 1 minuto antes de
 *   refetch automático ao re-focar a janela. Calibrado para um app
 *   financeiro: leituras dominam escritas, e quando há mutação nós
 *   invalidamos explicitamente via `queryClient.invalidateQueries`.
 * - `refetchOnWindowFocus: false` — UX previsível; refetch agressivo
 *   em janelas re-focadas costuma piorar percepção de performance.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
