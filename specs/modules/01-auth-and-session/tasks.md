# Checklist TDD: Módulo 01-auth-and-session

> **Status**: ✅ Implementação Completa · Security Score A
> **Total de critérios**: 14
> **Concluídos**: 14 (100%)
> **Em andamento**: 0
> **Pendentes**: 0
> **Spec relacionado**: [spec.md](./spec.md)
> **Audit de segurança**: [security.md](./security.md)
> **Quality report**: [quality-report.md](./quality-report.md)
> **Última atualização**: 2026-04-20

---

## Tarefas (uma por critério Gherkin)

### 1-AC-01: Cadastro com dados válidos

- [x] **RED**: Teste em `src/features/auth/components/__tests__/RegisterForm.test.tsx` — valida renderização, submissão e erros.
- [x] **GREEN**: `RegisterForm.tsx` funcional, chama `useRegister()` que executa `supabase.auth.signUp()` + upload de avatar.
- [x] **REFACTOR**: Integra `useRegister()` (React Query mutation), Zod schema em `auth-schemas.ts`, error mapping pt-BR, loading state. Cobertura ≥ 80%.
- [x] **SECURITY**: Verificado que (a) senha nunca aparece em logs, (b) `user_id` extraído de `auth.uid()` no upload do avatar (nunca do body), (c) `raw_user_meta_data.full_name` é a única forma de passar nome (Lei 5).

**Evidence**:
- Test: `src/features/auth/components/__tests__/RegisterForm.test.tsx`
- Impl: `src/features/auth/components/RegisterForm.tsx` + `src/features/auth/hooks/useRegister.ts`
- DB: trigger `handle_new_user` (migration aplicada)
- Sec: avatar path `/{auth.uid()}/avatar.{ext}`, nunca `/{userInputId}/...`

**✅ CONCLUÍDO**

---

### 2-AC-02: Rejeição com mensagens claras (validação)

- [x] **RED**: Teste em `src/features/auth/components/__tests__/RegisterForm.test.tsx` — verifica mensagens inline para inputs inválidos.
- [x] **GREEN**: Validação inline com Zod via `zodResolver` (react-hook-form). Mensagens em pt-BR.
- [x] **REFACTOR**: Mensagens em `auth-schemas.ts` com `.refine()` + constantes em `constants.ts`.
- [x] **SECURITY**: Schema com `.strict()` rejeita campos extras (Lei 2). Validação de avatar via `avatar-validation.ts` (magic bytes + size). Erros não revelam internals (Lei 9).

**Evidence**:
- Test: `src/features/auth/components/__tests__/RegisterForm.test.tsx`
- Schema: `src/features/auth/lib/auth-schemas.ts` (`registerSchema`)
- Sec: `src/features/auth/lib/avatar-validation.ts` (magic bytes whitelist)

**✅ CONCLUÍDO**

---

### 3-AC-03: Trigger handle_new_user cria user_profiles

- [x] **RED**: Migration testada manualmente — `signUp()` cria registro em `user_profiles` com `full_name` correto.
- [x] **GREEN**: Migration `20260419000001_init_user_profiles.sql` aplicada com trigger `handle_new_user`.
- [x] **REFACTOR**: Trigger usa `security definer` + `search_path` travado.
- [x] **SECURITY**: (a) Trigger roda na MESMA transação do INSERT em `auth.users` (Lei 8), (b) RLS habilitado em `user_profiles` (Lei 7), (c) Policy SELECT só permite ler próprio perfil.

**Evidence**:
- Migration: `supabase/migrations/20260419000001_init_user_profiles.sql`
- Sec: RLS `using (id = auth.uid())` em `user_profiles`

**✅ CONCLUÍDO**

---

### 4-AC-04: Pós-cadastro redireciona para /onboarding

- [x] **RED**: Teste em `src/features/auth/components/__tests__/RegisterForm.test.tsx` — verifica navegação após sucesso.
- [x] **GREEN**: `useRegister().onSuccess` faz `navigate("/onboarding")`. Sincronização do store via `supabase.auth.onAuthStateChange`.
- [x] **REFACTOR**: Hook `usePostAuthRedirect()` centraliza lógica de redirecionamento.
- [x] **SECURITY**: `useAuthStore` é populado via `onAuthStateChange` (fonte de verdade = Supabase), nunca via input do componente (Lei 1).

**Evidence**:
- Impl: `src/features/auth/hooks/usePostAuthRedirect.ts`, `src/stores/useAuthStore.ts`
- Sec: store inicializado via subscription Supabase

**✅ CONCLUÍDO**

---

### 5-AC-05: Login com credenciais válidas e household existente

