import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AUTH_MESSAGES } from "@/features/auth/lib/constants"

/**
 * `<Field>` — composição reutilizável de Label + Input + (description |
 * error) com a11y já cabeada (Lei 9 + WCAG 2.1 AA).
 *
 * Por que existe?
 *   - Centraliza as 4 amarrações que QUASE NUNCA são feitas certas em
 *     forms grandes:
 *       1. `<Label htmlFor>` aponta para `id` do input.
 *       2. `aria-invalid` reflete se há erro (também aciona o estilo
 *          destrutivo do `<Input>`).
 *       3. `aria-describedby` aponta para o `<p id={...-error}>` quando
 *          há erro, OU para o `<p id={...-desc}>` quando há descrição.
 *          Erro ganha precedência (a11y: usuário ouve o problema, não a
 *          dica genérica que o causou).
 *       4. Mensagem de erro tem `role="alert"` para que screen readers
 *          anunciem em tempo real, sem o usuário precisar re-tabular.
 *   - Encapsula o toggle "mostrar/ocultar senha" — que tem 4 propriedades
 *     a11y (`aria-label`, `aria-pressed`, `type="button"`, `tabIndex`)
 *     que são fáceis de esquecer.
 *
 * Restrições do `.impeccable.md` honradas:
 *   - Sem `text-red-500` — o erro usa `text-destructive` (token).
 *   - Sem `border-l-4` colorido. O input passa a ter borda destrutiva
 *     uniforme via `aria-invalid` (já implementado no `<Input>`).
 *   - Tokens semânticos para `text-muted-foreground` (descrição).
 *
 * Forwarding de ref:
 *   React 19 trata `ref` como prop normal de `<input>`. O RHF (`register`)
 *   passa um `ref` que precisa chegar no <input> real para funcionar. Como
 *   `FieldProps extends React.ComponentProps<"input">`, o `ref` já é
 *   parte do tipo e simplesmente passamos adiante.
 */

export interface FieldProps extends Omit<React.ComponentProps<"input">, "id"> {
  id: string
  label: string
  description?: string
  error?: string
  /**
   * Habilita um botão de "mostrar/ocultar senha" sobreposto à direita
   * do input. Quando ativo, troca `type` entre `password` e `text`.
   *
   * O toggle NÃO armazena ou expõe o valor da senha — ele só altera o
   * atributo do input. Lei 14: o componente nunca loga o valor.
   */
  showPasswordToggle?: boolean
}

function Field({
  id,
  label,
  description,
  error,
  showPasswordToggle = false,
  type = "text",
  className,
  ref,
  ...inputProps
}: FieldProps) {
  const [revealed, setRevealed] = React.useState(false)

  const descriptionId = description ? `${id}-desc` : undefined
  const errorId = error ? `${id}-error` : undefined
  // Erro tem precedência sobre descrição quando ambos existem (a11y).
  const describedBy = errorId ?? descriptionId

  const effectiveType = showPasswordToggle && revealed ? "text" : type

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>

      <div className={cn("relative", showPasswordToggle && "isolate")}>
        <Input
          id={id}
          ref={ref}
          type={effectiveType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(showPasswordToggle && "pr-10", className)}
          {...inputProps}
        />

        {showPasswordToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setRevealed((prev) => !prev)}
            aria-label={
              revealed
                ? AUTH_MESSAGES.PASSWORD_HIDE
                : AUTH_MESSAGES.PASSWORD_SHOW
            }
            aria-pressed={revealed}
            // O toggle não deve receber foco antes do próximo campo do
            // form numa navegação por teclado natural — mas TAMBÉM
            // precisa ser alcançável (a11y). Mantemos no fluxo (sem
            // tabIndex={-1}) e confiamos na ordem visual.
            className="absolute inset-y-0 right-1 my-auto"
          >
            {revealed ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </div>

      {description && !error ? (
        <p id={descriptionId} className="text-muted-foreground text-sm">
          {description}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-destructive text-sm font-medium"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { Field }
