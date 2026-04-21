/**
 * Helpers para seed de dados em testes de integração com Supabase local.
 *
 * IMPORTANTE: Estes helpers requerem Supabase local rodando.
 * Execute `pnpm supabase start` antes de rodar testes de integração.
 *
 * Segurança:
 * - O service_role_key SÓ é usado para criar usuários de teste
 * - Após criar, sempre usamos a session do usuário (anon key)
 * - Nunca expor service_role_key em logs ou erros
 */
import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const DEFAULT_TEST_PASSWORD = "Test123!@#";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface SeedUserResult {
  userId: string;
  email: string;
  session: Session;
}

export async function seedUser(
  email: string,
  password: string = DEFAULT_TEST_PASSWORD
): Promise<SeedUserResult> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Falha ao criar usuário de teste: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Usuário criado mas dados não retornados");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError) {
    throw new Error(`Falha ao fazer login do usuário de teste: ${sessionError.message}`);
  }

  if (!sessionData.session) {
    throw new Error("Login bem-sucedido mas session não retornada");
  }

  return {
    userId: data.user.id,
    email,
    session: sessionData.session,
  };
}

export interface SeedHouseholdResult {
  householdId: string;
  inviteCode: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  ownerSession: Session;
}

export async function seedHousehold(
  ownerEmail: string,
  householdName: string = "Test Household"
): Promise<SeedHouseholdResult> {
  const user = await seedUser(ownerEmail);

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await client.auth.setSession(user.session);

  const { data, error } = await client.rpc("create_household", {
    p_name: householdName,
  });

  if (error) {
    throw new Error(`Falha ao criar household de teste: ${error.message}`);
  }

  return {
    householdId: data.household_id,
    inviteCode: data.invite_code,
    name: data.name,
    ownerId: user.userId,
    ownerEmail,
    ownerSession: user.session,
  };
}

export interface SeedMemberResult {
  memberId: string;
  memberEmail: string;
  memberSession: Session;
  householdId: string;
}

export async function seedMember(
  householdId: string,
  inviteCode: string,
  memberEmail: string
): Promise<SeedMemberResult> {
  const user = await seedUser(memberEmail);

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await client.auth.setSession(user.session);

  const { error } = await client.rpc("join_household", {
    p_code: inviteCode,
  });

  if (error) {
    throw new Error(`Falha ao adicionar membro ao household: ${error.message}`);
  }

  return {
    memberId: user.userId,
    memberEmail,
    memberSession: user.session,
    householdId,
  };
}

export async function loginAs(
  email: string,
  password: string = DEFAULT_TEST_PASSWORD
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Falha no login: ${error.message}`);
  }

  if (!data.session) {
    throw new Error("Login bem-sucedido mas session não retornada");
  }

  return data.session;
}

export function createAuthenticatedClient(session: Session): SupabaseClient {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  client.auth.setSession(session);
  return client;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
