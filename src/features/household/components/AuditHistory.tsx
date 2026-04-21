/**
 * `<AuditHistory>` — Timeline vertical de audit (AC-18, AC-19).
 *
 * Comportamento:
 *   - Timeline vertical com ícones por tipo de ação.
 *   - Ícones: entrada = verde, saída = amarelo, remoção = vermelho.
 *   - Formato: "João entrou no household" · "15/04 às 14:30".
 *   - Apenas visível para owner (controle no componente pai).
 *   - Ordenado por data (mais recente primeiro).
 *
 * Invariantes de segurança:
 *   - NÃO mostra emails ou UUIDs (RN-27).
 *   - A verificação de owner é feita no RPC e na UI pai.
 */
import { History } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AuditRow } from "./AuditRow"
import type { AuditEntry } from "../hooks/useHouseholdAudit"

export interface AuditHistoryProps {
  entries: AuditEntry[]
  className?: string
}

function AuditHistory({ entries, className }: AuditHistoryProps) {
  if (entries.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5" aria-hidden="true" />
            Histórico de Membros
          </CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma atividade registrada ainda.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5" aria-hidden="true" />
          Histórico de Membros
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col" role="list" aria-label="Histórico de ações">
          {entries.map((entry, index) => (
            <AuditRow key={entry.id} entry={entry} isLast={index === entries.length - 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export { AuditHistory }