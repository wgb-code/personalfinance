import { describe, expect, test } from "vitest";
import {
  AUTH_MESSAGES,
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  MAX_AVATAR_SIZE_BYTES,
  PASSWORD_MAX_LENGTH,
} from "@/features/auth/lib/constants";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/features/auth/lib/auth-schemas";

interface ValidRegisterOverrides {
  email?: string;
  password?: string;
  passwordConfirmation?: string;
  fullName?: string;
  avatar?: File;
}

function validRegister(overrides: ValidRegisterOverrides = {}) {
  return {
    email: "maria@exemplo.com",
    password: "Segura123",
    passwordConfirmation: "Segura123",
    fullName: "Maria Silva",
    ...overrides,
  };
}

function makeFile(opts: { mime: string; sizeBytes: number; name?: string }): File {
  const blob = new Blob([new ArrayBuffer(opts.sizeBytes)], { type: opts.mime });
  return new File([blob], opts.name ?? `test.${opts.mime.split("/")[1]}`, {
    type: opts.mime,
  });
}

function findIssue(
  result: ReturnType<typeof registerSchema.safeParse>,
  field: string,
) {
  if (result.success) return undefined;
  return result.error.issues.find((i) => i.path[0] === field);
}

describe("registerSchema — email", () => {
  test("SPEC-AC02: rejeita email inválido com mensagem em pt-BR", () => {
    const result = registerSchema.safeParse(validRegister({ email: "naoeumemail" }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "email")?.message).toBe(AUTH_MESSAGES.EMAIL_INVALID);
  });

  test("SPEC-AC02: rejeita email com mais de 254 chars", () => {
    const longLocal = "a".repeat(EMAIL_MAX_LENGTH);
    const longEmail = `${longLocal}@x.com`;
    const result = registerSchema.safeParse(validRegister({ email: longEmail }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "email")?.message).toBe(AUTH_MESSAGES.EMAIL_TOO_LONG);
  });

  test("SPEC-AC02: rejeita email vazio", () => {
    const result = registerSchema.safeParse(validRegister({ email: "" }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "email")).toBeDefined();
  });

  test("SPEC-AC02: aceita email com espaços nas bordas e normaliza para lowercase", () => {
    const result = registerSchema.safeParse(
      validRegister({ email: "  Maria@Exemplo.COM  " }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("maria@exemplo.com");
    }
  });

  test("SPEC-AC02: normaliza email em maiúsculas para lowercase", () => {
    const result = registerSchema.safeParse(validRegister({ email: "MARIA@X.COM" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("maria@x.com");
    }
  });

  test("SECURITY-1: preprocess do email não quebra com tipo não-string", () => {
    const result = registerSchema.safeParse({
      ...validRegister(),
      email: 12345,
    });
    expect(result.success).toBe(false);
    expect(findIssue(result, "email")).toBeDefined();
  });
});

describe("registerSchema — password", () => {
  test("SPEC-AC02: rejeita senha menor que 8 chars", () => {
    const result = registerSchema.safeParse(
      validRegister({ password: "1234", passwordConfirmation: "1234" }),
    );
    expect(result.success).toBe(false);
    expect(findIssue(result, "password")?.message).toBe(
      AUTH_MESSAGES.PASSWORD_TOO_SHORT,
    );
  });

  test("SPEC-AC02: rejeita senha sem número", () => {
    const result = registerSchema.safeParse(
      validRegister({ password: "abcdefgh", passwordConfirmation: "abcdefgh" }),
    );
    expect(result.success).toBe(false);
    expect(findIssue(result, "password")?.message).toBe(AUTH_MESSAGES.PASSWORD_WEAK);
  });

  test("SPEC-AC02: rejeita senha sem letra", () => {
    const result = registerSchema.safeParse(
      validRegister({ password: "12345678", passwordConfirmation: "12345678" }),
    );
    expect(result.success).toBe(false);
    expect(findIssue(result, "password")?.message).toBe(AUTH_MESSAGES.PASSWORD_WEAK);
  });

  test("SPEC-AC02: rejeita senha com mais de 72 chars", () => {
    const longPassword = `${"a".repeat(PASSWORD_MAX_LENGTH)}1`;
    const result = registerSchema.safeParse(
      validRegister({ password: longPassword, passwordConfirmation: longPassword }),
    );
    expect(result.success).toBe(false);
    expect(findIssue(result, "password")?.message).toBe(
      AUTH_MESSAGES.PASSWORD_TOO_LONG,
    );
  });

  test("SPEC-AC02: aceita senha forte 'Segura123'", () => {
    const result = registerSchema.safeParse(validRegister());
    expect(result.success).toBe(true);
  });
});

describe("registerSchema — passwordConfirmation", () => {
  test("SPEC-AC02: rejeita confirmação diferente da senha com path correto", () => {
    const result = registerSchema.safeParse(
      validRegister({ passwordConfirmation: "Diferente1" }),
    );
    expect(result.success).toBe(false);
    const issue = findIssue(result, "passwordConfirmation");
    expect(issue?.message).toBe(AUTH_MESSAGES.PASSWORD_MISMATCH);
    expect(issue?.path).toEqual(["passwordConfirmation"]);
  });
});

describe("registerSchema — fullName", () => {
  test("SPEC-AC02: rejeita fullName vazio", () => {
    const result = registerSchema.safeParse(validRegister({ fullName: "" }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "fullName")?.message).toBe(
      AUTH_MESSAGES.FULL_NAME_REQUIRED,
    );
  });

  test("SPEC-AC02: rejeita fullName apenas com espaços", () => {
    const result = registerSchema.safeParse(validRegister({ fullName: "   " }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "fullName")?.message).toBe(
      AUTH_MESSAGES.FULL_NAME_REQUIRED,
    );
  });

  test("SPEC-AC02: rejeita fullName com mais de 100 chars", () => {
    const longName = "a".repeat(FULL_NAME_MAX_LENGTH + 1);
    const result = registerSchema.safeParse(validRegister({ fullName: longName }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "fullName")?.message).toBe(
      AUTH_MESSAGES.FULL_NAME_TOO_LONG,
    );
  });

  test("SPEC-AC02: aceita fullName com espaços nas bordas e aplica trim", () => {
    const result = registerSchema.safeParse(
      validRegister({ fullName: "  Maria Silva  " }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Maria Silva");
    }
  });
});

describe("registerSchema — avatar", () => {
  test("SPEC-AC02: aceita avatar undefined (campo opcional)", () => {
    const result = registerSchema.safeParse(validRegister());
    expect(result.success).toBe(true);
  });

  test("SPEC-AC02: rejeita avatar com MIME application/x-msdownload", () => {
    const file = makeFile({ mime: "application/x-msdownload", sizeBytes: 1024 });
    const result = registerSchema.safeParse(validRegister({ avatar: file }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "avatar")?.message).toBe(
      AUTH_MESSAGES.AVATAR_INVALID_TYPE,
    );
  });

  test("SPEC-AC02: rejeita avatar com MIME image/svg+xml", () => {
    const file = makeFile({ mime: "image/svg+xml", sizeBytes: 1024 });
    const result = registerSchema.safeParse(validRegister({ avatar: file }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "avatar")?.message).toBe(
      AUTH_MESSAGES.AVATAR_INVALID_TYPE,
    );
  });

  test("SPEC-AC02: rejeita avatar JPEG acima de 2MB", () => {
    const file = makeFile({
      mime: "image/jpeg",
      sizeBytes: MAX_AVATAR_SIZE_BYTES + 1,
    });
    const result = registerSchema.safeParse(validRegister({ avatar: file }));
    expect(result.success).toBe(false);
    expect(findIssue(result, "avatar")?.message).toBe(
      AUTH_MESSAGES.AVATAR_TOO_LARGE,
    );
  });

  test("SPEC-AC02: aceita avatar JPEG de 1MB", () => {
    const file = makeFile({ mime: "image/jpeg", sizeBytes: 1024 * 1024 });
    const result = registerSchema.safeParse(validRegister({ avatar: file }));
    expect(result.success).toBe(true);
  });

  test("SPEC-AC02: aceita avatar PNG de 1MB", () => {
    const file = makeFile({ mime: "image/png", sizeBytes: 1024 * 1024 });
    const result = registerSchema.safeParse(validRegister({ avatar: file }));
    expect(result.success).toBe(true);
  });

  test("SPEC-AC02: aceita avatar WebP de 1MB", () => {
    const file = makeFile({ mime: "image/webp", sizeBytes: 1024 * 1024 });
    const result = registerSchema.safeParse(validRegister({ avatar: file }));
    expect(result.success).toBe(true);
  });
});

describe("registerSchema — Lei 2 (Mass Assignment)", () => {
  test("SECURITY-2: rejeita payload com isAdmin extra", () => {
    const result = registerSchema.safeParse({
      ...validRegister(),
      isAdmin: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.code === "unrecognized_keys"),
      ).toBe(true);
    }
  });

  test("SECURITY-2: rejeita payload com role extra", () => {
    const result = registerSchema.safeParse({
      ...validRegister(),
      role: "owner",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.code === "unrecognized_keys"),
      ).toBe(true);
    }
  });

  test("SECURITY-2: rejeita payload com id forjado", () => {
    const result = registerSchema.safeParse({
      ...validRegister(),
      id: "fake-uuid-1234",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.code === "unrecognized_keys"),
      ).toBe(true);
    }
  });
});

describe("loginSchema", () => {
  test("aceita credenciais válidas", () => {
    const result = loginSchema.safeParse({
      email: "joao@exemplo.com",
      password: "Segura123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("joao@exemplo.com");
    }
  });

  test("rejeita email inválido", () => {
    const result = loginSchema.safeParse({
      email: "naoeumemail",
      password: "qualquer",
    });
    expect(result.success).toBe(false);
  });

  test("SECURITY-2: rejeita campos extras (.strict)", () => {
    const result = loginSchema.safeParse({
      email: "joao@exemplo.com",
      password: "Segura123",
      isAdmin: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.code === "unrecognized_keys"),
      ).toBe(true);
    }
  });
});

describe("forgotPasswordSchema", () => {
  test("aceita email válido normalizado", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  Carlos@X.COM  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("carlos@x.com");
    }
  });

  test("rejeita email inválido", () => {
    const result = forgotPasswordSchema.safeParse({ email: "naoeumemail" });
    expect(result.success).toBe(false);
  });

  test("SECURITY-2: rejeita campos extras (.strict)", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "carlos@x.com",
      role: "admin",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.code === "unrecognized_keys"),
      ).toBe(true);
    }
  });
});

describe("resetPasswordSchema", () => {
  test("aceita nova senha válida com confirmação igual", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "NovaSegura456",
      newPasswordConfirmation: "NovaSegura456",
    });
    expect(result.success).toBe(true);
  });

  test("rejeita confirmação diferente com path correto", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "NovaSegura456",
      newPasswordConfirmation: "Outra123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "newPasswordConfirmation",
      );
      expect(issue?.message).toBe(AUTH_MESSAGES.PASSWORD_MISMATCH);
    }
  });

  test("rejeita senha fraca (sem número)", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "apenasletras",
      newPasswordConfirmation: "apenasletras",
    });
    expect(result.success).toBe(false);
  });

  test("SECURITY-2: rejeita campos extras (.strict)", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "NovaSegura456",
      newPasswordConfirmation: "NovaSegura456",
      isAdmin: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.code === "unrecognized_keys"),
      ).toBe(true);
    }
  });
});
