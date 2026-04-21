/**
 * Hook para pular onboarding criando household solo (AC-09).
 *
 * Wrapper sobre `useCreateHousehold` que passa o nome default "Meu Lar" (RN-16).
 * O household solo segue todas as mesmas regras (tem invite code, pode convidar depois).
 *
 * Uso:
 * ```tsx
 * const { mutate: skip, isPending } = useSkipOnboarding();
 * <Button onClick={() => skip()}>Pular por enquanto</Button>
 * ```
 */
import type { MutateOptions } from "@tanstack/react-query";

import {
  useCreateHousehold,
  type CreateHouseholdResponse,
} from "./useCreateHousehold";
import type { CreateHouseholdInput } from "@/features/onboarding/lib/onboarding-schemas";

const DEFAULT_HOUSEHOLD_NAME = "Meu Lar";

type SkipOnboardingOptions = MutateOptions<
  CreateHouseholdResponse,
  Error,
  CreateHouseholdInput
>;

export function useSkipOnboarding() {
  const createHousehold = useCreateHousehold();

  return {
    ...createHousehold,
    mutate: (options?: SkipOnboardingOptions) =>
      createHousehold.mutate({ name: DEFAULT_HOUSEHOLD_NAME }, options),
    mutateAsync: (options?: SkipOnboardingOptions): Promise<CreateHouseholdResponse> =>
      createHousehold.mutateAsync({ name: DEFAULT_HOUSEHOLD_NAME }, options),
  };
}
