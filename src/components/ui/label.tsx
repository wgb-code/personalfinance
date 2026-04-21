import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Primitivo `<Label>` baseado em `radix-ui` Label.
 *
 * Por que Radix Label e não um `<label>` cru?
 *  - Clica no label e o foco vai para o controle associado (já é nativo,
 *    mas o Radix garante consistência cross-browser e gerencia
 *    `pointer-events` em estados desabilitados).
 *  - `data-disabled` é propagado quando o input alvo está disabled, então
 *    a opacidade do label visual segue o estado real do input sem
 *    duplicar lógica.
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm font-medium leading-none select-none",
        "text-foreground",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
