/**
 * Testes em browser-mode (Chromium real via @vitest/browser-playwright)
 * do `<AuditHistory />` — AC-18, AC-19.
 *
 * Verifica:
 *   - Timeline renderiza todas as entradas.
 *   - Ícones corretos por tipo de ação.
 *   - Descrição legível: "João entrou no household".
 *   - Timestamp formatado: "15/04 às 14:30".
 *   - Estado vazio exibe mensagem apropriada.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { render, cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";
import axe from "axe-core";

import { AuditHistory } from "@/features/household/components/AuditHistory";
import type { AuditEntry } from "@/features/household/hooks/useHouseholdAudit";

const AUDIT_ENTRIES: AuditEntry[] = [
  {
    id: "a1",
    action: "joined",
    performedAt: "2026-04-15T14:30:00Z",
    userFullName: "João Santos",
    performerFullName: "João Santos",
    description: "João Santos entrou no household",
  },
  {
    id: "a2",
    action: "removed",
    performedAt: "2026-04-18T10:00:00Z",
    userFullName: "Carlos Oliveira",
    performerFullName: "Maria Silva",
    description: "Carlos Oliveira foi removido por Maria Silva",
  },
  {
    id: "a3",
    action: "left",
    performedAt: "2026-04-20T09:15:00Z",
    userFullName: "Ana Costa",
    performerFullName: "Ana Costa",
    description: "Ana Costa saiu do household",
  },
];

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe("<AuditHistory /> — AC-18: Timeline", () => {
  test("renderiza todas as entradas de audit", async () => {
    await render(<AuditHistory entries={AUDIT_ENTRIES} />);

    await expect
      .element(page.getByText(/joão santos entrou no household/i))
      .toBeVisible();
    await expect
      .element(page.getByText(/carlos oliveira foi removido por maria silva/i))
      .toBeVisible();
    await expect
      .element(page.getByText(/ana costa saiu do household/i))
      .toBeVisible();
  });

  test("exibe timestamps formatados", async () => {
    await render(<AuditHistory entries={AUDIT_ENTRIES} />);

    await expect.element(page.getByText(/15\/04 às 14:30/i)).toBeVisible();
    await expect.element(page.getByText(/18\/04 às 10:00/i)).toBeVisible();
    await expect.element(page.getByText(/20\/04 às 09:15/i)).toBeVisible();
  });

  test("tem role='list' e 'listitem' para a11y", async () => {
    await render(<AuditHistory entries={AUDIT_ENTRIES} />);

    const list = page.getByRole("list", { name: /histórico de ações/i });
    await expect.element(list).toBeVisible();

    const items = page.getByRole("listitem").all();
    expect((await items).length).toBe(3);
  });

  test("axe-core não reporta violações", async () => {
    const result = await render(<AuditHistory entries={AUDIT_ENTRIES} />);

    const axeResults = await axe.run(result.container);
    expect(axeResults.violations).toEqual([]);
  });
});

describe("<AuditHistory /> — AC-19: Ícones por ação", () => {
  test("entrada (joined) tem ícone verde", async () => {
    const entries: AuditEntry[] = [
      {
        id: "a1",
        action: "joined",
        performedAt: "2026-04-15T14:30:00Z",
        userFullName: "João",
        performerFullName: "João",
        description: "João entrou no household",
      },
    ];

    const result = await render(<AuditHistory entries={entries} />);

    const iconContainer = result.container.querySelector(".bg-green-100");
    expect(iconContainer).toBeTruthy();
  });

  test("saída (left) tem ícone amarelo", async () => {
    const entries: AuditEntry[] = [
      {
        id: "a1",
        action: "left",
        performedAt: "2026-04-15T14:30:00Z",
        userFullName: "João",
        performerFullName: "João",
        description: "João saiu do household",
      },
    ];

    const result = await render(<AuditHistory entries={entries} />);

    const iconContainer = result.container.querySelector(".bg-amber-100");
    expect(iconContainer).toBeTruthy();
  });

  test("remoção (removed) tem ícone vermelho", async () => {
    const entries: AuditEntry[] = [
      {
        id: "a1",
        action: "removed",
        performedAt: "2026-04-15T14:30:00Z",
        userFullName: "João",
        performerFullName: "Maria",
        description: "João foi removido por Maria",
      },
    ];

    const result = await render(<AuditHistory entries={entries} />);

    const iconContainer = result.container.querySelector(".bg-red-100");
    expect(iconContainer).toBeTruthy();
  });
});

describe("<AuditHistory /> — Estado vazio", () => {
  test("exibe mensagem quando não há entradas", async () => {
    await render(<AuditHistory entries={[]} />);

    await expect
      .element(page.getByText(/nenhuma atividade registrada/i))
      .toBeVisible();
  });
});
