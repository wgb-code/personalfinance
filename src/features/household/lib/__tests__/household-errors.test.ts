/**
 * Testes de mapeamento de erros de household (Lei 9).
 */
import { describe, expect, test } from "vitest";

import { mapHouseholdError } from "@/features/household/lib/household-errors";
import { HOUSEHOLD_MESSAGES } from "@/features/household/lib/household-constants";

describe("mapHouseholdError", () => {
  test("mapeia NOT_OWNER para mensagem pt-BR", () => {
    const error = { message: "NOT_OWNER", code: "P0001" };

    const result = mapHouseholdError(error);

    expect(result).toBe(HOUSEHOLD_MESSAGES.NOT_OWNER);
  });

  test("mapeia NO_HOUSEHOLD para mensagem pt-BR", () => {
    const error = { message: "NO_HOUSEHOLD", code: "P0001" };

    const result = mapHouseholdError(error);

    expect(result).toBe(HOUSEHOLD_MESSAGES.NO_HOUSEHOLD);
  });

  test("mapeia OWNER_HAS_ACTIVE_MEMBERS para mensagem pt-BR", () => {
    const error = { message: "OWNER_HAS_ACTIVE_MEMBERS", code: "P0001" };

    const result = mapHouseholdError(error);

    expect(result).toBe(HOUSEHOLD_MESSAGES.OWNER_HAS_ACTIVE_MEMBERS);
  });

  test("mapeia TARGET_NOT_MEMBER para mensagem pt-BR", () => {
    const error = { message: "TARGET_NOT_MEMBER", code: "P0001" };

    const result = mapHouseholdError(error);

    expect(result).toBe(HOUSEHOLD_MESSAGES.TARGET_NOT_MEMBER);
  });

  test("mapeia CANNOT_REMOVE_SELF para mensagem pt-BR", () => {
    const error = { message: "CANNOT_REMOVE_SELF", code: "P0001" };

    const result = mapHouseholdError(error);

    expect(result).toBe(HOUSEHOLD_MESSAGES.CANNOT_REMOVE_SELF);
  });

  test("retorna mensagem genérica para erro desconhecido", () => {
    const error = { message: "UNKNOWN_ERROR", code: "P0001" };

    const result = mapHouseholdError(error);

    expect(result).toBe(HOUSEHOLD_MESSAGES.UNEXPECTED_ERROR);
  });

  test("trata Error instance", () => {
    const error = new Error("NOT_OWNER");

    const result = mapHouseholdError(error);

    expect(result).toBe(HOUSEHOLD_MESSAGES.NOT_OWNER);
  });

  test("trata string vazia", () => {
    const result = mapHouseholdError("");

    expect(result).toBe(HOUSEHOLD_MESSAGES.UNEXPECTED_ERROR);
  });

  test("trata null", () => {
    const result = mapHouseholdError(null);

    expect(result).toBe(HOUSEHOLD_MESSAGES.UNEXPECTED_ERROR);
  });

  test("trata undefined", () => {
    const result = mapHouseholdError(undefined);

    expect(result).toBe(HOUSEHOLD_MESSAGES.UNEXPECTED_ERROR);
  });
});
