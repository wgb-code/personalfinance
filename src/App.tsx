/**
 * Shell raiz da aplicação.
 *
 * Apenas dois providers — quanto menos houver aqui, mais rápido o
 * boot e mais simples o teste:
 *
 *   - `QueryClientProvider`: estado de servidor (React Query).
 *   - `RouterProvider`: roteamento via data router (v7).
 *
 * `useAuthStore` NÃO é envolvido em provider — Zustand expõe um hook
 * global. A sincronização com `supabase.auth.onAuthStateChange()` será
 * iniciada num `useEffect` em camada futura (AC-04 / "AuthProvider"
 * conforme tasks.md), não aqui.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { queryClient } from "@/lib/query-client";
import { appRouter } from "@/router/routes";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={appRouter} />
    </QueryClientProvider>
  );
}
