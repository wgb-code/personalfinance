import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Família `<Card>` no estilo shadcn radix-nova.
 *
 * Restrições do `.impeccable.md`:
 *  - NUNCA `shadow-2xl` aqui. Shadow de conteúdo fica em `shadow-sm`
 *    (modais/popovers podem ir até `shadow-md`, fora deste arquivo).
 *  - Cor vem de tokens semânticos: `bg-card`, `text-card-foreground`,
 *    `border-border`. Sem `bg-white`/`#fff` cruas.
 *  - Sem `border-l-4` decorativo. Borda 1px uniforme.
 *  - Light mode é o default; o dark é coberto pelos tokens — sem
 *    classes `dark:` explícitas aqui.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1.5 px-6 pt-6 [&:not(:has(+[data-slot=card-content]))]:pb-6",
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "text-xl font-semibold leading-tight tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  )
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6 pb-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex flex-col items-stretch gap-2 px-6 pb-6 md:flex-row md:items-center md:justify-between",
        className,
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
}
