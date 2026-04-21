/**
 * Testes de integração para a RPC create_household.
 *
 * Cobertura:
 * - AC-05: Criação de household via RPC
 * - AC-20: Owner automático como membro
 * - AC-25: Audit trail de entrada
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { seedUser, SUPABASE_URL, SUPABASE_ANON_KEY } from "../helpers/seed";
import { resetDb } from "../helpers/reset-db";

describe("create_household RPC", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("should create household with owner as member", async () => {
    const user = await seedUser("maria@test.com");

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await client.auth.setSession(user.session);

    const { data, error } = await client.rpc("create_household", {
      p_name: "Casa Silva",
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.household_id).toBeDefined();
    expect(data.name).toBe("Casa Silva");
    expect(data.role).toBe("owner");
    expect(data.invite_code).toHaveLength(6);

    const { data: members } = await client
      .from("household_members")
      .select("*")
      .eq("household_id", data.household_id);

    expect(members).toHaveLength(1);
    expect(members![0].user_id).toBe(user.userId);
    expect(members![0].role).toBe("owner");

    const { data: audit } = await client
      .from("household_member_audit")
      .select("*")
      .eq("household_id", data.household_id);

    expect(audit).toHaveLength(1);
    expect(audit![0].action).toBe("joined");
    expect(audit![0].performed_by).toBe(user.userId);
  });

  it("should generate unique invite code with 6 alphanumeric characters", async () => {
    const user = await seedUser("joao@test.com");

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await client.auth.setSession(user.session);

    const { data } = await client.rpc("create_household", {
      p_name: "Apartamento Centro",
    });

    expect(data.invite_code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("should reject household creation for user already in a household", async () => {
    const user = await seedUser("ana@test.com");

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await client.auth.setSession(user.session);

    await client.rpc("create_household", { p_name: "Primeiro Lar" });

    const { error } = await client.rpc("create_household", {
      p_name: "Segundo Lar",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain("already");
  });

  it("should reject creation without authentication", async () => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { error } = await client.rpc("create_household", {
      p_name: "Sem Auth",
    });

    expect(error).not.toBeNull();
  });

  it("should trim whitespace from household name", async () => {
    const user = await seedUser("pedro@test.com");

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await client.auth.setSession(user.session);

    const { data } = await client.rpc("create_household", {
      p_name: "  Casa com Espaços  ",
    });

    expect(data.name).toBe("Casa com Espaços");
  });
});
