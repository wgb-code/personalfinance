/**
 * Testes unitários para AuditHistory (jsdom)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { AuditHistory, type AuditHistoryProps } from "../AuditHistory";
import type { AuditEntry } from "../../hooks/useHouseholdAudit";

const mockEntries: AuditEntry[] = [
  {
    id: "a-1",
    action: "joined",
    userFullName: "Maria Santos",
    performerFullName: "Maria Santos",
    performedAt: "2026-04-20T15:30:00Z",
    description: "Maria Santos entrou no household",
  },
  {
    id: "a-2",
    action: "left",
    userFullName: "Pedro Costa",
    performerFullName: "Pedro Costa",
    performedAt: "2026-04-19T10:00:00Z",
    description: "Pedro Costa saiu do household",
  },
  {
    id: "a-3",
    action: "removed",
    userFullName: "Carlos Mendes",
    performerFullName: "João Silva",
    performedAt: "2026-04-18T09:00:00Z",
    description: "Carlos Mendes foi removido por João Silva",
  },
];

function renderAuditHistory(props: Partial<AuditHistoryProps> = {}) {
  const defaultProps: AuditHistoryProps = {
    entries: mockEntries,
    ...props,
  };

  return render(<AuditHistory {...defaultProps} />);
}

describe("AuditHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("renderização com entries", () => {
    it("renderiza o título do card", () => {
      renderAuditHistory();
      expect(screen.getByText("Histórico de Membros")).toBeInTheDocument();
    });

    it("renderiza todas as entries", () => {
      renderAuditHistory();
      expect(screen.getByText(/maria santos entrou/i)).toBeInTheDocument();
      expect(screen.getByText(/pedro costa saiu/i)).toBeInTheDocument();
      expect(screen.getByText(/carlos mendes foi removido/i)).toBeInTheDocument();
    });

    it("tem role list para acessibilidade", () => {
      renderAuditHistory();
      expect(screen.getByRole("list")).toBeInTheDocument();
    });
  });

  describe("renderização sem entries", () => {
    it("mostra mensagem de vazio", () => {
      renderAuditHistory({ entries: [] });
      expect(
        screen.getByText(/nenhuma atividade registrada/i)
      ).toBeInTheDocument();
    });

    it("mantém o título visível", () => {
      renderAuditHistory({ entries: [] });
      expect(screen.getByText("Histórico de Membros")).toBeInTheDocument();
    });
  });
});
