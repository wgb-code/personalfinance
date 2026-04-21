import { describe, expect, test } from "vitest";

import {
  DEFAULT_REDIRECT,
  MAX_REDIRECT_LENGTH,
  safeRedirectOr,
  sanitizeRedirectPath,
} from "@/features/auth/lib/safe-redirect";

/**
 * Bateria de testes do `sanitizeRedirectPath` — RN-18 (Open Redirect Prevention).
 *
 * Cobre tanto vetores clássicos de OWASP A1 (URL absoluta, protocol-relative,
 * esquemas perigosos) quanto bypass exóticos (CRLF injection codificado,
 * backslash, path traversal, decode malformado).
 *
 * Regra geral: somente paths internos relativos (1 `/` inicial seguido de
 * caractere "seguro") devem passar. Tudo mais retorna `null`.
 */

const VALID_INPUTS: ReadonlyArray<readonly [string, string]> = [
  ["/", "/"],
  ["/dashboard", "/dashboard"],
  ["/bills/123", "/bills/123"],
  ["/x?y=1&z=2", "/x?y=1&z=2"],
  ["/x#hash", "/x#hash"],
  ["/a/b/c.json", "/a/b/c.json"],
  ["/bills/123?tab=fixed", "/bills/123?tab=fixed"],
  ["/profile#section", "/profile#section"],
  ["/onboarding/step-1_b", "/onboarding/step-1_b"],
];

const INVALID_INPUTS: ReadonlyArray<readonly [string, string | null | undefined]> = [
  ["null", null],
  ["undefined", undefined],
  ["string vazia", ""],
  ["apenas espaços", "   "],
  ["sem leading slash (bare host)", "evil.com"],
  ["sem leading slash (path relativo)", "register"],
  ["dot-relative", "./relative"],
  ["dot-dot-relative", "../parent"],
  ["URL absoluta http", "http://evil.com"],
  ["URL absoluta https", "https://evil.com"],
  ["protocol-relative dupla barra", "//evil.com"],
  ["protocol-relative slash+backslash", "/\\evil.com"],
  ["protocol-relative dupla backslash", "\\\\evil.com"],
  ["esquema javascript", "javascript:alert(1)"],
  ["esquema javascript MAIÚSCULO", "JAVASCRIPT:alert(1)"],
  ["esquema javascript MisTo", "JaVaScRiPt:alert(1)"],
  ["esquema data com html", "data:text/html,<script>alert(1)</script>"],
  ["esquema vbscript", "vbscript:msgbox(1)"],
  ["esquema file", "file:///etc/passwd"],
  ["esquema mailto", "mailto:x@y.com"],
  ["esquema tel", "tel:+5511999999999"],
  ["esquema customizado", "custom-scheme:payload"],
  ["CRLF cru no path", "/login\r\nSet-Cookie:x=1"],
  ["LF cru no path", "/login\nSet-Cookie:x=1"],
  ["CR cru no path", "/login\rSet-Cookie:x=1"],
  ["TAB cru no path", "/login\tSet-Cookie:x=1"],
  ["CRLF codificado lowercase", "/login%0d%0aX:Y"],
  ["CRLF codificado uppercase", "/login%0D%0AX:Y"],
  ["LF codificado", "/login%0aSet-Cookie:x=1"],
  ["NULL byte codificado", "/login%00admin"],
  ["path traversal raiz", "/../etc/passwd"],
  ["path traversal aninhado", "/foo/../../bar"],
  ["path traversal codificado", "/%2e%2e/etc/passwd"],
  ["double-encoded slash", "/%252e%252e/admin"],
  ["protocol-relative codificado", "%2F%2Fevil.com"],
  ["esquema javascript codificado", "%6Aavascript:alert(1)"],
  ["backslash codificado dentro do path", "/foo%5Cbar"],
  ["backslash codificado no início do path", "/%5Cevil.com"],
  ["string com controle null", "/login\u0000"],
  ["string maior que MAX", `/${"a".repeat(MAX_REDIRECT_LENGTH + 1)}`],
  ["string com 5000 chars", `/${"a".repeat(5000)}`],
  ["decode malformado quebrado", "%E0%A4%A"],
  ["decode malformado solo", "%"],
  ["decode malformado parcial", "/foo%G1bar"],
];

describe("sanitizeRedirectPath — paths válidos passam intactos", () => {
  test.each(VALID_INPUTS)("aceita %s", (input, expected) => {
    expect(sanitizeRedirectPath(input)).toBe(expected);
  });
});

describe("sanitizeRedirectPath — payloads maliciosos são descartados", () => {
  test.each(INVALID_INPUTS)("rejeita %s", (_label, input) => {
    expect(sanitizeRedirectPath(input)).toBeNull();
  });
});

describe("sanitizeRedirectPath — invariantes adicionais", () => {
  test("decode malformado não derruba a função (URIError suprimido)", () => {
    expect(() => sanitizeRedirectPath("%E0%A4%A")).not.toThrow();
    expect(() => sanitizeRedirectPath("%")).not.toThrow();
  });

  test("string com whitespace nas bordas é trimada antes de validar", () => {
    expect(sanitizeRedirectPath("  /dashboard  ")).toBe("/dashboard");
  });

  test("trim de string que vira vazia é rejeitado", () => {
    expect(sanitizeRedirectPath("\t\t\t")).toBeNull();
  });

  test("MAX_REDIRECT_LENGTH é exposto e numérico positivo", () => {
    expect(typeof MAX_REDIRECT_LENGTH).toBe("number");
    expect(MAX_REDIRECT_LENGTH).toBeGreaterThan(0);
  });

  test("string com exatamente MAX_REDIRECT_LENGTH chars ainda passa pelo limite", () => {
    const path = `/${"a".repeat(MAX_REDIRECT_LENGTH - 1)}`;
    expect(path.length).toBe(MAX_REDIRECT_LENGTH);
    expect(sanitizeRedirectPath(path)).toBe(path);
  });
});

describe("safeRedirectOr — fallback explícito", () => {
  test("retorna fallback default quando input é inválido", () => {
    expect(safeRedirectOr(null)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectOr("javascript:alert(1)")).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectOr("//evil.com")).toBe(DEFAULT_REDIRECT);
  });

  test("retorna o input quando válido", () => {
    expect(safeRedirectOr("/dashboard")).toBe("/dashboard");
    expect(safeRedirectOr("/bills/123?tab=x")).toBe("/bills/123?tab=x");
  });

  test("aceita fallback customizado", () => {
    expect(safeRedirectOr("http://evil.com", "/onboarding")).toBe("/onboarding");
    expect(safeRedirectOr("/dashboard", "/onboarding")).toBe("/dashboard");
  });

  test("DEFAULT_REDIRECT é, ele próprio, um path interno válido (sanity check)", () => {
    expect(sanitizeRedirectPath(DEFAULT_REDIRECT)).toBe(DEFAULT_REDIRECT);
  });
});
