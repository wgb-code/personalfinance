import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Família `<Alert>` no estilo shadcn radix-nova, ajustada às restrições
 * do `.impeccable.md`:
 *
 *  - **Proibido `border-l-4` colorido**: usamos borda 1px uniforme
 *    + ícone + cor de texto para sinalizar severidade.
 *  - **Sem fundo neon**: o destrutivo usa `bg-destructive/10` (10% de
 *    opacidade do token), suficiente para diferenciar sem agredir.
 *  - **Light mode default**: tokens semânticos cobrem ambos os temas
 *    automaticamente.
 *
 * Acessibilidade:
 *  - O `role="alert"` deve ser passado pelo caller no `<Alert>` (não
 *    forçamos aqui porque alguns alertas são informativos sem
 *    semântica de "alerta urgente"). Para erros de submit do form,
 *    o `<LoginForm>` SETA `role="alert"` — a propagação para a
 *    `<AlertDescription>` chega via DOM.
 */
const alertVariants = cva(
  "relative grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-lg border p-4 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground [&>svg]:text-muted-foreground",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 font-medium leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 leading-relaxed [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
