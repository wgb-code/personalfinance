# 📊 Progresso de Implementação

Rastreamento do status dos 15 módulos. Atualizar ao fim de cada `/module-finish`.

| # | Módulo | Status | Spec | Início | Fim | Cobertura | Segurança | Notas |
|---|--------|--------|------|--------|-----|-----------|-----------|-------|
| 01 | auth-and-session | ✅ Concluído | ✅ Pronto | 2026-04-19 | 2026-04-20 | 92% | A | 14 ACs · 334 testes · merged |
| 02 | household-onboarding | 🔄 Em Progresso | ✅ Pronto | 2026-04-21 | — | 77% | A | 28 ACs · 530 testes · quality-report gerado |
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

- **Módulo Ativo**: [02-household-onboarding — Pronto para `/module-complete`]
- **Módulos Completos**: 1/15 (+ 1 em progresso)
- **Cobertura Média**: 85%
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

## Módulo em Progresso

### 02-household-onboarding 🔄

**Período**: 2026-04-21 → (em progresso)
**Branch**: `feat/02-household-onboarding`
**Scorecard**: A
**Quality Report**: [quality-report.md](./modules/02-household-onboarding/quality-report.md)

**Entregue**:
- 28 ACs implementados
- 1 migration (households, household_members, household_member_audit, join_rate_limits)
- 6 RPCs (create_household, join_household, regenerate_invite_code, leave_household, remove_member, get_current_household)
- 49 arquivos (15 onboarding + 34 household)
- 530 testes unitários
- 5 E2E specs

**Cobertura**: Statements 77.12% | Branches 70.17% | Functions 66.15% | Lines 77.04%

**Destaques**:
- Invite code alfanumérico (6 chars, charset 32, 48h validade) via `gen_random_bytes()` (CSPRNG)
- Audit trail imutável (joined/left/removed) — INSERTs apenas via RPCs SECURITY DEFINER
- Soft delete para saída/remoção de membros + re-entry preservado
- Helper `get_user_household_id()` como base de RLS para módulos futuros
- Setter controlado `setHouseholdId` no `useAuthStore` (preserva invariante Lei 1/9)
- Rate-limit 5 tentativas/min com GC automático

**Próximo passo**:
```
/module-complete 02-household-onboarding
```

---

## Próximo Módulo Sugerido

**03-categories** — Spec Pendente

CRUD de categorias de despesas com padrões pré-definidos.
