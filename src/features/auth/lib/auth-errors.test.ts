/**
 * Testes do mapeador `mapAuthError` (AC-06, AC-07, AC-01, AC-12).
 *
 * Filosofia:
 *   - Cobrir TODA a tabela de mapeamento documentada em `auth-errors.ts`.
 *   - Provar a INVARIÂNCIA da Lei 9 (Exposição Mínima): "user not found"
 *     e "invalid login credentials" devem produzir EXATAMENTE a mesma
 *     string — qualquer divergência permitiria enumeração de contas.
 *   - Cobrir 100% dos branches: shapes inesperados (`null`, `undefined`,
 *     `42`, `""`), erros sem `message`, erros com `status`/`code` etc.
 */
import { describe, expect, it } from "vitest";

import { AUTH_MESSAGES } from "@/features/auth/lib/constants";
import { mapAuthError, isRateLimitError } from "@/features/auth/lib/auth-errors";

describe("mapAuthError — credenciais inválidas (Lei 9)", () => {
  it.each<[string, unknown]>([
    ["Error('Invalid login credentials')", new Error("Invalid login credentials")],
    ["Error('Invalid email or password')", new Error("Invalid email or password")],
    [
      "objeto Supabase 400 com code=invalid_credentials",
      { message: "Invalid login credentials", status: 400, code: "invalid_credentials" },
    ],
    ["Error('User not found') — não revelar (Lei 9)", new Error("User not found")],
    ["Error('Email not confirmed') — não revelar (Lei 9)", new Error("Email not confirmed")],
    [
      "Error case-insensitive 'INVALID LOGIN CREDENTIALS'",
      new Error("INVALID LOGIN CREDENTIALS"),
    ],
  ])("%s → INVALID_CREDENTIALS", (_label, input) => {
    expect(mapAuthError(input)).toBe(AUTH_MESSAGES.INVALID_CREDENTIALS);
  });

  it("invariância: 'User not found' === 'Invalid login credentials' (idênticos textualmente)", () => {
    const userNotFound = mapAuthError({ message: "User not found" });
    const invalidCreds = mapAuthError({ message: "Invalid login credentials" });

    // toBe: identidade textual estrita — qualquer ramo diferente quebra aqui.
    expect(userNotFound).toBe(invalidCreds);
    expect(userNotFound).toBe(AUTH_MESSAGES.INVALID_CREDENTIALS);
  });
});

describe("mapAuthError — rate limit (AC-07)", () => {
  it.each<[string, unknown]>([
    ["Error('Email rate limit exceeded')", new Error("Email rate limit exceeded")],
    ["Error('Too many requests')", new Error("Too many requests")],
    ["mensagem 'rate limit' case-insensitive", { message: "RATE LIMIT exceeded" }],
    ["objeto sem message com status 429", { status: 429 }],
    [
      "objeto com status 429 + message irrelevante",
      { status: 429, message: "Sorry buddy" },
    ],
    [
      "Error('429: Too Many Requests') por menção textual",
      new Error("HTTP 429: Too Many Requests"),
    ],
  ])("%s → RATE_LIMITED", (_label, input) => {
    expect(mapAuthError(input)).toBe(AUTH_MESSAGES.RATE_LIMITED);
  });
});

describe("mapAuthError — cadastro duplicado (AC-01)", () => {
  it.each<[string, unknown]>([
    ["Error('User already registered')", new Error("User already registered")],
    ["mensagem 'email already exists' case-insensitive", { message: "EMAIL ALREADY EXISTS" }],
    ["Error('User Already Exists')", new Error("User Already Exists")],
  ])("%s → EMAIL_ALREADY_REGISTERED", (_label, input) => {
    expect(mapAuthError(input)).toBe(AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED);
  });
});

describe("mapAuthError — senha fraca (AC-12)", () => {
  it.each<[string, unknown]>([
    ["Error('Weak password')", new Error("Weak password")],
    [
      "Error('Password should be at least 8 characters')",
      new Error("Password should be at least 8 characters"),
    ],
  ])("%s → WEAK_PASSWORD", (_label, input) => {
    expect(mapAuthError(input)).toBe(AUTH_MESSAGES.WEAK_PASSWORD);
  });
});

describe("mapAuthError — falhas de rede", () => {
  it.each<[string, unknown]>([
    ["Error('Failed to fetch')", new Error("Failed to fetch")],
    [
      "TypeError('NetworkError when attempting to fetch...')",
      Object.assign(new TypeError("NetworkError when attempting to fetch resource"), {}),
    ],
    ["Error com name=TypeError e message vazia", Object.assign(new Error(""), { name: "TypeError" })],
    ["mensagem contendo 'network' em qualquer caixa", { message: "NETWORK glitch" }],
  ])("%s → NETWORK_ERROR", (_label, input) => {
    expect(mapAuthError(input)).toBe(AUTH_MESSAGES.NETWORK_ERROR);
  });
});

describe("mapAuthError — fallback (UNEXPECTED_ERROR)", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["undefined", undefined],
    ["string vazia", ""],
    ["número 42", 42],
    ["objeto sem campos relevantes", { foo: "bar" }],
    ["Error com mensagem totalmente desconhecida", new Error("Some random Supabase glitch")],
    ["objeto com message não-string", { message: 123 }],
  ])("%s → UNEXPECTED_ERROR", (_label, input) => {
    expect(mapAuthError(input)).toBe(AUTH_MESSAGES.UNEXPECTED_ERROR);
  });
});

describe("isRateLimitError — AC-07", () => {
  it.each<[string, unknown]>([
    ["string já mapeada RATE_LIMITED", AUTH_MESSAGES.RATE_LIMITED],
    ["Error('rate limit')", new Error("rate limit exceeded")],
    ["objeto status 429", { status: 429 }],
    ["Error('Too many requests')", new Error("Too many requests")],
    ["Error('HTTP 429')", new Error("HTTP 429: Too Many Requests")],
  ])("%s → true", (_label, input) => {
    expect(isRateLimitError(input)).toBe(true);
  });

  it.each<[string, unknown]>([
    ["Error credencial inválida", new Error("Invalid login credentials")],
    ["string qualquer", "algum outro erro"],
    ["null", null],
    ["undefined", undefined],
    ["objeto sem rate limit", { status: 401, message: "Unauthorized" }],
  ])("%s → false", (_label, input) => {
    expect(isRateLimitError(input)).toBe(false);
  });
});
