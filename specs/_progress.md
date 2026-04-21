# 📊 Progresso de Implementação

Rastreamento do status dos 15 módulos. Atualizar ao fim de cada `/module-finish`.

| # | Módulo | Status | Spec | Início | Fim | Cobertura | Segurança | Notas |
|---|--------|--------|------|--------|-----|-----------|-----------|-------|
| 01 | auth-and-session | ✅ Concluído | ✅ Pronto | 2026-04-19 | 2026-04-20 | 92% | A | 14 ACs · 334 testes · merged |
| 02 | household-onboarding | ✅ Concluído | ✅ Pronto | 2026-04-21 | 2026-04-21 | 77% | A | 28 ACs · 530 testes · merged |
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

- **Módulo Ativo**: [Nenhum — pronto para `/spec-draft` do próximo módulo]
- **Módulos Completos**: 2/15
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

## Histórico de Módulos

### 02-household-onboarding ✅

**Período**: 2026-04-21 (1 dia)
**Branch**: `feat/02-household-onboarding`
**Scorecard**: A
**Changelog**: [CHANGELOG.md](./modules/02-household-onboarding/CHANGELOG.md)

**Entregue**:
- 28 ACs implementados
- 2 migrations (households + fix_pgcrypto)
- 6 RPCs (create_household, join_household, regenerate_invite_code, leave_household, remove_member, get_current_household)
- 14 componentes UI + 12 hooks
- 530 testes unitários + 5 E2E specs

**Cobertura**: Statements 77% | Branches 70% | Functions 66% | Lines 77%

**Destaques**:
- Invite code alfanumérico via CSPRNG (pgcrypto)
- Audit trail imutável (joined/left/removed)
- Helper `get_user_household_id()` para RLS de módulos futuros
- Setter controlado `setHouseholdId` no store

---

## Próximo Módulo Sugerido

**03-categories** — Spec Pendente

CRUD de categorias de despesas com padrões pré-definidos.

Para iniciar:
```
/spec-draft "CRUD de categorias de despesas com padrões"
```
