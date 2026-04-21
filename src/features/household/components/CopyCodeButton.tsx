/**
 * `<CopyCodeButton>` — Copia invite code para clipboard (AC-27, AC-27.1).
 *
 * Comportamento:
 *   - Usa `navigator.clipboard.writeText()` quando disponível (HTTPS/localhost).
 *   - Feedback visual: ícone muda para ✓, label "Copiado!" por 2s.
 *   - Fallback: input readOnly pré-selecionado com instrução.
 *   - `aria-live="polite"` na mudança de estado.
 *
 * Segurança (Lei 14):
 *   - NUNCA loga o código copiado em console ou telemetria.
 */
import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface CopyCodeButtonProps {
  code: string
  className?: string
}

function CopyCodeButton({ code, className }: CopyCodeButtonProps) {
  const [copied, setCopied] = React.useState(false)
  const [showFallback, setShowFallback] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasClipboard = typeof navigator !== "undefined" && !!navigator.clipboard

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleCopy = async () => {
    if (hasClipboard) {
      try {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        timeoutRef.current = setTimeout(() => setCopied(false), 2000)
      } catch {
        setShowFallback(true)
        setTimeout(() => inputRef.current?.select(), 50)
      }
    } else {
      setShowFallback(true)
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }

  if (showFallback) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <Input
          ref={inputRef}
          readOnly
          value={code}
          className="font-mono text-center"
          onClick={(e) => e.currentTarget.select()}
        />
        <p className="text-sm text-muted-foreground text-center">
          Pressione Ctrl+C / Cmd+C para copiar
        </p>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn("gap-2", className)}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check className="size-4" aria-hidden="true" />
          Copiado!
        </>
      ) : (
        <>
          <Copy className="size-4" aria-hidden="true" />
          Copiar código
        </>
      )}
    </Button>
  )
}

export { CopyCodeButton }
