/**
 * `<InviteCodeDisplay>` — Exibe invite code com opções de copiar e regenerar (AC-03).
 *
 * Comportamento:
 *   - Código em fonte monospace grande (32px).
 *   - Exibe "Válido até dd/MM/yyyy às HH:mm".
 *   - Sub-linha "(em ~Xh)" relativa.
 *   - Botão "Copiar código".
 *   - Botão "Regenerar código" (apenas para owner).
 *
 * Props:
 *   - `code`: string de 6 caracteres.
 *   - `expiresAt`: ISO timestamp da expiração.
 *   - `isOwner`: se true, mostra botão de regenerar.
 *   - `onRegenerate`: callback async para regenerar.
 *   - `isRegenerating`: loading state da mutation.
 */
import * as React from "react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CopyCodeButton } from "./CopyCodeButton"
import { RegenerateCodeButton } from "./RegenerateCodeButton"
import { formatFullDate, formatRelativeExpiry } from "../lib/date-format"

export interface InviteCodeDisplayProps {
  code: string
  expiresAt: string
  isOwner?: boolean
  onRegenerate?: () => Promise<void>
  isRegenerating?: boolean
  className?: string
}

function InviteCodeDisplay({
  code,
  expiresAt,
  isOwner = false,
  onRegenerate,
  isRegenerating = false,
  className,
}: InviteCodeDisplayProps) {
  const formattedExpiry = formatFullDate(expiresAt)
  const relativeExpiry = formatRelativeExpiry(expiresAt)

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>Código de Convite</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="font-mono text-[32px] font-bold tracking-[0.25em] text-foreground select-all cursor-default"
                aria-label={`Código de convite: ${code.split("").join(" ")}`}
              >
                {code}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Compartilhe este código para convidar pessoas</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
          <span>Válido até {formattedExpiry}</span>
          <span className="text-xs">{relativeExpiry}</span>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <CopyCodeButton code={code} />

          {isOwner && onRegenerate ? (
            <RegenerateCodeButton
              onRegenerate={onRegenerate}
              isLoading={isRegenerating}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export { InviteCodeDisplay }