- [x] **RED**: Teste em `src/features/auth/components/__tests__/LoginForm.test.tsx` — verifica submissão e callbacks.
- [x] **GREEN**: `LoginForm.tsx` chama `supabase.auth.signInWithPassword()`, redireciona via `usePostAuthRedirect()`.
- [x] **REFACTOR**: Hook `useSignIn()` (React Query mutation), error mapping, loading state, `?redirectTo=` respeitado via `safe-redirect.ts`.
- [x] **SECURITY**: (a) Mensagem de erro genérica (Lei 9), (b) `safe-redirect.ts` rejeita URLs absolutas (open redirect prevention), (c) password nunca aparece em logs.

**Evidence**:
- Test: `src/features/auth/components/__tests__/LoginForm.test.tsx`
- Impl: `LoginForm.tsx` + `useSignIn.ts` + `safe-redirect.ts`
- Sec: `safe-redirect.ts` test que rejeita `http://evil.com`, `//evil.com`, `javascript:`

**✅ CONCLUÍDO**

---

### 6-AC-06: Login com credenciais inválidas (mensagem genérica)

- [x] **RED**: Teste em `src/features/auth/components/__tests__/LoginForm.test.tsx` — verifica mensagem genérica para erros.
- [x] **GREEN**: Mapeamento de erros do Supabase em `auth-errors.ts` que sobrescreve qualquer erro de credencial para mensagem única.
- [x] **REFACTOR**: Mesmo tratamento para erro de rede (timeout).
- [x] **SECURITY**: Lei 9 explicitamente testada — assert que erros diferentes retornam mesma mensagem.

**Evidence**:
- Test: `src/features/auth/lib/auth-errors.test.ts`
- Impl: `src/features/auth/lib/auth-errors.ts`
- Sec: nenhum branch que diferencia "email inexistente" de "senha errada" no UI

**✅ CONCLUÍDO**

---

### 7-AC-07: Login bloqueado após múltiplas tentativas (rate-limit)

- [x] **RED**: Teste em `src/features/auth/components/__tests__/RateLimitCountdown.test.tsx`.
- [x] **GREEN**: Mapeia erro `429` do Supabase para mensagem específica + bloqueia botão via `RateLimitCountdown`.
- [x] **REFACTOR**: Componente `<RateLimitCountdown seconds={60} />` com countdown visual.
- [x] **SECURITY**: Rate-limit do Supabase Auth ativo nos defaults. Lei 4 — Perimeter protection.

**Evidence**:
- Test: `src/features/auth/components/__tests__/RateLimitCountdown.test.tsx`
- Impl: `RateLimitCountdown.tsx`
- Sec: Documentado em `quality-report.md`

**✅ CONCLUÍDO**

---

### 8-AC-08: Sessão persiste após reload

- [x] **RED**: Teste em `src/features/auth/hooks/useInitAuth.test.tsx`.
- [x] **GREEN**: `useInitAuth()` chama `supabase.auth.getSession()` no mount e registra `onAuthStateChange`.
- [x] **REFACTOR**: Hook expõe `isInitializing` para `<ProtectedRoute>`. Evita flash de redirect.
- [x] **SECURITY**: (a) Sessão via Supabase `localStorage`, (b) refresh token rotaciona automaticamente, (c) HTTPS obrigatório em produção (Lei 15).

**Evidence**:
- Test: `src/features/auth/hooks/useInitAuth.test.tsx`
- Impl: `src/features/auth/hooks/useInitAuth.ts`, `src/features/auth/components/AuthBootstrap.tsx`
- Sec: `src/lib/supabase.ts` configurado com `persistSession: true, autoRefreshToken: true`

**✅ CONCLUÍDO**

---

### 9-AC-09: Auto-logout após 4h de inatividade

- [x] **RED**: Teste em `src/features/auth/hooks/__tests__/useIdleTimer.test.tsx` (fake timers).
- [x] **GREEN**: `useIdleTimer({ onIdle })` registra listeners e dispara callback após timeout.
- [x] **REFACTOR**: Constantes em `constants.ts`. Modal `<SessionExpiredModal>` reutilizável.
- [x] **SECURITY**: Logout chama `supabase.auth.signOut()` + reseta `useAuthStore` + limpa React Query (Lei 14).

**Evidence**:
- Test: `src/features/auth/hooks/__tests__/useIdleTimer.test.tsx` + `src/features/auth/components/__tests__/SessionExpiredModal.test.tsx`
- Impl: `src/features/auth/hooks/useIdleTimer.ts`, `SessionExpiredModal.tsx`
- Sec: `signOut()` chamado, `queryClient.clear()` executado

**✅ CONCLUÍDO**

---

### 10-AC-10: Logout manual

