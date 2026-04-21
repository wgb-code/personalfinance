import { setupServer } from "msw/node";
import { handlers } from "./msw.handlers";

/**
 * Servidor MSW para testes Node (unit + integration).
 * Componentes em browser-mode usam `setupWorker` separadamente, se necessário.
 */
export const server = setupServer(...handlers);
