import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Loader2 } from "lucide-react";
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
import { useResetPassword } from "@/features/auth/hooks/useResetPassword";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/auth/lib/auth-schemas";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

type ResetPasswordFormValues = z.input<typeof resetPasswordSchema>;

/**
 * `<ResetPasswordForm />` — UI do AC-12 (Reset de senha via link).
 *
 * Pré-requisito: o usuário deve ter chegado via link de reset enviado pelo
 * Supabase. O token é extraído automaticamente pelo SDK do Supabase via
 * hash/query da URL e aplicado na sessão.
 *
 * Consome (NÃO recria) toda a lógica:
 *   - `useResetPassword` → mutation, navegação para /login, toast.
 *
 * Princípios respeitados:
 *   - Lei 1: nenhum dado sensível (token) é manipulado diretamente.
 *     O Supabase SDK lida com isso automaticamente.
 *   - Lei 9: erros vêm prontos do `useResetPassword` (mapAuthError).
 *   - Lei 10: `submitError` é renderizado via `{}` (escape default do
 *     React). ZERO `dangerouslySetInnerHTML`.
 *   - Lei 14: ZERO `console.*`. Nem para debug, nem em catch.
 *   - .impeccable.md: tokens semânticos, sem gradientes, sem `text-red-*`,
 *     sem `border-l-4`, sem `shadow-2xl`. Light mode default.
 */
export function ResetPasswordForm() {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutate, isPending } = useResetPassword({
    onError: (msg) => {
      setSubmitError(msg);
    },
  });

  const form = useForm<ResetPasswordFormValues, unknown, ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    defaultValues: {
      newPassword: "",
      newPasswordConfirmation: "",
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    setSubmitError(null);
    mutate(data);
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{AUTH_MESSAGES.RESET_PASSWORD_TITLE}</CardTitle>
        <CardDescription>{AUTH_MESSAGES.RESET_PASSWORD_SUBTITLE}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <Field
            id="reset-password-new"
            label={AUTH_MESSAGES.RESET_PASSWORD_NEW_LABEL}
            type="password"
            autoComplete="new-password"
            placeholder={AUTH_MESSAGES.RESET_PASSWORD_NEW_PLACEHOLDER}
            showPasswordToggle
            error={form.formState.errors.newPassword?.message}
            {...form.register("newPassword")}
          />

          <Field
            id="reset-password-confirm"
            label={AUTH_MESSAGES.RESET_PASSWORD_CONFIRM_LABEL}
            type="password"
            autoComplete="new-password"
            placeholder={AUTH_MESSAGES.RESET_PASSWORD_CONFIRM_PLACEHOLDER}
            showPasswordToggle
            error={form.formState.errors.newPasswordConfirmation?.message}
            {...form.register("newPasswordConfirmation")}
          />

          {submitError ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{submitError}</AlertDescription>
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
                {AUTH_MESSAGES.RESET_PASSWORD_SUBMITTING}
              </>
            ) : (
              AUTH_MESSAGES.RESET_PASSWORD_SUBMIT
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <Button variant="link" size="sm" asChild className="px-0">
          <Link to="/login">{AUTH_MESSAGES.RESET_PASSWORD_GO_TO_LOGIN}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
