/**
 * `<AuditRow>` — Linha individual de audit na timeline (AC-18, AC-19).
 *
 * Exibe:
 *   - Ícone colorido por tipo de ação.
 *   - Descrição legível: "João entrou no household".
 *   - Timestamp: "15/04 às 14:30".
 *
 * Cores:
 *   - joined = verde (entrada)
 *   - left = amarelo (saída voluntária)
 *   - removed = vermelho (remoção por owner)
 */
import { UserPlus, UserMinus, UserX } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatShortDate } from "../lib/date-format"
import type { AuditEntry } from "../hooks/useHouseholdAudit"

export interface AuditRowProps {
  entry: AuditEntry
  isLast?: boolean
}

const ACTION_CONFIG = {
  joined: {
    icon: UserPlus,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  left: {
    icon: UserMinus,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  removed: {
    icon: UserX,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
} as const

function getDescription(entry: AuditEntry): string {
  switch (entry.action) {
    case "joined":
      return `${entry.userFullName} entrou no household`
    case "left":
      return `${entry.userFullName} saiu do household`
    case "removed":
      return `${entry.userFullName} foi removido por ${entry.performerFullName}`
  }
}

function AuditRow({ entry, isLast = false }: AuditRowProps) {
  const config = ACTION_CONFIG[entry.action]
  const Icon = config.icon
  const description = getDescription(entry)

  return (
    <div className="flex gap-3" role="listitem">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            config.bgColor,
          )}
        >
          <Icon className={cn("size-4", config.color)} aria-hidden="true" />
        </div>
        {!isLast && <div className="mt-2 h-full w-px bg-border" />}
      </div>

      <div className={cn("flex flex-col gap-0.5", !isLast && "pb-6")}>
        <p className="text-sm font-medium text-foreground">{description}</p>
        <time
          className="text-xs text-muted-foreground"
          dateTime={entry.performedAt}
        >
          {formatShortDate(entry.performedAt)}
        </time>
      </div>
    </div>
  )
}

export { AuditRow }