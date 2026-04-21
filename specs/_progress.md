# 📊 Progresso de Implementação

Rastreamento do status dos 15 módulos. Atualizar ao fim de cada `/module-finish`.

| # | Módulo | Status | Spec | Início | Fim | Cobertura | Segurança | Notas |
|---|--------|--------|------|--------|-----|-----------|-----------|-------|
| 01 | auth-and-session | 🔄 Em Progresso | ✅ Pronto | 2026-04-19 | — | —% | — | **MÓDULO ATIVO** · 14 ACs · branch `feat/01-auth-and-session` |
| 02 | household-onboarding | ⏳ Pendente | Pendente | — | — | —% | — | Invite code + Edge Function |
| 03 | categories | ⏳ Pendente | Pendente | — | — | —% | — | CRUD + padrões |
| 04 | fixed-bills | ⏳ Pendente | Pendente | — | — | —% | — | CRUD + histórico |
| 05 | bill-occurrences | ⏳ Pendente | Pendente | — | — | —% | — | RPC + pg_cron |
| 06 | variable-expenses | ⏳ Pendente | Pendente | — | — | —% | — | CRUD simples |
| 07 | installments | ⏳ Pendente | Pendente | — | — | —% | — | Parcelamento |
| 08 | income | ⏳ Pendente | Pendente | — | — | —% | — | Fontes + entradas |
| 09 | goals-and-events | ⏳ Pendente | Pendente | — | — | —% | — | Metas + eventos |
| 10 | dashboard-widgets | ⏳ Pendente | Pendente | — | — | —% | — | Reordenáveis |
| 11 | charts | ⏳ Pendente | Pendente | — | — | —% | — | Recharts + RPCs |
| 12 | filters-and-reports | ⏳ Pendente | Pendente | — | — | —% | — | Filtros + relatório |
| 13 | pdf-csv-export | ⏳ Pendente | Pendente | — | — | —% | — | Client-side |
| 14 | settings-and-prefs | ⏳ Pendente | Pendente | — | — | —% | — | User settings + tema |
| 15 | health-score | ⏳ Pendente | Pendente | — | — | —% | — | RPC + widget |

**Legenda**:
- Status: ⏳ Pendente, 🔄 Em Progresso, ✅ Completo, ⚠️ Bloqueado
- Spec: Pendente, Em revisão, Pronto (marca o status do spec.md + tasks.md + security.md)
- Cobertura: % statements + branches (Target ≥ 80%)
- Segurança: Score A/B/C (Target ≥ B)

---

## Resumo Executivo

- **Módulo Ativo**: 🔄 **01-auth-and-session** (iniciado em 2026-04-19, branch `feat/01-auth-and-session`)
- **Módulos Completos**: 0/15
- **Cobertura Média**: —%
- **Vulnerabilidades em Aberto**: 0 CRÍTICA, 0 ALTA

> ⛔ **Bloqueio ativo**: Enquanto `01-auth-and-session` estiver em progresso, **NENHUM outro módulo pode ser iniciado** (princípio "One Module at a Time" — `_constitution.md`). Para liberar, finalize via `/module-complete 01-auth-and-session`.

## Trilha do Módulo Ativo (01-auth-and-session)

> **Automação opcional**: rodar `/module-run 01-auth-and-session` (após Spec `✅ Pronto`) para que o `module-orchestrator` percorra a trilha abaixo automaticamente, despachando o subagent correto por AC e mantendo este arquivo + `tasks.md` + `orchestration-log.md` atualizados em tempo real após cada fase. Para detalhes ver [`.cursor/commands/module-run.md`](../.cursor/commands/module-run.md).

**Ordem recomendada de execução** (de `tasks.md`):

| Ordem | AC | Tarefa | Subagent | Pré-requisito |
|-------|----|--------|----------|---------------|
| 1 | AC-03 | Migration + trigger `handle_new_user` + RLS user_profiles + bucket avatars | `supabase-engineer` | Cliente Supabase configurado |
| 2 | AC-01 | Form de cadastro + signUp + upload avatar | `logic-engineer` + `layout-architect` | Migration aplicada |
| 3 | AC-04 | Pós-cadastro redireciona /onboarding | `logic-engineer` | useAuthStore criado |
| 4 | AC-13 | ProtectedRoute + safe-redirect | `logic-engineer` | Router configurado |
| 5 | AC-05 | Login com credenciais válidas | `logic-engineer` | useAuthStore + ProtectedRoute |
| 6 | AC-08 | Sessão persiste após reload | `logic-engineer` | useInitAuth |
| 7 | AC-06 | Login inválido (mensagem genérica) | `logic-engineer` | auth-errors.ts |
| 8 | AC-10 | Logout manual | `logic-engineer` | useAuthStore |
| 9 | AC-09 | Auto-logout 4h inatividade | `logic-engineer` | SessionExpiredModal |
| 10 | AC-11 | Reset (mensagem genérica) | `logic-engineer` | auth-errors.ts |
| 11 | AC-12 | Reset via link do email | `logic-engineer` | Página /reset-password |
| 12 | AC-14 | Upload avatar (validação magic bytes) | `logic-engineer` + `supabase-engineer` | Bucket configurado |
| 13 | AC-02 | Validações Zod completas | `logic-engineer` | Schemas criados |
| 14 | AC-07 | Login rate-limit | `logic-engineer` | Tratamento de erro 429 |

**Gate final**: `/sec-audit 01-auth-and-session` → Scorecard ≥ B → `qa-validator` aprova → `/module-complete 01-auth-and-session`

