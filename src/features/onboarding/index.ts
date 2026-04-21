/**
 * Feature: Onboarding
 *
 * Hooks, schemas e componentes para onboarding de household (módulo 02).
 */

export { useCreateHousehold } from "./hooks/useCreateHousehold";
export type { CreateHouseholdResponse } from "./hooks/useCreateHousehold";

export { useJoinHousehold } from "./hooks/useJoinHousehold";
export type {
  JoinHouseholdInput,
  JoinHouseholdResponse,
} from "./hooks/useJoinHousehold";

export { useSkipOnboarding } from "./hooks/useSkipOnboarding";

export {
  createHouseholdSchema,
  joinHouseholdSchema,
} from "./lib/onboarding-schemas";
export type {
  CreateHouseholdInput,
  JoinHouseholdInput as JoinHouseholdSchemaInput,
} from "./lib/onboarding-schemas";

export { ONBOARDING_MESSAGES } from "./lib/onboarding-constants";
export { mapOnboardingError, isRateLimitError } from "./lib/onboarding-errors";
