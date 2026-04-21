/**
 * Schemas Zod da camada de autenticação (módulo 01-auth-and-session).
 *
 * Cada schema:
 * - Aplica `.strict()` para rejeitar campos extras (Lei 2 — Mass Assignment).
 * - Define limites de tamanho explícitos (Lei 3 — DoS Prevention).
 * - Usa mensagens em pt-BR vindas de `AUTH_MESSAGES` (Lei 9 — Exposição
 *   Mínima): mensagens neutras, sem revelar internals do Supabase.
 * - É a ÚNICA forma de validar payloads vindos do formulário antes de
 *   chegar ao Supabase Auth (Lei 1 — Never trust client).
 *
 * ⚠️ Validação de avatar aqui é DEFENSIVA (MIME-based, fácil de forjar).
 * A defesa real — magic bytes + canvas re-encode para remover EXIF — vive
 * em `avatar-validation.ts` (AC-14 / Lei 12 — Upload Zero-Trust).
 * NUNCA confie SOMENTE neste schema para segurança de upload.
 */
import { z } from "zod";

import {
  ALLOWED_AVATAR_MIME_TYPES,
  AUTH_MESSAGES,
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  MAX_AVATAR_SIZE_BYTES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/features/auth/lib/constants";

const ALLOWED_AVATAR_MIME_SET = new Set<string>(ALLOWED_AVATAR_MIME_TYPES);

/**
 * Email normalizado para lowercase + trim ANTES da validação de formato.
 *
 * `z.email()` do Zod 4 valida o formato após qualquer `preprocess`, então
 * normalizar primeiro evita rejeitar entradas como "  Maria@X.COM  ", que
 * são válidas após sanitização.
 */
const emailField = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  z
    .email({ error: AUTH_MESSAGES.EMAIL_INVALID })
    .max(EMAIL_MAX_LENGTH, { error: AUTH_MESSAGES.EMAIL_TOO_LONG }),
);

/**
 * Senha com regras de força. As checagens são encadeadas em ordem
 * propositada para que a primeira issue seja a mais informativa
 * (tamanho antes de força).
 */
const passwordField = z
  .string({ error: AUTH_MESSAGES.PASSWORD_REQUIRED })
  .min(PASSWORD_MIN_LENGTH, { error: AUTH_MESSAGES.PASSWORD_TOO_SHORT })
  .max(PASSWORD_MAX_LENGTH, { error: AUTH_MESSAGES.PASSWORD_TOO_LONG })
  .regex(/[A-Za-z]/, { error: AUTH_MESSAGES.PASSWORD_WEAK })
  .regex(/\d/, { error: AUTH_MESSAGES.PASSWORD_WEAK });

const fullNameField = z
  .string({ error: AUTH_MESSAGES.FULL_NAME_REQUIRED })
  .trim()
  .min(FULL_NAME_MIN_LENGTH, { error: AUTH_MESSAGES.FULL_NAME_REQUIRED })
  .max(FULL_NAME_MAX_LENGTH, { error: AUTH_MESSAGES.FULL_NAME_TOO_LONG });

/**
 * Avatar opcional. Os refinements rodam em ordem: tipo MIME primeiro,
 * tamanho depois — assim, um arquivo .exe (MIME inválido) recebe
 * AVATAR_INVALID_TYPE em vez de AVATAR_TOO_LARGE quando excede ambos.
 */
const avatarField = z
  .instanceof(File)
  .optional()
  .refine(
    (file) => !file || ALLOWED_AVATAR_MIME_SET.has(file.type),
    { error: AUTH_MESSAGES.AVATAR_INVALID_TYPE },
  )
  .refine((file) => !file || file.size <= MAX_AVATAR_SIZE_BYTES, {
    error: AUTH_MESSAGES.AVATAR_TOO_LARGE,
  });

/**
 * registerSchema — AC-02 + Leis 2 (.strict), 3 (limites), 9 (msgs neutras),
 * 10 (output são strings literais, escape default do React).
 */
export const registerSchema = z
  .object({
    email: emailField,
    password: passwordField,
    passwordConfirmation: z.string({
      error: AUTH_MESSAGES.PASSWORD_REQUIRED,
    }),
    fullName: fullNameField,
    avatar: avatarField,
  })
  .strict()
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    error: AUTH_MESSAGES.PASSWORD_MISMATCH,
  });

/**
 * loginSchema — AC-05/AC-06 + Lei 2 (.strict).
 *
 * Aceita senha de 1-72 chars (sem checagem de força): a força só importa
 * no ato de criar/redefinir a senha. Forçar a regra no login bloquearia
 * usuários legados sem ganho real de segurança.
 */
export const loginSchema = z
  .object({
    email: emailField,
    password: z
      .string({ error: AUTH_MESSAGES.PASSWORD_REQUIRED })
      .min(1, { error: AUTH_MESSAGES.PASSWORD_REQUIRED })
      .max(PASSWORD_MAX_LENGTH, {
        error: AUTH_MESSAGES.PASSWORD_TOO_LONG,
      }),
  })
  .strict();

/**
 * forgotPasswordSchema — AC-11 + Lei 2 (.strict) + Lei 9 (resposta da
 * mutation associada será sempre genérica para evitar enumeration).
 */
export const forgotPasswordSchema = z
  .object({
    email: emailField,
  })
  .strict();

/**
 * resetPasswordSchema — AC-12 + Leis 2 (.strict) e 3 (mesmas regras de
 * força/limite do cadastro).
 *
 * O token vem da URL e é validado pelo Supabase no servidor — não cabe
 * neste schema (Lei 1: never trust client; quem decide validade é o servidor).
 */
export const resetPasswordSchema = z
  .object({
    newPassword: passwordField,
    newPasswordConfirmation: z.string({
      error: AUTH_MESSAGES.PASSWORD_REQUIRED,
    }),
  })
  .strict()
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    path: ["newPasswordConfirmation"],
    error: AUTH_MESSAGES.PASSWORD_MISMATCH,
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export { AUTH_MESSAGES } from "@/features/auth/lib/constants";
