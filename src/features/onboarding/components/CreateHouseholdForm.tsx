/**
 * `<CreateHouseholdForm />` — form para criar household (AC-01, AC-02).
 *
 * Consome `useCreateHousehold` do logic-engineer. NUNCA recria lógica de
 * mutation aqui — apenas UI + validação Zod inline.
 *
 * A11y:
 *   - Label associado via `htmlFor` (Field já implementa).
 *   - `aria-invalid` e `aria-describedby` para erros.
 *   - `aria-busy="true"` no botão durante loading.
 *   - Navegável 100% por teclado.
 *
 * .impeccable.md:
 *   - Tokens semânticos, sem gradientes, sem `text-red-*` cru.
 *   - Light mode default.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Loader2, Home } from "lucide-react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/shared/Field";
import {
  createHouseholdSchema,
  type CreateHouseholdInput,
} from "@/features/onboarding/lib/onboarding-schemas";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/lib/onboarding-constants";
import { useCreateHousehold } from "@/features/onboarding/hooks/useCreateHousehold";

type CreateHouseholdFormValues = z.input<typeof createHouseholdSchema>;

export interface CreateHouseholdFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function CreateHouseholdForm({
  onBack,
  onSuccess,
}: CreateHouseholdFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutate, isPending } = useCreateHousehold();

  const form = useForm<CreateHouseholdFormValues, unknown, CreateHouseholdInput>(
    {
      resolver: zodResolver(createHouseholdSchema),
      mode: "onBlur",
      defaultValues: {
        name: "",
      },
    }
  );

  const handleSubmit = form.handleSubmit((data) => {
    setSubmitError(null);
    mutate(data, {
      onSuccess: () => {
        onSuccess();
      },
      onError: (error) => {
        setSubmitError(
          error instanceof Error
            ? error.message
            : ONBOARDING_MESSAGES.UNEXPECTED_ERROR
        );
      },
    });
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Home aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Criar meu household
          </h2>
          <p className="text-sm text-muted-foreground">
            Dê um nome ao seu lar para começar
          </p>
        </div>
      </div>

      <Field
        id="household-name"
        label="Nome do household"
        type="text"
        autoComplete="off"
        placeholder="Ex: Casa da Família Silva"
        error={form.formState.errors.name?.message}
        {...form.register("name")}
      />

      {submitError ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />
              Criando...
            </>
          ) : (
            "Criar"
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={isPending}
        >
          Voltar
        </Button>
      </div>
    </form>
  );
}
