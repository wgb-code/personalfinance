import { http, HttpResponse } from "msw";

/**
 * Handlers MSW genéricos. Cada teste pode sobrepor com `server.use(...)`.
 * Cobertura inicial: stubs vazios para Supabase Auth e REST.
 */
const SUPABASE_URL = (
  process.env.VITE_SUPABASE_URL ?? "http://localhost:54321"
).replace(/\/+$/, "");

export const handlers = [
  http.post(`${SUPABASE_URL}/auth/v1/signup`, () =>
    HttpResponse.json(
      { user: null, session: null, error: { message: "stub: override em teste específico" } },
      { status: 400 }
    )
  ),
  http.post(`${SUPABASE_URL}/auth/v1/token`, () =>
    HttpResponse.json(
      { error: "stub: override em teste específico" },
      { status: 400 }
    )
  ),
];
