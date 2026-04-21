/**
 * Helper para limpar o banco de dados entre testes de integração.
 *
 * IMPORTANTE:
 * - Executa com service_role_key (ignora RLS)
 * - Ordem de deleção respeita foreign keys
 * - Nunca logar dados sensíveis (emails, tokens)
 */
import { adminClient } from "./seed";

const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

export async function resetDb(): Promise<void> {
  try {
    await adminClient
      .from("household_member_audit")
      .delete()
      .neq("id", DUMMY_UUID);

    await adminClient.from("household_members").delete().neq("id", DUMMY_UUID);

    await adminClient.from("join_rate_limits").delete().neq("id", DUMMY_UUID);

    await adminClient.from("households").delete().neq("id", DUMMY_UUID);

    await adminClient.from("user_profiles").delete().neq("id", DUMMY_UUID);

    const { data: users, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error("[resetDb] Erro ao listar usuários:", listError.message);
      return;
    }

    for (const user of users?.users || []) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error("[resetDb] Erro ao deletar usuário:", deleteError.message);
      }
    }
  } catch (error) {
    console.error(
      "[resetDb] Erro inesperado:",
      error instanceof Error ? error.message : "Erro desconhecido"
    );
    throw error;
  }
}

export async function resetAuthOnly(): Promise<void> {
  try {
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error("[resetAuthOnly] Erro ao listar usuários:", listError.message);
      return;
    }

    for (const user of users?.users || []) {
      await adminClient.auth.admin.deleteUser(user.id);
    }
  } catch (error) {
    console.error(
      "[resetAuthOnly] Erro inesperado:",
      error instanceof Error ? error.message : "Erro desconhecido"
    );
    throw error;
  }
}
