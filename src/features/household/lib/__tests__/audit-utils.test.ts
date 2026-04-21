/**
 * Testes de formatação do audit trail (AC-18).
 */
import { describe, expect, test } from "vitest";

import { formatAuditDescription } from "@/features/household/lib/audit-utils";

describe("formatAuditDescription", () => {
  test('formata joined: "João entrou no household"', () => {
    const result = formatAuditDescription("joined", "João Santos", "João Santos");

    expect(result).toBe("João Santos entrou no household");
  });

  test('formata left: "Carlos saiu do household"', () => {
    const result = formatAuditDescription("left", "Carlos Oliveira", "Carlos Oliveira");

    expect(result).toBe("Carlos Oliveira saiu do household");
  });

  test('formata removed: "Carlos foi removido por Maria"', () => {
    const result = formatAuditDescription("removed", "Carlos Oliveira", "Maria Silva");

    expect(result).toBe("Carlos Oliveira foi removido por Maria Silva");
  });
});
