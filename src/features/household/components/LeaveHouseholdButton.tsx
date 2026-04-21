/**
 * `<LeaveHouseholdButton>` — Botão para member sair do household (AC-11).
 *
 * Comportamento:
 *   - Modal de confirmação antes de sair.
 *   - Chama `onLeave` (vinculado a `useLeaveHousehold()`).
 *   - Toast "Você saiu do household" após sucesso.
 *
 * Nota: este botão NÃO deve ser exibido para owner com membros ativos.
 * O componente pai é responsável por essa verificação.
 */
import * as React from "react"
import { LogOut, Loader2 } from "lucide-react"
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

export interface LeaveHouseholdButtonProps {
  householdName: string
  onLeave: () => Promise<void>
  isLoading?: boolean
}

function LeaveHouseholdButton({
  householdName,
  onLeave,
  isLoading = false,
}: LeaveHouseholdButtonProps) {
  const [open, setOpen] = React.useState(false)

  const handleConfirm = async () => {
    try {
      await onLeave()
      toast.success(HOUSEHOLD_MESSAGES.LEAVE_SUCCESS)
      setOpen(false)
    } catch {
      // Error handling delegated to mutation hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" className="gap-2">
          <LogOut className="size-4" aria-hidden="true" />
          Sair do household
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sair do household?</DialogTitle>
          <DialogDescription>
            Você perderá acesso a {householdName} imediatamente. Seus dados
            permanecerão no household. Você pode voltar a entrar se receber um
            novo código de convite.
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saindo...
              </>
            ) : (
              "Sair"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { LeaveHouseholdButton }