- [x] **RED**: Teste em `src/features/auth/hooks/__tests__/useLogout.test.tsx`.
- [x] **GREEN**: `useLogout()` faz `supabase.auth.signOut()` + navigate.
- [x] **REFACTOR**: Invalida queries do React Query, reseta Zustand stores, mostra toast de confirmação.
- [x] **SECURITY**: Revogação real no servidor. `useAuthStore.getState().session === null` após logout.

**Evidence**:
- Test: `src/features/auth/hooks/__tests__/useLogout.test.tsx`
- Impl: `src/features/auth/hooks/useLogout.ts`
- Sec: queryClient cleared, store reset, signOut called

**✅ CONCLUÍDO**

---

### 11-AC-11: Solicitação de reset (mensagem genérica)

- [x] **RED**: Teste em `src/features/auth/components/__tests__/ForgotPasswordForm.test.tsx` — verifica mensagem genérica.
- [x] **GREEN**: `ForgotPasswordForm` chama `useForgotPassword` que SEMPRE mostra mensagem genérica.
- [x] **REFACTOR**: Hook `useForgotPassword()` com tratamento de sucesso/erro.
- [x] **SECURITY**: Lei 9 — Enumeration prevention. Teste assert mensagem idêntica para qualquer email.

**Evidence**:
- Test: `src/features/auth/components/__tests__/ForgotPasswordForm.test.tsx` + `src/features/auth/hooks/__tests__/useForgotPassword.test.tsx`
- Impl: `ForgotPasswordForm.tsx` + `useForgotPassword.ts`

**✅ CONCLUÍDO**

---

### 12-AC-12: Reset de senha via link

- [x] **RED**: Teste em `src/features/auth/components/__tests__/ResetPasswordForm.test.tsx`.
- [x] **GREEN**: `ResetPasswordForm` chama `useResetPassword` que executa `supabase.auth.updateUser({ password })`.
- [x] **REFACTOR**: Validação Zod da nova senha (mesma regra do cadastro).
- [x] **SECURITY**: (a) Token validado pelo Supabase, (b) nova senha respeita política mínima, (c) sessão revogada após reset.

**Evidence**:
- Test: `src/features/auth/components/__tests__/ResetPasswordForm.test.tsx` + `src/features/auth/hooks/__tests__/useResetPassword.test.tsx`
- Impl: `ResetPasswordForm.tsx`, `useResetPassword.ts`

**✅ CONCLUÍDO**

---

### 13-AC-13: Acesso a rota protegida sem sessão

- [x] **RED**: Teste em `src/features/auth/components/ProtectedRoute.test.tsx`.
- [x] **GREEN**: `<ProtectedRoute>` verifica `useAuthStore.isAuthenticated`. Se falso, redireciona para `/login?redirectTo=`.
- [x] **REFACTOR**: Configuração centralizada em `src/router/routes.tsx`. `usePostAuthRedirect()` consome `?redirectTo=` via `safe-redirect.ts`.
- [x] **SECURITY**: `safe-redirect.ts` testado com payloads maliciosos. Apenas paths internos relativos passam.

**Evidence**:
- Test: `src/features/auth/components/ProtectedRoute.test.tsx` + `src/features/auth/lib/safe-redirect.test.ts`
- Impl: `ProtectedRoute.tsx`, `safe-redirect.ts`
- Sec: 5+ casos de teste com URLs maliciosas

**✅ CONCLUÍDO**

---

### 14-AC-14: Upload de avatar com validação completa

- [x] **RED**: Teste em `src/features/auth/components/__tests__/AvatarUpload.test.tsx` + `src/features/auth/lib/avatar-validation.test.ts`.
- [x] **GREEN**: `avatar-validation.ts` valida magic bytes (`FF D8` JPEG, `89 50 4E 47` PNG, WebP). Re-renderiza via `<canvas>` para remover EXIF.
- [x] **REFACTOR**: Helper `validateAndProcessAvatar(file): Promise<Blob>`. Limite de tamanho como constante. Preview do avatar.
- [x] **SECURITY**: Lei 12 testada. (a) Magic bytes válidos somente, (b) re-encode remove payloads, (c) path usa `auth.uid()` (RLS), (d) 2MB limite.

**Evidence**:
- Test: `src/features/auth/components/__tests__/AvatarUpload.test.tsx` + `src/features/auth/lib/avatar-validation.test.ts`
- Impl: `AvatarUpload.tsx`, `avatar-validation.ts`
- Sec: Storage policy verifica `(storage.foldername(name))[1] = auth.uid()::text`

**✅ CONCLUÍDO**

---

## Resumo do Módulo

