/**
 * Cliente Supabase singleton para o frontend.
 *
 * Decisões de design:
 *
 * - **Lazy assertion das envs**: validar `import.meta.env.*` em import-time
 *   quebraria toda a suíte de testes unit (que não carrega `.env`). A
 *   validação acontece somente quando o cliente é efetivamente solicitado
 *   via `getSupabaseClient()`. Importar este módulo é gratuito.
 *
 * - **`persistSession: true`**: a sessão precisa sobreviver a reload
 *   (RN-19/RN-20 — sincronização do `useAuthStore`).
 *
 * - **`autoRefreshToken: true`**: o JWT do Supabase tem TTL curto (1h
 *   por padrão); sem auto-refresh, qualquer ação após 1h derrubaria o
 *   usuário sem motivo (UX terrível e potencial perda de dados em forms).
 *
 * - **`detectSessionInUrl: true`**: necessário para o fluxo de reset de
 *   senha (AC-12) e magic links — o Supabase coloca o token na URL e
 *   o SDK consome+limpa automaticamente.
 *
 * - **Lei 9 (Exposição mínima)**: a chave `VITE_SUPABASE_PUBLISHABLE_KEY`
 *   é a chave PÚBLICA (anon/publishable). A `service_role_key` JAMAIS
 *   pode aparecer em qualquer arquivo com prefixo `VITE_*`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

const MISSING_ENV_MESSAGE =
  "Configuração do Supabase ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env do frontend.";

/**
 * Retorna o singleton do cliente Supabase, criando-o sob demanda.
 *
 * Em testes unit (sem envs do Vite), este getter NÃO é chamado a menos
 * que o teste explicitamente exercite a integração — então não é
 * necessário mockar nada para `import` funcionar.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(MISSING_ENV_MESSAGE);
  }

  cachedClient = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
}

/**
 * Proxy de conveniência para uso em hooks/componentes:
 * `import { supabase } from "@/lib/supabase"` continua possível,
 * mas a inicialização efetiva só ocorre no primeiro acesso a propriedade.
 *
 * Trade-off: o `Proxy` adiciona uma micro-indireção em CADA acesso a
 * propriedade do cliente. Em código de produção isso é negligenciável
 * (V8 inlina). Em troca, ganhamos import-time barato (testes felizes)
 * sem perder a ergonomia do `supabase.auth.signIn(...)` direto.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    return Reflect.get(client, prop, receiver);
  },
});
