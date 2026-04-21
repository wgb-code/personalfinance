/**
 * Testes de formatação de datas (RN-34.1).
 */
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import {
  formatShortDate,
  formatFullDate,
  formatRelativeExpiry,
  formatDateOnly,
} from "@/features/household/lib/date-format";

describe("formatShortDate", () => {
  test('formata data do mesmo ano sem ano: "dd/MM às HH:mm"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));

    const result = formatShortDate("2026-04-15T14:30:00Z");

    expect(result).toMatch(/15\/04.*às.*\d{2}:\d{2}/);

    vi.useRealTimers();
  });

  test("formata data de ano diferente com ano", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));

    const result = formatShortDate("2025-04-15T14:30:00Z");

    expect(result).toMatch(/15\/04\/2025.*às.*\d{2}:\d{2}/);

    vi.useRealTimers();
  });
});

describe("formatFullDate", () => {
  test('formata data completa: "dd/MM/yyyy às HH:mm"', () => {
    const result = formatFullDate("2026-04-15T14:30:00Z");

    expect(result).toMatch(/15\/04\/2026.*às.*\d{2}:\d{2}/);
  });
});

describe("formatRelativeExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('formata expiração em horas: "(em ~Xh)"', () => {
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));

    const result = formatRelativeExpiry("2026-04-22T12:00:00Z");

    expect(result).toBe("(em ~24h)");
  });

  test('formata expiração em minutos quando < 1h: "(em ~Xmin)"', () => {
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));

    const result = formatRelativeExpiry("2026-04-21T12:45:00Z");

    expect(result).toBe("(em ~45min)");
  });

  test('retorna "(expirado)" quando data passou', () => {
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));

    const result = formatRelativeExpiry("2026-04-20T12:00:00Z");

    expect(result).toBe("(expirado)");
  });
});

describe("formatDateOnly", () => {
  test('formata apenas data: "dd/MM/yyyy"', () => {
    const result = formatDateOnly("2026-04-15T14:30:00Z");

    expect(result).toMatch(/15\/04\/2026/);
  });
});
