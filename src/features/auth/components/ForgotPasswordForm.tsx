import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/shared/Field";
import { useForgotPassword } from "@/features/auth/hooks/useForgotPassword";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/lib/auth-schemas";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

type ForgotPasswordFormValues = z.input<typeof forgotPasswordSchema>;

/**
 * `<ForgotPasswordForm />` — UI do AC-11 (Solicitação de reset de senha).
 *
 * Consome (NÃO recria) toda a lógica:
 *   - `useForgotPassword` → mutation, mensagem genérica (Lei 9).
 *
 * Princípios respeitados:
 *   - Lei 9: SEMPRE mostra mensagem genérica após submit, independente
 *     do email existir ou não (evita enumeração de contas).
 *   - Lei 10: `submitError` e `successMessage` são renderizados via `{}`
 *     (escape default do React). ZERO `dangerouslySetInnerHTML`.
 *   - Lei 14: ZERO `console.*`. Nem para debug, nem em catch.
 *   - .impeccable.md: tokens semânticos, sem gradientes, sem `text-red-*`,
 *     sem `border-l-4`, sem `shadow-2xl`. Light mode default.
 */
export function ForgotPasswordForm() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { mutate, isPending } = useForgotPassword({
    onSuccess: (msg) => {
      setSuccessMessage(msg);
      setSubmitError(null);
    },
    onError: (msg) => {
      setSubmitError(msg);
      setSuccessMessage(null);
    },
  });

  const form = useForm<ForgotPasswordFormValues, unknown, ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    setSubmitError(null);
    setSuccessMessage(null);
    mutate(data);
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{AUTH_MESSAGES.FORGOT_PASSWORD_TITLE}</CardTitle>
        <CardDescription>{AUTH_MESSAGES.FORGOT_PASSWORD_SUBTITLE}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <Field
            id="forgot-password-email"
            label={AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_LABEL}
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            placeholder={AUTH_MESSAGES.FORGOT_PASSWORD_EMAIL_PLACEHOLDER}
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />

          {submitError ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert role="status" aria-live="polite">
              <CircleCheck aria-hidden="true" />
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            aria-busy={isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />
                {AUTH_MESSAGES.FORGOT_PASSWORD_SUBMITTING}
              </>
            ) : (
              AUTH_MESSAGES.FORGOT_PASSWORD_SUBMIT
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <Button variant="link" size="sm" asChild className="px-0">
          <Link to="/login">{AUTH_MESSAGES.FORGOT_PASSWORD_GO_TO_LOGIN}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
