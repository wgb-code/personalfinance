import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Primitivo `<Input>` no estilo shadcn radix-nova.
 *
 * Decisões:
 * - `data-slot="input"` segue a convenção do `button.tsx` para que os
 *   tokens semânticos do `shadcn/tailwind.css` consigam estilizar o
 *   componente sem nomes mágicos de classe.
 * - Foco visível via `focus-visible:ring-3` (mesmo pattern do botão).
 * - Estado de erro derivado de `aria-invalid` — o `<Field>` shared só
 *   precisa setar `aria-invalid` para todo o estilo destrutivo aplicar.
 *   Isso casa com o `aria-invalid` que o RHF/Zod definem nativamente,
 *   evitando duplicação de classe condicional.
 * - NÃO usamos `border-l-4` colorido (proibido pelo `.impeccable.md`).
 *   A borda inteira muda para `border-destructive` quando inválido.
 */
function Input({
  className,
  type = "text",
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "md:text-sm",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
