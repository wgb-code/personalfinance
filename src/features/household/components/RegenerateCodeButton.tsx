/**
 * `<RegenerateCodeButton>` — Regenera invite code (AC-04, owner only).
 *
 * Comportamento:
 *   - Modal de confirmação antes de regenerar.
 *   - Loading state durante a mutation.
 *   - Toast de sucesso: "Código regenerado com sucesso".
 *   - Apenas visível/habilitado para owner.
 *
 * Invariantes:
 *   - Usa `useRegenerateInviteCode()` do logic-engineer.
 *   - NUNCA loga o código novo em produção (Lei 14).
 */
import * as React from "react"
import { RefreshCw, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { HOUSEHOLD_MESSAGES } from "@/features/household/lib/household-constants"

export interface RegenerateCodeButtonProps {
  onRegenerate: () => Promise<void>
  isLoading?: boolean
}

function RegenerateCodeButton({
  onRegenerate,
  isLoading = false,
}: RegenerateCodeButtonProps) {
  const [open, setOpen] = React.useState(false)

  const handleConfirm = async () => {
    try {
      await onRegenerate()
      toast.success(HOUSEHOLD_MESSAGES.REGENERATE_SUCCESS)
      setOpen(false)
    } catch {
      // Error handling is delegated to the mutation hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <RefreshCw className="size-4" aria-hidden="true" />
          Regenerar código
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regenerar código de convite?</DialogTitle>
          <DialogDescription>
            O código atual será invalidado imediatamente. Todos que possuem o
            código antigo não conseguirão mais usá-lo para entrar.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Regenerando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { RegenerateCodeButton }
