# Changelog — 01-auth-and-session

**Período**: 2026-04-19 → 2026-04-20 (2 dias)
**Branch**: `feat/01-auth-and-session`
**Scorecard**: A

---

## Entregue

### Critérios de Aceitação (14 ACs)

1. **AC-01**: Cadastro com dados válidos (email, senha, nome, avatar)
2. **AC-02**: Rejeição com mensagens claras (validação Zod inline)
3. **AC-03**: Trigger `handle_new_user` cria `user_profiles` atomicamente
4. **AC-04**: Pós-cadastro redireciona para `/onboarding`
5. **AC-05**: Login com credenciais válidas e household existente
6. **AC-06**: Login com credenciais inválidas mostra mensagem genérica
7. **AC-07**: Login bloqueado após múltiplas tentativas (rate-limit visual)
8. **AC-08**: Sessão persiste após reload (localStorage + autoRefresh)
9. **AC-09**: Auto-logout após 4h de inatividade (UX layer)
10. **AC-10**: Logout manual com limpeza completa de estado
11. **AC-11**: Solicitação de reset mostra mensagem genérica (enumeration prevention)
12. **AC-12**: Reset de senha via link do email
13. **AC-13**: Acesso a rota protegida sem sessão redireciona para `/login?redirectTo=`
14. **AC-14**: Upload de avatar com validação completa (magic bytes + canvas re-encode)

### Componentes UI (9)

- `LoginForm.tsx` — Form de login com RHF + Zod
- `RegisterForm.tsx` — Form de cadastro com avatar upload
- `ForgotPasswordForm.tsx` — Solicitação de reset
- `ResetPasswordForm.tsx` — Nova senha após reset
- `AvatarUpload.tsx` — Upload seguro com preview
- `ProtectedRoute.tsx` — Guard de rotas autenticadas
- `RateLimitCountdown.tsx` — Countdown visual para rate-limit
- `SessionExpiredModal.tsx` — Modal de sessão expirada
- `AuthBootstrap.tsx` — Wrapper de inicialização + idle timer

### Hooks (9)

- `useSignIn.ts` — Mutation de login
- `useRegister.ts` — Mutation de cadastro + avatar upload
- `useLogout.ts` — Logout com cleanup completo
- `useForgotPassword.ts` — Request de reset
- `useResetPassword.ts` — Confirm de reset
- `useIdleTimer.ts` — Detecção de inatividade
- `useInitAuth.ts` — Inicialização de sessão
- `usePostAuthRedirect.ts` — Redirecionamento pós-auth seguro
- `useAuthStore.ts` (Zustand) — Estado global de autenticação

### Bibliotecas (5)

- `auth-schemas.ts` — Schemas Zod com `.strict()` (mass assignment protection)
- `auth-errors.ts` — Mapeamento de erros para pt-BR
- `safe-redirect.ts` — Prevenção de open redirect
- `avatar-validation.ts` — Magic bytes + EXIF stripping
- `constants.ts` — Limites, timeouts, mensagens

### Migrations (1)

- `20260419000001_init_user_profiles.sql`
  - Tabela `user_profiles` com RLS
  - Trigger `handle_new_user` (security definer)
  - Bucket `avatars` (2MB, MIME whitelist)
  - Storage policies para IDOR prevention

---

## Cobertura

| Métrica | Valor | Alvo |
|---------|-------|------|
| **Statements** | 92.91% | ≥ 80% |
| **Branches** | 89.93% | ≥ 75% |
| **Functions** | 85.81% | ≥ 80% |
| **Lines** | 93.04% | ≥ 80% |

**Testes**: 334 (unit + component)

---

## Decisões Importantes

