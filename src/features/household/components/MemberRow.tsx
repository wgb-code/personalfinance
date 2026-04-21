/**
 * `<MemberRow>` — Linha individual de membro (AC-10).
 *
 * Exibe:
 *   - Avatar com fallback (iniciais).
 *   - Nome completo.
 *   - Role badge (Owner/Member).
 *   - Status badge (Ativo/Inativo).
 *   - Data de entrada.
 *   - Botão "Remover" (condicional).
 *
 * Regras de visibilidade do botão "Remover":
 *   - Apenas owner vê o botão.
 *   - Apenas em members ativos (não em inativos).
 *   - Não mostra para o próprio owner (não pode remover a si mesmo).
 */
import * as React from "react"
import { Trash2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { formatJoinedDate } from "../lib/date-format"
import type { HouseholdMember } from "../hooks/useHouseholdMembers"

export interface MemberRowMember extends HouseholdMember {
  avatarUrl?: string | null
}

export interface MemberRowProps {
  member: MemberRowMember
  currentUserId: string
  isCurrentUserOwner: boolean
  onRemove?: (member: MemberRowMember) => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function MemberRow({
  member,
  currentUserId,
  isCurrentUserOwner,
  onRemove,
}: MemberRowProps) {
  const isActive = member.isActive ?? member.leftAt === null
  const isOwner = member.role === "owner"
  const isSelf = member.userId === currentUserId

  const showRemoveButton =
    isCurrentUserOwner && isActive && !isOwner && !isSelf && onRemove

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            {member.avatarUrl ? (
              <AvatarImage src={member.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>{getInitials(member.fullName)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{member.fullName}</span>
        </div>
      </TableCell>

      <TableCell>
        <Badge variant={isOwner ? "default" : "secondary"}>
          {isOwner ? "Owner" : "Member"}
        </Badge>
      </TableCell>

      <TableCell>
        <Badge variant={isActive ? "success" : "muted"}>
          {isActive ? "Ativo" : "Inativo"}
        </Badge>
      </TableCell>

      <TableCell className="text-muted-foreground">
        {formatJoinedDate(member.joinedAt)}
      </TableCell>

      <TableCell className="text-right">
        {showRemoveButton ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onRemove(member)}
            className="gap-1.5"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remover
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  )
}

export { MemberRow }
