# 📊 Progresso de Implementação

Rastreamento do status dos 15 módulos. Atualizar ao fim de cada `/module-finish`.

| # | Módulo | Status | Spec | Início | Fim | Cobertura | Segurança | Notas |
|---|--------|--------|------|--------|-----|-----------|-----------|-------|
| 01 | auth-and-session | ✅ Concluído | ✅ Pronto | 2026-04-19 | 2026-04-20 | 92% | A | 14 ACs · 334 testes · merged |
| 02 | household-onboarding | ⏳ Pendente | ✅ Pronto | — | — | —% | — | 28 ACs · Audit trail · Spec criado: 2026-04-21 (review round 2) |
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

- **Módulo Ativo**: [02-household-onboarding — Spec Pronto, aguardando `/module-start`]
- **Módulos Completos**: 1/15
- **Cobertura Média**: 92%
- **Vulnerabilidades em Aberto**: 0 CRÍTICA, 0 ALTA

---

## Histórico de Módulos

### 01-auth-and-session ✅

**Período**: 2026-04-19 → 2026-04-20 (2 dias)
**Branch**: `feat/01-auth-and-session`
**Scorecard**: A

**Entregue**:
- 14 ACs implementados
- 9 componentes UI (LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, AvatarUpload, ProtectedRoute, RateLimitCountdown, SessionExpiredModal, AuthBootstrap)
- 9 hooks (useSignIn, useRegister, useLogout, useForgotPassword, useResetPassword, useIdleTimer, useInitAuth, usePostAuthRedirect, useAuthStore)
- 1 migration (user_profiles + avatars bucket)
- 334 testes unitários

**Cobertura**: Statements 92.91% | Branches 89.93% | Functions 85.81% | Lines 93.04%

**Changelog**: [specs/modules/01-auth-and-session/CHANGELOG.md](./modules/01-auth-and-session/CHANGELOG.md)

---

## Próximo Módulo Sugerido

**02-household-onboarding** — Spec Pronto ✅

Para iniciar a implementação:
```
/module-start 02-household-onboarding
```

Isso vai criar a branch `feat/02-household-onboarding` e iniciar o ciclo TDD com 28 critérios de aceite.

---

## Specs Gerados

### 02-household-onboarding

**Spec criado**: 2026-04-21
**Última revisão**: 2026-04-21 (round 2 — `/spec-review` aplicado, 4 red flags + 14 yellow flags endereçadas)
**Critérios de Aceite**: 28 (AC-01 a AC-28, incluindo sub-cenários `.1`)
**Leis de Segurança Mapeadas**: 15 (12 aplicáveis, 1 parcial)

**Arquivos**:
- [spec.md](./modules/02-household-onboarding/spec.md) — Especificação completa (com contratos de RPCs)
- [tasks.md](./modules/02-household-onboarding/tasks.md) — Checklist TDD (28 ACs + 2 T-INFRA + 13 E2E)
- [security.md](./modules/02-household-onboarding/security.md) — Audit de segurança

**Destaques**:
- Invite code alfanumérico (6 chars, charset 32, 48h validade) via `gen_random_bytes()` (CSPRNG)
- Audit trail imutável (joined/left/removed) — INSERTs apenas via RPCs SECURITY DEFINER
- Soft delete para saída/remoção de membros + re-entry preservado
- Helper `get_user_household_id()` como base de RLS para módulos futuros
- Setter controlado `setHouseholdId` no `useAuthStore` (preserva invariante Lei 1/9)
- RPCs documentados com contratos completos (payload, retorno, erros)
- Compat retroativa com usuários do módulo 01 (sem denormalização em `user_profiles`)
