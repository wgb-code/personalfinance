/**
 * Testes em browser-mode (Chromium real via @vitest/browser-playwright)
 * do `<MembersList />` — AC-10, AC-12.
 *
 * Verifica:
 *   - Tabela renderiza todos os membros.
 *   - Avatar com iniciais quando sem imagem.
 *   - Role badge (Owner/Member).
 *   - Status badge (Ativo = verde, Inativo = cinza).
 *   - Botão "Remover" apenas para owner em members ativos.
 *   - Modal de confirmação antes de remover.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import axe from "axe-core";

import { MembersList } from "@/features/household/components/MembersList";
import type { MemberRowMember } from "@/features/household/components/MemberRow";

const MARIA: MemberRowMember = {
  id: "m1",
  userId: "user-maria",
  fullName: "Maria Silva",
  avatarUrl: null,
  role: "owner",
  joinedAt: "2026-04-10T14:30:00Z",
  leftAt: null,
  isActive: true,
};

const JOAO: MemberRowMember = {
  id: "m2",
  userId: "user-joao",
  fullName: "João Santos",
  avatarUrl: null,
  role: "member",
  joinedAt: "2026-04-15T10:00:00Z",
  leftAt: null,
  isActive: true,
};

const CARLOS: MemberRowMember = {
  id: "m3",
  userId: "user-carlos",
  fullName: "Carlos Oliveira",
  avatarUrl: null,
  role: "member",
  joinedAt: "2026-04-12T09:00:00Z",
  leftAt: "2026-04-18T15:00:00Z",
  isActive: false,
};

const MEMBERS = [MARIA, JOAO, CARLOS];

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe("<MembersList /> — AC-10: Tabela de membros", () => {
  test("renderiza todos os membros", async () => {
    await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
      />
    );

    await expect.element(page.getByText("Maria Silva")).toBeVisible();
    await expect.element(page.getByText("João Santos")).toBeVisible();
    await expect.element(page.getByText("Carlos Oliveira")).toBeVisible();
  });

  test("exibe iniciais no avatar quando sem imagem", async () => {
    await render(
      <MembersList
        members={[JOAO]}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
      />
    );

    await expect.element(page.getByText("JS")).toBeVisible();
  });

  test("exibe role badge corretamente", async () => {
    await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
      />
    );

    const ownerBadge = page.getByText("Owner");
    await expect.element(ownerBadge).toBeVisible();

    const memberBadges = page.getByText("Member").all();
    expect((await memberBadges).length).toBe(2);
  });

  test("exibe status badge corretamente (ativo/inativo)", async () => {
    await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
      />
    );

    const ativoBadges = page.getByText("Ativo").all();
    expect((await ativoBadges).length).toBe(2);

    const inativoBadge = page.getByText("Inativo");
    await expect.element(inativoBadge).toBeVisible();
  });

  test("exibe data de entrada formatada", async () => {
    await render(
      <MembersList
        members={[JOAO]}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
      />
    );

    await expect.element(page.getByText("15/04/2026")).toBeVisible();
  });

  test("axe-core não reporta violações", async () => {
    const result = await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
      />
    );

    const axeResults = await axe.run(result.container);
    expect(axeResults.violations).toEqual([]);
  });
});

describe("<MembersList /> — AC-10: Botão Remover", () => {
  test("owner vê botão 'Remover' em member ativo", async () => {
    const onRemove = vi.fn();

    await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
        onRemoveMember={onRemove}
      />
    );

    const removeButtons = page.getByRole("button", { name: /remover/i }).all();
    expect((await removeButtons).length).toBe(1);
  });

  test("NÃO exibe botão para member inativo", async () => {
    const onRemove = vi.fn();

    await render(
      <MembersList
        members={[CARLOS]}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
        onRemoveMember={onRemove}
      />
    );

    const removeButton = page.getByRole("button", { name: /remover/i });
    await expect.element(removeButton).not.toBeInTheDocument();
  });

  test("NÃO exibe botão para owner (não pode remover a si mesmo)", async () => {
    const onRemove = vi.fn();

    await render(
      <MembersList
        members={[MARIA]}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
        onRemoveMember={onRemove}
      />
    );

    const removeButton = page.getByRole("button", { name: /remover/i });
    await expect.element(removeButton).not.toBeInTheDocument();
  });

  test("member NÃO vê botão 'Remover'", async () => {
    await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-joao"
        isCurrentUserOwner={false}
      />
    );

    const removeButton = page.getByRole("button", { name: /remover/i });
    await expect.element(removeButton).not.toBeInTheDocument();
  });
});

describe("<MembersList /> — AC-12: Modal de confirmação", () => {
  test("exibe modal ao clicar em 'Remover'", async () => {
    const onRemove = vi.fn();

    await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
        onRemoveMember={onRemove}
      />
    );

    const removeButton = page.getByRole("button", { name: /remover/i });
    await userEvent.click(removeButton);

    await expect.element(page.getByText(/remover membro\?/i)).toBeVisible();
    await expect
      .element(page.getByText(/joão santos perderá acesso/i))
      .toBeVisible();
  });

  test("chama onRemoveMember ao confirmar", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);

    await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
        onRemoveMember={onRemove}
      />
    );

    const removeButton = page.getByRole("button", { name: /remover/i });
    await userEvent.click(removeButton);

    const confirmButton = page
      .getByRole("dialog")
      .getByRole("button", { name: /^remover$/i });
    await userEvent.click(confirmButton);

    expect(onRemove).toHaveBeenCalledWith(JOAO);
  });

  test("fecha modal ao cancelar", async () => {
    const onRemove = vi.fn();

    await render(
      <MembersList
        members={MEMBERS}
        currentUserId="user-maria"
        isCurrentUserOwner={true}
        onRemoveMember={onRemove}
      />
    );

    const removeButton = page.getByRole("button", { name: /remover/i });
    await userEvent.click(removeButton);

    const cancelButton = page.getByRole("button", { name: /cancelar/i });
    await userEvent.click(cancelButton);

    const modalTitle = page.getByText(/remover membro\?/i);
    await expect.element(modalTitle).not.toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
  });
});
