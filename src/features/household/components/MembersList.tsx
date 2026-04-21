/**
 * `<MembersList>` — Tabela responsiva de membros do household (AC-10).
 *
 * Comportamento:
 *   - Avatares à esquerda.
 *   - Colunas: Nome, Role, Status, Desde, Ações.
 *   - Badge verde = ativo, cinza = inativo.
 *   - Botão "Remover" para owner (apenas em members ativos).
 *   - Modal de confirmação antes de remover.
 *
 * Props:
 *   - `members`: lista de membros do household.
 *   - `currentUserId`: ID do usuário logado.
 *   - `isCurrentUserOwner`: se o usuário logado é owner.
 *   - `onRemoveMember`: callback async para remover.
 *   - `isRemoving`: loading state da mutation.
 */
import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MemberRow, type MemberRowMember } from "./MemberRow"
import { HOUSEHOLD_MESSAGES } from "@/features/household/lib/household-constants"

export interface MembersListProps {
  members: MemberRowMember[]
  currentUserId: string
  isCurrentUserOwner: boolean
  onRemoveMember?: (member: MemberRowMember) => Promise<void>
  isRemoving?: boolean
  className?: string
}

function MembersList({
  members,
  currentUserId,
  isCurrentUserOwner,
  onRemoveMember,
  isRemoving = false,
  className,
}: MembersListProps) {
  const [memberToRemove, setMemberToRemove] =
    React.useState<MemberRowMember | null>(null)

  const handleRemoveClick = (member: MemberRowMember) => {
    setMemberToRemove(member)
  }

  const handleConfirmRemove = async () => {
    if (!memberToRemove || !onRemoveMember) return

    try {
      await onRemoveMember(memberToRemove)
      toast.success(HOUSEHOLD_MESSAGES.REMOVE_SUCCESS(memberToRemove.fullName))
      setMemberToRemove(null)
    } catch {
      // Error handling delegated to mutation hook
    }
  }

  const handleCancelRemove = () => {
    setMemberToRemove(null)
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle>Membros do Household</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentUserId={currentUserId}
                  isCurrentUserOwner={isCurrentUserOwner}
                  onRemove={onRemoveMember ? handleRemoveClick : undefined}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && handleCancelRemove()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover membro?</DialogTitle>
            <DialogDescription>
              {memberToRemove?.fullName} perderá acesso ao household
              imediatamente. Os dados criados por este membro permanecerão no
              household.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isRemoving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
              className="gap-2"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Removendo...
                </>
              ) : (
                "Remover"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { MembersList }
export type { MembersListProps, MemberRowMember as HouseholdMemberDisplay }
