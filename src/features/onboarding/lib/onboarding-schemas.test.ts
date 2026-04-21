/**
 * Testes de schema de onboarding (AC-02 + Lei 2).
 *
 * Validações cobertas:
 *   - createHouseholdSchema: nome obrigatório, max 100 chars, strict mode
 *   - joinHouseholdSchema: código de 6 chars, uppercase, strict mode
 */
import { describe, it, expect } from "vitest";

import { ONBOARDING_MESSAGES } from "@/features/onboarding/lib/onboarding-constants";
import {
  createHouseholdSchema,
  joinHouseholdSchema,
} from "@/features/onboarding/lib/onboarding-schemas";

describe("createHouseholdSchema", () => {
  it("aceita nome válido entre 1-100 chars", () => {
    const result = createHouseholdSchema.safeParse({ name: "Casa Silva" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Casa Silva");
    }
  });

  it("aplica trim no nome", () => {
    const result = createHouseholdSchema.safeParse({ name: "  Casa Silva  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Casa Silva");
    }
  });

  it("rejeita nome vazio com mensagem pt-BR", () => {
    const result = createHouseholdSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        ONBOARDING_MESSAGES.HOUSEHOLD_NAME_REQUIRED
      );
    }
  });

  it("rejeita nome apenas com espaços (trim → vazio)", () => {
    const result = createHouseholdSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        ONBOARDING_MESSAGES.HOUSEHOLD_NAME_REQUIRED
      );
    }
  });

  it("rejeita nome > 100 caracteres com mensagem pt-BR", () => {
    const longName = "a".repeat(101);
    const result = createHouseholdSchema.safeParse({ name: longName });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        ONBOARDING_MESSAGES.HOUSEHOLD_NAME_TOO_LONG
      );
    }
  });

  it("aceita nome com exatamente 100 caracteres", () => {
    const exactName = "a".repeat(100);
    const result = createHouseholdSchema.safeParse({ name: exactName });
    expect(result.success).toBe(true);
  });

  it("rejeita campos extras (Lei 2 — Mass Assignment)", () => {
    const result = createHouseholdSchema.safeParse({
      name: "Casa Silva",
      owner_id: "hacker-uuid",
      invite_code: "HACKED",
    });
    expect(result.success).toBe(false);
  });
});

describe("joinHouseholdSchema", () => {
  it("aceita código de 6 caracteres", () => {
    const result = joinHouseholdSchema.safeParse({ code: "ABC123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("ABC123");
    }
  });

  it("normaliza para uppercase", () => {
    const result = joinHouseholdSchema.safeParse({ code: "abc123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("ABC123");
    }
  });

  it("aplica trim no código", () => {
    const result = joinHouseholdSchema.safeParse({ code: " ABC123 " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("ABC123");
    }
  });

  it("rejeita código < 6 caracteres", () => {
    const result = joinHouseholdSchema.safeParse({ code: "ABC12" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        ONBOARDING_MESSAGES.INVITE_CODE_LENGTH
      );
    }
  });

  it("rejeita código > 6 caracteres", () => {
    const result = joinHouseholdSchema.safeParse({ code: "ABC1234" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        ONBOARDING_MESSAGES.INVITE_CODE_LENGTH
      );
    }
  });

  it("rejeita campos extras (Lei 2 — Mass Assignment)", () => {
    const result = joinHouseholdSchema.safeParse({
      code: "ABC123",
      household_id: "hacker-uuid",
    });
    expect(result.success).toBe(false);
  });
});
