/**
 * `<JoinHouseholdForm />` — form para entrar em household via código (AC-06, AC-07).
 *
 * Consome `useJoinHousehold` do logic-engineer. Input é automaticamente
 * transformado para uppercase durante a digitação.
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
 *   - Fonte monospace grande (32px) para exibição do código.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Loader2, KeyRound } from "lucide-react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  joinHouseholdSchema,
  type JoinHouseholdInput,
} from "@/features/onboarding/lib/onboarding-schemas";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/lib/onboarding-constants";
import { useJoinHousehold } from "@/features/onboarding/hooks/useJoinHousehold";

type JoinHouseholdFormValues = z.input<typeof joinHouseholdSchema>;

export interface JoinHouseholdFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function JoinHouseholdForm({
  onBack,
  onSuccess,
}: JoinHouseholdFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutate, isPending } = useJoinHousehold();

  const form = useForm<JoinHouseholdFormValues, unknown, JoinHouseholdInput>({
    resolver: zodResolver(joinHouseholdSchema),
    mode: "onBlur",
    defaultValues: {
      code: "",
    },
  });

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
            : ONBOARDING_MESSAGES.INVITE_CODE_INVALID_OR_EXPIRED
        );
      },
    });
  });

  const codeError = form.formState.errors.code?.message;
  const describedBy = codeError ? "join-code-error" : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <KeyRound
            aria-hidden="true"
            className="size-5 text-muted-foreground"
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Entrar com código
          </h2>
          <p className="text-sm text-muted-foreground">
            Digite o código de convite que você recebeu
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="join-code">Código de convite</Label>
        <Input
          id="join-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={6}
          placeholder="ABC123"
          aria-invalid={codeError ? true : undefined}
          aria-describedby={describedBy}
          className="font-mono text-2xl tracking-[0.3em] text-center uppercase placeholder:tracking-[0.3em] placeholder:text-base"
          {...form.register("code", {
            onChange: (e) => {
              e.target.value = e.target.value.toUpperCase();
            },
          })}
        />
        {codeError ? (
          <p
            id="join-code-error"
            role="alert"
            className="text-destructive text-sm font-medium"
          >
            {codeError}
          </p>
        ) : null}
      </div>

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
              Entrando...
            </>
          ) : (
            "Entrar"
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
