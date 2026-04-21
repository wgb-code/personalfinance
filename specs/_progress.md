# 📊 Progresso de Implementação

Rastreamento do status dos 15 módulos. Atualizar ao fim de cada `/module-finish`.

| # | Módulo | Status | Spec | Início | Fim | Cobertura | Segurança | Notas |
|---|--------|--------|------|--------|-----|-----------|-----------|-------|
| 01 | auth-and-session | ✅ Concluído | ✅ Pronto | 2026-04-19 | 2026-04-20 | 92% | A | 14 ACs · 334 testes · merged |
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

- **Módulo Ativo**: [Nenhum — pronto para `/spec-draft` do próximo módulo]
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

**02-household-onboarding** — Onboarding de household + invite code

Para iniciar:
```
/spec-draft "Onboarding de household + invite code"
```

Isso vai gerar `specs/modules/02-household-onboarding/spec.md` e iniciar o ciclo TDD.
