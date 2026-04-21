/**
 * Shell raiz da aplicação.
 *
 * Providers:
 *   - `QueryClientProvider`: estado de servidor (React Query).
 *   - `AuthBootstrap`: inicializa sessão via `useInitAuth` (AC-08).
 *   - `RouterProvider`: roteamento via data router (v7).
 *
 * `useAuthStore` NÃO é envolvido em provider — Zustand expõe um hook
 * global. A sincronização com `supabase.auth.onAuthStateChange()` é
 * feita pelo `AuthBootstrap` / `useInitAuth`.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { AuthBootstrap } from "@/features/auth/components/AuthBootstrap";
import { queryClient } from "@/lib/query-client";
import { appRouter } from "@/router/routes";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <RouterProvider router={appRouter} />
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
