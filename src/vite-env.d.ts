/// <reference types="vite/client" />

/**
 * Tipagem das variáveis de ambiente expostas ao bundle Vite.
 *
 * Apenas variáveis prefixadas com `VITE_` são embutidas no bundle.
 * Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, etc.) NÃO
 * devem ser declarados aqui — Lei 1 (zero-trust client) e prevenção
 * de vazamento acidental para o browser.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_LOCALE?: string;
  readonly VITE_APP_TIMEZONE?: string;
  readonly VITE_SESSION_IDLE_TIMEOUT_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