| AC | Critério | RED | GREEN | REFACTOR | SECURITY | Status |
|----|----------|-----|-------|----------|----------|--------|
| 01 | Cadastro com dados válidos | [x] | [x] | [x] | [x] | ✅ Concluído |
| 02 | Rejeição com mensagens claras | [x] | [x] | [x] | [x] | ✅ Concluído |
| 03 | Trigger handle_new_user | [x] | [x] | [x] | [x] | ✅ Concluído |
| 04 | Pós-cadastro → /onboarding | [x] | [x] | [x] | [x] | ✅ Concluído |
| 05 | Login com credenciais válidas | [x] | [x] | [x] | [x] | ✅ Concluído |
| 06 | Login inválido (msg genérica) | [x] | [x] | [x] | [x] | ✅ Concluído |
| 07 | Login rate-limit | [x] | [x] | [x] | [x] | ✅ Concluído |
| 08 | Sessão persiste após reload | [x] | [x] | [x] | [x] | ✅ Concluído |
| 09 | Auto-logout 4h inatividade | [x] | [x] | [x] | [x] | ✅ Concluído |
| 10 | Logout manual | [x] | [x] | [x] | [x] | ✅ Concluído |
| 11 | Reset (msg genérica) | [x] | [x] | [x] | [x] | ✅ Concluído |
| 12 | Reset via link do email | [x] | [x] | [x] | [x] | ✅ Concluído |
| 13 | Rota protegida sem sessão | [x] | [x] | [x] | [x] | ✅ Concluído |
| 14 | Upload avatar (validação) | [x] | [x] | [x] | [x] | ✅ Concluído |

**Legenda**: [x] = Concluído

---

## Métricas Finais

| Métrica | Valor | Alvo | Status |
|---------|-------|------|--------|
| **ACs Implementados** | 14/14 | 14 | ✅ |
| **Testes Unitários** | 334 | — | ✅ |
| **Statements** | 92.91% | ≥ 80% | ✅ |
| **Branches** | 89.93% | ≥ 75% | ✅ |
| **Functions** | 85.81% | ≥ 80% | ✅ |
| **Lines** | 93.04% | ≥ 80% | ✅ |
| **Security Score** | A | ≥ B | ✅ |
| **Anti-padrões A1-A10** | 0 | 0 | ✅ |

---

## Arquivos Implementados

```
src/features/auth/
├── components/
│   ├── AuthBootstrap.tsx          ✅ Inicialização + idle timer
│   ├── AvatarUpload.tsx           ✅ Upload com magic bytes
│   ├── ForgotPasswordForm.tsx     ✅ Recuperação de senha
│   ├── LoginForm.tsx              ✅ RHF + Zod + useSignIn
│   ├── ProtectedRoute.tsx         ✅ Guard com isInitializing
│   ├── RateLimitCountdown.tsx     ✅ Countdown visual
│   ├── RegisterForm.tsx           ✅ Cadastro completo
│   ├── ResetPasswordForm.tsx      ✅ Nova senha
│   ├── SessionExpiredModal.tsx    ✅ Modal de expiração
│   └── __tests__/                 ✅ 70+ testes
├── pages/
│   ├── ForgotPasswordPage.tsx     ✅
│   ├── LoginPage.tsx              ✅
│   ├── RegisterPage.tsx           ✅
│   └── ResetPasswordPage.tsx      ✅
├── hooks/
│   ├── useForgotPassword.ts       ✅
│   ├── useIdleTimer.ts            ✅
│   ├── useInitAuth.ts             ✅
│   ├── useLogout.ts               ✅
│   ├── usePostAuthRedirect.ts     ✅
│   ├── useRegister.ts             ✅
│   ├── useResetPassword.ts        ✅
│   ├── useSignIn.ts               ✅
│   └── __tests__/                 ✅
└── lib/
    ├── auth-errors.ts             ✅
    ├── auth-schemas.ts            ✅
    ├── avatar-validation.ts       ✅
    ├── constants.ts               ✅
    └── safe-redirect.ts           ✅

src/stores/
└── useAuthStore.ts                ✅

src/lib/
└── supabase.ts                    ✅

src/router/
└── routes.tsx                     ✅

supabase/migrations/
└── 20260419000001_init_user_profiles.sql ✅
```

---

## Decisões Registradas

- ✅ Invite code NÃO entra no /register (vai para módulo 02 via /onboarding)
- ✅ Email confirmation desabilitada no MVP (RN-4)
- ✅ Apenas email/senha (sem OAuth)
- ✅ Cadastro coleta nome obrigatório + avatar opcional
- ✅ Sessão até 30 dias + auto-logout 4h inatividade (RN-10)
- ✅ Avatar via magic byte validation (RN-13 / Lei 12)
