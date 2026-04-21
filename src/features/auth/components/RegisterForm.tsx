/**
 * `<RegisterForm />` — UI do AC-01 (Cadastro com dados válidos).
 *
 * Consome (NÃO recria) toda a lógica:
 *   - `useRegister` → mutation, mapeamento de erro pt-BR, store sync, navegação.
 *
 * Princípios respeitados:
 *   - Lei 1: nenhum dado sensível entra via prop.
 *   - Lei 2: passamos `RegisterInput` puro para `mutate` (sem spread).
 *   - Lei 9: mensagens vêm prontas do `useRegister` (mapAuthError).
 *   - Lei 10: `submitError` é renderizado via `{}` (escape default do React).
 *   - Lei 14: ZERO `console.*`.
 *   - .impeccable.md: tokens semânticos, sem gradientes, light mode default.
 */
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { z } from "zod";

import { AvatarUpload } from "@/features/auth/components/AvatarUpload";

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
import { useRegister } from "@/features/auth/hooks/useRegister";
import {
  registerSchema,
  type RegisterInput,
} from "@/features/auth/lib/auth-schemas";
import { AUTH_MESSAGES } from "@/features/auth/lib/constants";

type RegisterFormValues = z.input<typeof registerSchema>;

export function RegisterForm() {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutate, isPending } = useRegister();

  const form = useForm<RegisterFormValues, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
      fullName: "",
      avatar: undefined,
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    setSubmitError(null);
    mutate(data, {
      onError: (error) => {
        setSubmitError(error.message);
      },
    });
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{AUTH_MESSAGES.REGISTER_TITLE}</CardTitle>
        <CardDescription>{AUTH_MESSAGES.REGISTER_SUBTITLE}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col items-center">
            <Controller
              name="avatar"
              control={form.control}
              render={({ field, fieldState }) => (
                <AvatarUpload
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {AUTH_MESSAGES.REGISTER_AVATAR_HINT}
            </p>
          </div>

          <Field
            id="register-full-name"
            label={AUTH_MESSAGES.REGISTER_FULL_NAME_LABEL}
            type="text"
            autoComplete="name"
            placeholder={AUTH_MESSAGES.REGISTER_FULL_NAME_PLACEHOLDER}
            error={form.formState.errors.fullName?.message}
            {...form.register("fullName")}
          />

          <Field
            id="register-email"
            label={AUTH_MESSAGES.REGISTER_EMAIL_LABEL}
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            placeholder={AUTH_MESSAGES.REGISTER_EMAIL_PLACEHOLDER}
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />

          <Field
            id="register-password"
            label={AUTH_MESSAGES.REGISTER_PASSWORD_LABEL}
            type="password"
            autoComplete="new-password"
            placeholder={AUTH_MESSAGES.REGISTER_PASSWORD_PLACEHOLDER}
            showPasswordToggle
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />

          <Field
            id="register-password-confirmation"
            label={AUTH_MESSAGES.REGISTER_PASSWORD_CONFIRM_LABEL}
            type="password"
            autoComplete="new-password"
            placeholder={AUTH_MESSAGES.REGISTER_PASSWORD_CONFIRM_PLACEHOLDER}
            showPasswordToggle
            error={form.formState.errors.passwordConfirmation?.message}
            {...form.register("passwordConfirmation")}
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
                {AUTH_MESSAGES.REGISTER_SUBMITTING}
              </>
            ) : (
              AUTH_MESSAGES.REGISTER_SUBMIT
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <Button variant="link" size="sm" asChild className="px-0">
          <Link to="/login">{AUTH_MESSAGES.REGISTER_GO_TO_LOGIN}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
