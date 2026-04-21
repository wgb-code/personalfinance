import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleAlert, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import type { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field } from "@/components/shared/Field"
import { useSignIn } from "@/features/auth/hooks/useSignIn"
import { usePostAuthRedirect } from "@/features/auth/hooks/usePostAuthRedirect"
import { loginSchema, type LoginInput } from "@/features/auth/lib/auth-schemas"
import { AUTH_MESSAGES } from "@/features/auth/lib/constants"

/**
 * Tipo de INPUT do `loginSchema` — usado pelo RHF para gerenciar o
 * estado do form. Diferente de `LoginInput` (output) porque o schema
 * usa `z.preprocess(...)` no email, que torna o tipo de entrada
 * `unknown` antes do trim/lowercase. O 3º generic de `useForm` recebe
 * o tipo de saída para que `handleSubmit((data) => mutate(data))` veja
 * `data: LoginInput` corretamente tipado (o `mutate` exige isso).
 */
type LoginFormValues = z.input<typeof loginSchema>

/**
 * `<LoginForm />` — UI do AC-05 (login com credenciais válidas) e
 * superfície a11y para os AC-06 (mensagem genérica) e AC-07
 * (rate limit).
 *
 * Consome (NÃO recria) toda a lógica:
 *   - `useSignIn`         → mutation, mapeamento de erro pt-BR, store sync.
 *   - `usePostAuthRedirect` → destino seguro pós-login (RN-18 / AC-13).
 *
 * Princípios respeitados:
 *   - Lei 1: nenhum dado sensível (user.id, householdId) entra via prop.
 *     Toda fonte de verdade vem dos hooks.
 *   - Lei 2: passamos `LoginInput` puro para `mutate` (sem spread).
 *   - Lei 9: mensagens vêm prontas do `useSignIn` (mapAuthError).
 *     Nunca fazemos mapping próprio aqui — ZERO `catch` com classificação.
 *   - Lei 10: `submitError` é renderizado via `{}` (escape default do
 *     React). ZERO `dangerouslySetInnerHTML`.
 *   - Lei 14: ZERO `console.*`. Nem para debug, nem em catch.
 *   - .impeccable.md: tokens semânticos, sem gradientes, sem `text-red-*`,
 *     sem `border-l-4`, sem `shadow-2xl`. Light mode default.
 */

export function LoginForm() {
  const { navigateAfterAuth } = usePostAuthRedirect()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { mutate, isPending } = useSignIn({
    onSuccess: () => {
      navigateAfterAuth()
    },
    onError: (msg) => {
      setSubmitError(msg)
    },
  })

  const form = useForm<LoginFormValues, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    setSubmitError(null)
    mutate(data)
  })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{AUTH_MESSAGES.LOGIN_TITLE}</CardTitle>
        <CardDescription>{AUTH_MESSAGES.LOGIN_SUBTITLE}</CardDescription>
      </CardHeader>

      <CardContent>
        {/*
         * `noValidate`: deixa o RHF/Zod falar pelo browser. Evita tooltips
         * inconsistentes do Chrome/Firefox/Safari.
         */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <Field
            id="login-email"
            label={AUTH_MESSAGES.LOGIN_EMAIL_LABEL}
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            placeholder={AUTH_MESSAGES.LOGIN_EMAIL_PLACEHOLDER}
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />

          <Field
            id="login-password"
            label={AUTH_MESSAGES.LOGIN_PASSWORD_LABEL}
            type="password"
            autoComplete="current-password"
            placeholder={AUTH_MESSAGES.LOGIN_PASSWORD_PLACEHOLDER}
            showPasswordToggle
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />

          {/*
           * `aria-live="polite"` no Alert + `role="alert"` garante que
           * screen readers anunciem novos erros sem interromper o usuário.
           * Re-render limpa o nó automaticamente quando `submitError` vira
           * `null` no próximo submit, satisfazendo o requisito de "alert
           * some antes do próximo resultado".
           */}
          {submitError ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          {/*
           * Submit fica desabilitado APENAS por `isPending`. Não bloquear
           * por `!isValid`: o usuário deve poder TENTAR enviar e ver os
           * erros inline (RN: "fail loud, fail accessible").
           */}
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
                {AUTH_MESSAGES.LOGIN_SUBMITTING}
              </>
            ) : (
              AUTH_MESSAGES.LOGIN_SUBMIT
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <Button variant="link" size="sm" asChild className="px-0">
          <Link to="/forgot-password">
            {AUTH_MESSAGES.LOGIN_FORGOT_PASSWORD_LINK}
          </Link>
        </Button>
        <Button variant="link" size="sm" asChild className="px-0">
          <Link to="/register">{AUTH_MESSAGES.LOGIN_GO_TO_REGISTER}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
