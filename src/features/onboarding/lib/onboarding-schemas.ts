/**
 * Schemas Zod para validação de inputs do módulo de onboarding (AC-02).
 *
 * Invariantes:
 *   - `.strict()` em todos os schemas (Lei 2 — Mass Assignment).
 *   - Mensagens em pt-BR (RN-33).
 *   - Validação no cliente ANTES de enviar ao Supabase (defesa em profundidade).
 */
import { z } from "zod";

import { ONBOARDING_MESSAGES } from "@/features/onboarding/lib/onboarding-constants";

export const createHouseholdSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, ONBOARDING_MESSAGES.HOUSEHOLD_NAME_REQUIRED)
      .max(100, ONBOARDING_MESSAGES.HOUSEHOLD_NAME_TOO_LONG),
  })
  .strict();

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;

export const joinHouseholdSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .length(6, ONBOARDING_MESSAGES.INVITE_CODE_LENGTH),
  })
  .strict();

export type JoinHouseholdInput = z.infer<typeof joinHouseholdSchema>;