| Decisão | Motivo | Ref |
|---------|--------|-----|
| Email confirmation OFF | Simplifica MVP, pode ativar depois | RN-4 |
| Auto-logout 4h inatividade | UX-friendly, server-side JWT TTL é o enforcement real | RN-10 |
| Avatar via magic bytes | Previne polyglot files e extensões falsas | RN-13 / Lei 12 |
| Apenas email/senha | OAuth postergado para backlog | spec.md |
| Invite code → módulo 02 | Separação de concerns, não polui registro base | spec.md |

---

## Postergado para Módulos Futuros

| Item | Módulo Destino | Motivo |
|------|----------------|--------|
| Rate-limit avançado (Turnstile) | `rate-limiter` | Supabase defaults suficientes no MVP |
| Invite code | `02-household-onboarding` | Fluxo de onboarding completo |
| 2FA (TOTP) | Backlog pós-MVP | Complexidade + dependência de recovery codes |
| OAuth (Google/Apple) | Backlog pós-MVP | Escopo controlado no MVP |
| Email templates customizados | Backlog | Supabase defaults aceitáveis |

---

## Arquivos Criados/Modificados

### Criados (31 arquivos)

```
src/features/auth/
├── components/
│   ├── AuthBootstrap.tsx
│   ├── AvatarUpload.tsx
│   ├── ForgotPasswordForm.tsx
│   ├── RateLimitCountdown.tsx
│   ├── RegisterForm.tsx
│   ├── ResetPasswordForm.tsx
│   ├── SessionExpiredModal.tsx
│   └── __tests__/ (8 arquivos)
├── pages/
│   ├── ForgotPasswordPage.tsx
│   ├── RegisterPage.tsx
│   └── ResetPasswordPage.tsx
├── hooks/
│   ├── useForgotPassword.ts
│   ├── useIdleTimer.ts
│   ├── useInitAuth.ts
│   ├── useLogout.ts
│   ├── useRegister.ts
│   ├── useResetPassword.ts
│   └── __tests__/ (5 arquivos)
└── lib/
    └── (testes adicionais)

specs/modules/01-auth-and-session/
├── CHANGELOG.md
├── quality-report.md
├── security.md
└── orchestration-log.md
```

### Modificados (6 arquivos)

```
src/App.tsx
src/router/routes.tsx
src/features/auth/components/LoginForm.tsx
src/features/auth/lib/auth-errors.ts
src/features/auth/lib/constants.ts
package.json (dependências)
```

---

## Métricas de Segurança

| Lei | Status | Implementação |
|-----|--------|---------------|
| Lei 1 — Never trust client | ✅ | RLS + auth.uid() no backend |
| Lei 2 — Schema restrito | ✅ | .strict() em todos os schemas |
| Lei 3 — Limites de tamanho | ✅ | Constantes + Storage limits |
| Lei 4 — Proteção de perímetro | ✅ | Supabase Auth defaults |
| Lei 5 — Identidade extraída | ✅ | RLS + JWT, store via onAuthStateChange |
| Lei 6 — Autorização em cada op | ✅ | RLS policies |
| Lei 7 — RLS e tenant isolation | ✅ | user_profiles + avatars |
| Lei 8 — Atomicidade | ✅ | trigger na mesma TX |
| Lei 9 — Exposição mínima | ✅ | Mensagens genéricas |
| Lei 10 — Output sanitizado | ✅ | React escaping |
| Lei 11 — Segredos no bundle | ✅ | Apenas publishable key |
| Lei 12 — Upload seguro | ✅ | Magic bytes + canvas re-encode |
| Lei 13 — Supply chain | ✅ | pnpm audit clean |
| Lei 14 — Logging seguro | ✅ | Zero dados sensíveis |
| Lei 15 — Config segura | ✅ | HTTPS + sem source maps |

**Security Score**: A (15/15 ✅)
**Anti-padrões A1-A10**: 0 detectados

---

## Links

- [spec.md](./spec.md) — Especificação completa
- [tasks.md](./tasks.md) — Checklist TDD
- [security.md](./security.md) — Auditoria de segurança
- [quality-report.md](./quality-report.md) — Relatório de qualidade
