/**
 * Helpers para testes de integração com Supabase local.
 *
 * @example
 * ```ts
 * import { seedUser, seedHousehold, resetDb } from '../helpers'
 * ```
 */
export {
  supabase,
  adminClient,
  seedUser,
  seedHousehold,
  seedMember,
  loginAs,
  createAuthenticatedClient,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  type SeedUserResult,
  type SeedHouseholdResult,
  type SeedMemberResult,
} from "./seed";

export { resetDb, resetAuthOnly } from "./reset-db";
