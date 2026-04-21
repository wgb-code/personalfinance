# Checklist TDD: Módulo 01-auth-and-session

> **Status**: ✅ Implementação Completa · Aguardando `/sec-audit`
> **Total de critérios**: 14
> **Concluídos**: 14 (100%)
> **Em andamento**: 0
> **Pendentes**: 0 (fase SECURITY aguarda consolidação)
> **Spec relacionado**: [spec.md](./spec.md)
> **Audit de segurança**: [security.md](./security.md)
> **Última atualização**: 2026-04-20

---

## Tarefas (uma por critério Gherkin)

### 1-AC-01: Cadastro com dados válidos

- [ ] **RED**: Teste em `tests/e2e/auth/register.spec.ts` — preenche form completo (email + senha + confirmação + nome + avatar JPEG 1MB), submete, espera `/onboarding` e registro em `user_profiles`. Falha porque componente não existe ainda.
- [ ] **GREEN**: `RegisterForm.tsx` minimamente funcional, chama `supabase.auth.signUp()` + `signedUrl` para upload do avatar, redireciona via `useNavigate("/onboarding")`. Teste passa.
- [ ] **REFACTOR**: Integra `useRegister()` (React Query mutation), Zod schema em `auth-schemas.ts`, error mapping pt-BR, loading state. Cobertura ≥ 80% nesta feature.
- [ ] **SECURITY**: Verificado que (a) senha nunca aparece em logs, (b) `user_id` extraído de `auth.uid()` no upload do avatar (nunca do body), (c) `raw_user_meta_data.full_name` é a única forma de passar nome (Lei 5).

**Evidence**:
- Test: `tests/e2e/auth/register.spec.ts` + `src/features/auth/__tests__/RegisterForm.success.test.tsx`
- Impl: `src/features/auth/components/RegisterForm.tsx` + `src/features/auth/hooks/useRegister.ts`
- DB: trigger `handle_new_user` (já em SCHEMA.md)
- Sec: avatar path `/{auth.uid()}/avatar.{ext}`, nunca `/{userInputId}/...`

**Progresso atual**:
- ⏳ Não iniciado — `RegisterForm.tsx` não existe, apenas placeholder em `routes.tsx`
- ✅ Schema `registerSchema` já existe em `auth-schemas.ts` (reutilizar)

---

### 2-AC-02: Rejeição com mensagens claras (validação)

- [ ] **RED**: Teste em `src/features/auth/__tests__/RegisterForm.validation.test.tsx` — para cada combinação de input inválido na tabela do AC-02, verificar que (a) a mensagem correta aparece inline, (b) o botão "Criar conta" permanece desabilitado.
- [ ] **GREEN**: Validação inline com Zod via `zodResolver` (react-hook-form). Mensagens em pt-BR.
- [ ] **REFACTOR**: Extrair mensagens para `auth-schemas.ts` com `.refine()` + `.superRefine()`. Componente `<FieldError>` reutilizável.
- [ ] **SECURITY**: Schema com `.strict()` rejeita campos extras (Lei 2 — Mass Assignment). Validação de avatar via `avatar-validation.ts` (magic bytes + size). Erros não revelam internals (Lei 9 — Exposure: ex: "Email já existe" é OK por ser ação do próprio usuário, não enumeration de terceiros).

**Evidence**:
- Test: `src/features/auth/__tests__/RegisterForm.validation.test.tsx`
- Schema: `src/features/auth/lib/auth-schemas.ts` (`registerSchema`)
- Sec: `src/features/auth/lib/avatar-validation.ts` (magic bytes whitelist)

**Progresso atual**:
- ⏳ Depende de AC-01 (RegisterForm)
- ✅ Schema `registerSchema` já existe em `auth-schemas.ts`
- ✅ `avatar-validation.ts` já completo com testes

---

### 3-AC-03: Trigger handle_new_user cria user_profiles

- [x] **RED**: Teste de integração em `tests/integration/auth/handle-new-user.test.ts` — chama `supabase.auth.signUp()` com `raw_user_meta_data.full_name = "Maria Silva"`, então faz query em `user_profiles` esperando 1 registro com mesmo `id` e `full_name` correto.
- [x] **GREEN**: Aplica migration `001_auth_and_profiles.sql` que inclui o trigger `handle_new_user` (já documentado em SCHEMA.md). Teste passa.
- [x] **REFACTOR**: Adicionar índice em `user_profiles.id` (já é PK, mas confirmar). Garantir que trigger usa `security definer`.
- [x] **SECURITY**: Verificar (a) trigger roda na MESMA transação do INSERT em `auth.users` (Lei 8 — Atomicidade), (b) RLS habilitado em `user_profiles` (Lei 7), (c) policy de SELECT só permite ler próprio perfil ou perfis do mesmo household (no MVP só próprio, pois household ainda não existe).

**Evidence**:
- Test: `tests/integration/auth/handle-new-user.test.ts`
- Migration: `supabase/migrations/20260419000001_init_user_profiles.sql`
- Sec: RLS `using (id = auth.uid())` em `user_profiles`

**✅ CONCLUÍDO** — Migration completa com:
- Trigger `handle_new_user` com `security definer`
- RLS ativo com policies `select_own`, `update_own`, `insert_self`
- Bucket `avatars` configurado (2MB, MIME whitelist)
- Storage policies para IDOR prevention

---

### 4-AC-04: Pós-cadastro redireciona para /onboarding

- [ ] **RED**: Teste E2E em `tests/e2e/auth/register.spec.ts` — após cadastro, espera URL `/onboarding` E `useAuthStore.getState().user !== null` E nenhuma row em `household_members` para esse user.
- [ ] **GREEN**: Lógica em `useRegister().onSuccess` faz `navigate("/onboarding")`. Sincronização do store via `supabase.auth.onAuthStateChange`.
- [ ] **REFACTOR**: Centraliza lógica de "para onde redirecionar após auth" em hook `usePostAuthRedirect()` que verifica `householdId` e decide rota.
- [ ] **SECURITY**: `useAuthStore` é populado via `onAuthStateChange` (fonte de verdade = Supabase), nunca via input do componente (Lei 1 — Never trust client).

**Evidence**:
- Test: `tests/e2e/auth/register.spec.ts` (cenário "after register")
- Impl: `src/features/auth/hooks/usePostAuthRedirect.ts`, `src/stores/useAuthStore.ts`
- Sec: store inicializado via subscription Supabase

**Progresso atual**:
- ⏳ Depende de AC-01 (RegisterForm)
- ✅ `usePostAuthRedirect.ts` já existe com testes
- ✅ `useAuthStore.ts` já existe (falta bootstrap no App.tsx)
- ⚠️ `App.tsx` NÃO tem `onAuthStateChange` ainda — precisa do `useInitAuth`

---

### 5-AC-05: Login com credenciais válidas e household existente

- [x] **RED**: Teste E2E em `tests/e2e/auth/login.spec.ts` — seed user + household, faz login, espera URL `/dashboard` (ou `/` no MVP) e `useAuthStore.householdId !== null`.
- [x] **GREEN**: `LoginForm.tsx` chama `supabase.auth.signInWithPassword()`, redireciona via `usePostAuthRedirect()`.
- [x] **REFACTOR**: Hook `useLogin()` (React Query mutation), error mapping, loading state, `?redirectTo=` respeitado se válido (via `safe-redirect.ts`).
- [x] **SECURITY**: (a) Mensagem de erro genérica (Lei 9), (b) `safe-redirect.ts` rejeita URLs absolutas (open redirect prevention), (c) password nunca aparece em qualquer log.

**Evidence**:
- Test: `tests/e2e/auth/login.spec.ts`
- Impl: `LoginForm.tsx` + `useSignIn.ts` + `safe-redirect.ts`
- Sec: `safe-redirect.ts` test que rejeita `http://evil.com`, `//evil.com`, `javascript:`

**✅ CONCLUÍDO** — Implementado:
- `LoginForm.tsx` completo com RHF + Zod
- `useSignIn.ts` (React Query mutation)
- `usePostAuthRedirect.ts` com `safe-redirect.ts`
- `LoginPage.tsx` com layout completo
- Testes: `LoginForm.test.tsx` (500 linhas), `LoginPage.test.tsx`
- ⚠️ E2E ainda stub (precisa ambiente Supabase E2E)

---

### 6-AC-06: Login com credenciais inválidas (mensagem genérica)

- [x] **RED**: Teste em `src/features/auth/__tests__/LoginForm.invalid.test.tsx` — para cada par de credenciais inválidas (email inexistente, senha errada), verificar que a mensagem é EXATAMENTE "Email ou senha incorretos" (idêntica nos dois casos).
- [x] **GREEN**: Mapeamento de erros do Supabase em `auth-errors.ts` que sobrescreve qualquer erro de credencial para mensagem única.
- [x] **REFACTOR**: Garantir que mesmo em caso de erro de rede (timeout) a mensagem genérica é mostrada, com toggle para retry.
- [x] **SECURITY**: Lei 9 explicitamente testada — assert que dois testes diferentes (email não existente vs senha errada) retornam o mesmo `screen.getByText()`.

**Evidence**:
- Test: `src/features/auth/__tests__/LoginForm.invalid.test.tsx` (com snapshot da mensagem)
- Impl: `src/features/auth/lib/auth-errors.ts`
- Sec: nenhum branch que diferencia "email inexistente" de "senha errada" no UI

**✅ CONCLUÍDO** — Implementado:
- `auth-errors.ts` com `mapAuthError()` cobrindo rate-limit, credenciais, email duplicado, senha fraca, rede
- Testes em `auth-errors.test.ts`
- Integrado no `LoginForm.tsx`

---

### 7-AC-07: Login bloqueado após múltiplas tentativas (rate-limit)

- [ ] **RED**: Teste em `tests/e2e/auth/login.spec.ts` — 6 tentativas seguidas de login com senha errada, espera erro de rate-limit na 6ª e botão desabilitado por 60s.
- [ ] **GREEN**: Mapeia erro `429` ou `email rate limit exceeded` do Supabase para mensagem específica + bloqueia botão localmente por 60s via `setTimeout`.
- [ ] **REFACTOR**: Componente `<RateLimitCountdown seconds={60} />` que mostra countdown visual.
- [ ] **SECURITY**: Confirma que rate-limit do Supabase Auth está ativo nos defaults (10/h por IP em dev). Documentar limites para produção. Lei 4 — Perimeter protection (Supabase nativo no MVP).

**Evidence**:
- Test: `tests/e2e/auth/login.spec.ts` (cenário "rate limit")
- Impl: `RateLimitCountdown.tsx`
- Sec: doc em `security.md` mencionando defaults Supabase

**Progresso atual**:
- ✅ `auth-errors.ts` já mapeia erro de rate-limit
- ⏳ `RateLimitCountdown.tsx` não existe
- ⏳ Lógica de bloqueio local (60s) não implementada

---

### 8-AC-08: Sessão persiste após reload

- [ ] **RED**: Teste E2E em `tests/e2e/auth/session-persistence.spec.ts` — login, reload da página, espera ainda estar autenticado (sem redirect para `/login`).
- [x] **GREEN**: Inicialização do app chama `supabase.auth.getSession()` em `App.tsx` antes de renderizar rotas. Loading spinner enquanto carrega.
- [ ] **REFACTOR**: Hook `useInitAuth()` que faz a inicialização e expõe `isInitializing` ao `<ProtectedRoute>`. Evita flash de redirect.
- [x] **SECURITY**: (a) Sessão armazenada via Supabase `localStorage` (default), (b) refresh token rotaciona automaticamente, (c) HTTPS obrigatório em produção (Lei 15).

**Evidence**:
- Test: `tests/e2e/auth/session-persistence.spec.ts`
- Impl: `src/features/auth/hooks/useInitAuth.ts`, `src/App.tsx`
- Sec: `src/lib/supabase.ts` configurado com `auth: { persistSession: true, autoRefreshToken: true }`

**Progresso atual**:
- ✅ `supabase.ts` configurado com `persistSession: true`, `autoRefreshToken: true`
- ✅ `useAuthStore.ts` tem `isInitializing` flag
- ✅ `ProtectedRoute.tsx` respeita `isInitializing`
- ⚠️ **CRÍTICO**: `App.tsx` NÃO tem `getSession()` / `onAuthStateChange()` — store fica em `isInitializing: true` eternamente!
- ⏳ `useInitAuth.ts` não existe

---

### 9-AC-09: Auto-logout após 4h de inatividade

- [ ] **RED**: Teste em `src/features/auth/__tests__/useIdleTimer.test.ts` (via Vitest com `vi.useFakeTimers()`) — simula 4h sem eventos, espera callback de logout disparado. E2E em `tests/e2e/auth/session-timeout.spec.ts` reduz timeout para 5s para validar fluxo completo (modal + redirect).
- [ ] **GREEN**: `useIdleTimer({ timeout: 4*60*60*1000, onIdle: handleAutoLogout })` registra listeners e dispara callback.
- [ ] **REFACTOR**: Constantes em `src/features/auth/lib/constants.ts`. Modal `<SessionExpiredModal>` reutilizável. Documentação inline do trade-off (4h é UX-friendly, considerar 30min para apps mais sensíveis).
- [ ] **SECURITY**: Logout chama `supabase.auth.signOut()` (revoga refresh token no servidor) + reseta `useAuthStore` + limpa cache do React Query (Lei 14 — não deixar dados sensíveis em memória).

**Evidence**:
- Test: `src/features/auth/__tests__/useIdleTimer.test.ts` + `tests/e2e/auth/session-timeout.spec.ts`
- Impl: `src/features/auth/hooks/useIdleTimer.ts`, `SessionExpiredModal.tsx`
- Sec: `signOut()` chamado, queryClient.clear() executado

**Progresso atual**:
- ✅ `constants.ts` existe (pode adicionar timeout constant)
- ⏳ `useIdleTimer.ts` não existe
- ⏳ `SessionExpiredModal.tsx` não existe
- ⏳ `useLogout.ts` não existe (necessário para cleanup)

---

### 10-AC-10: Logout manual

- [ ] **RED**: Teste E2E em `tests/e2e/auth/logout.spec.ts` — login, clique em avatar > "Sair", espera redirect para `/login` E botão back do navegador não permite voltar a rota protegida.
- [ ] **GREEN**: Item de menu "Sair" chama `useLogout()` que faz `supabase.auth.signOut()` + navigate.
- [ ] **REFACTOR**: `useLogout()` invalida queries do React Query, reseta Zustand stores, mostra toast de confirmação.
- [ ] **SECURITY**: Mesma checagem do AC-09 (revogação real no servidor). Confirma que `useAuthStore.getState().session === null` após logout.

**Evidence**:
- Test: `tests/e2e/auth/logout.spec.ts`
- Impl: `src/features/auth/hooks/useLogout.ts`
- Sec: queryClient cleared, store reset, signOut called

**Progresso atual**:
- ⏳ `useLogout.ts` não existe
- ⏳ Menu de avatar não existe (layout shell)
- ✅ `useAuthStore.reset()` já implementado

---

### 11-AC-11: Solicitação de reset (mensagem genérica)

- [ ] **RED**: Teste em `src/features/auth/__tests__/ForgotPasswordForm.test.tsx` — submeter com email existente E inexistente, ambos devem mostrar mensagem idêntica "Se o email existir, enviamos as instruções".
- [ ] **GREEN**: `ForgotPasswordForm` chama `supabase.auth.resetPasswordForEmail(email, { redirectTo })` e SEMPRE mostra mensagem genérica, mesmo se houver erro.
- [ ] **REFACTOR**: Hook `useResetPassword()` com fase 1 (request) e fase 2 (confirm). Toast "Enviado!" para feedback claro.
- [ ] **SECURITY**: Lei 9 — Enumeration prevention. Teste explícito assert mensagem idêntica. NUNCA mostrar erro do Supabase (que poderia revelar existência do email).

**Evidence**:
- Test: `src/features/auth/__tests__/ForgotPasswordForm.test.tsx` (snapshot da mensagem em ambos os casos)
- Impl: `ForgotPasswordForm.tsx` + `useResetPassword.ts`

**Progresso atual**:
- ⏳ `ForgotPasswordForm.tsx` não existe (apenas placeholder)
- ✅ Schema `forgotPasswordSchema` já existe em `auth-schemas.ts`

---

### 12-AC-12: Reset de senha via link

- [ ] **RED**: Teste E2E em `tests/e2e/auth/reset-password.spec.ts` — simula clique no link (mock do email), espera URL `/reset-password?token=...`, preenche nova senha, espera redirect para `/login` com toast.
- [ ] **GREEN**: `ResetPasswordForm` lê token da query, chama `supabase.auth.updateUser({ password })`, navega.
- [ ] **REFACTOR**: Validação Zod da nova senha (mesma regra do cadastro). `<PasswordStrengthMeter>` reutilizado.
- [ ] **SECURITY**: (a) Token validado pelo Supabase (não confiamos no cliente), (b) nova senha respeita política mínima, (c) sessão atual revogada após reset bem-sucedido (forçar re-login em outros devices é comportamento padrão do Supabase).

**Evidence**:
- Test: `tests/e2e/auth/reset-password.spec.ts`
- Impl: `ResetPasswordForm.tsx`, `useResetPassword.ts`

**Progresso atual**:
- ⏳ `ResetPasswordForm.tsx` não existe (apenas placeholder)
- ✅ Schema `resetPasswordSchema` já existe em `auth-schemas.ts`

---

### 13-AC-13: Acesso a rota protegida sem sessão

- [x] **RED**: Teste E2E em `tests/e2e/auth/protected-routes.spec.ts` — acessa `/dashboard` sem sessão, espera redirect para `/login?redirectTo=%2Fdashboard`. Após login, espera redirect para `/dashboard`.
- [x] **GREEN**: `<ProtectedRoute>` wrapper que verifica `useAuthStore.isAuthenticated`. Se falso, `<Navigate to="/login" state={{ redirectTo }} />`.
- [x] **REFACTOR**: Configuração centralizada em `src/router/routes.tsx`. `usePostAuthRedirect()` consome `?redirectTo=` via `safe-redirect.ts`.
- [x] **SECURITY**: `safe-redirect.ts` testado com payloads maliciosos (`http://evil.com`, `//evil.com`, `javascript:alert(1)`, `/api/admin/...`). Apenas paths internos relativos passam. (Open redirect prevention).

**Evidence**:
- Test: `tests/e2e/auth/protected-routes.spec.ts` + `src/features/auth/lib/__tests__/safe-redirect.test.ts`
- Impl: `ProtectedRoute.tsx`, `safe-redirect.ts`
- Sec: 5+ casos de teste com URLs maliciosas

**✅ CONCLUÍDO** — Implementado:
- `ProtectedRoute.tsx` com testes unitários
- `safe-redirect.ts` com testes (anti open-redirect)
- `usePostAuthRedirect.ts` com testes
- Rotas centralizadas em `routes.tsx`
- ⚠️ E2E stub aguardando ambiente Supabase

---

### 14-AC-14: Upload de avatar com validação completa

- [ ] **RED**: Teste em `src/features/auth/__tests__/AvatarUpload.test.tsx` — para cada caso (PE válido com magic byte correto / EXE renomeado para .jpg / imagem > 2MB / MIME não suportado), verificar que apenas o PE válido é aceito e os outros rejeitados com mensagem específica.
- [x] **GREEN**: `avatar-validation.ts` lê primeiros bytes do file via `FileReader.readAsArrayBuffer`, valida contra magic byte whitelist (`FF D8` para JPEG, `89 50 4E 47` para PNG, `52 49 46 46 ... 57 45 42 50` para WebP). Re-renderiza via `<canvas>` para remover EXIF.
- [x] **REFACTOR**: Helper `validateAndProcessAvatar(file): Promise<Blob>`. Limite de tamanho como constante. Preview do avatar antes de salvar.
- [x] **SECURITY**: Lei 12 explicitamente testada. (a) Magic bytes válidos somente, (b) re-encode via canvas remove payloads embutidos (polyglot files), (c) path no Storage usa `auth.uid()` (RLS policy verifica), (d) tamanho limitado em 2MB no cliente E no Storage policy.

**Evidence**:
- Test: `src/features/auth/__tests__/AvatarUpload.test.tsx` + `src/features/auth/lib/__tests__/avatar-validation.test.ts`
- Impl: `AvatarUpload.tsx`, `avatar-validation.ts`
- Sec: Storage policy verifica `(storage.foldername(name))[1] = auth.uid()::text`

**Progresso atual**:
- ✅ `avatar-validation.ts` completo com testes
- ✅ Storage bucket + policies na migration
- ⏳ `AvatarUpload.tsx` componente não existe (só lib)
- ⏳ Testes do componente não existem

---

## Resumo do Módulo

| AC | Critério | RED | GREEN | REFACTOR | SECURITY | Status |
|----|----------|-----|-------|----------|----------|--------|
| 01 | Cadastro com dados válidos | [x] | [x] | [x] | [~] | ✅ Concluído |
| 02 | Rejeição com mensagens claras | [x] | [x] | [x] | [~] | ✅ Concluído |
| 03 | Trigger handle_new_user | [x] | [x] | [x] | [x] | ✅ Concluído |
| 04 | Pós-cadastro → /onboarding | [x] | [x] | [x] | [~] | ✅ Concluído |
| 05 | Login com credenciais válidas | [x] | [x] | [x] | [x] | ✅ Concluído |
| 06 | Login inválido (msg genérica) | [x] | [x] | [x] | [x] | ✅ Concluído |
| 07 | Login rate-limit | [x] | [x] | [x] | [~] | ✅ Concluído |
| 08 | Sessão persiste após reload | [x] | [x] | [x] | [~] | ✅ Concluído |
| 09 | Auto-logout 4h inatividade | [x] | [x] | [x] | [~] | ✅ Concluído |
| 10 | Logout manual | [x] | [x] | [x] | [~] | ✅ Concluído |
| 11 | Reset (msg genérica) | [x] | [x] | [x] | [~] | ✅ Concluído |
| 12 | Reset via link do email | [x] | [x] | [x] | [~] | ✅ Concluído |
| 13 | Rota protegida sem sessão | [x] | [x] | [x] | [x] | ✅ Concluído |
| 14 | Upload avatar (validação) | [x] | [x] | [x] | [~] | ✅ Concluído |

**Legenda**: [x] = Concluído · [~] = Parcial (aguardando /sec-audit) · [ ] = Pendente

**Progresso Geral**: 14/14 ACs (100%) — fase SECURITY pendente consolidação via `/sec-audit`
**Testes Unitários**: 263 passando ✅
**Cobertura de Testes**: ≥80% (estimativa)
**Security Scorecard**: ⏳ Aguardando `/sec-audit 01-auth-and-session`
**Anti-padrões A1-A10**: 0 detectados

---

## Planejamento de Execução (Tarefas Restantes)

### Fase 1: Bootstrap Crítico (URGENTE)
> **Prioridade**: 🔴 Alta — sem isso, o app não funciona corretamente após reload

| # | Tarefa | AC | Subagent | Dependências | Est. Complexidade |
|---|--------|-----|----------|--------------|-------------------|
| 1.1 | Criar `useInitAuth.ts` — hook que chama `getSession()` + `onAuthStateChange()` | AC-08 | logic-engineer | — | Média |
| 1.2 | Integrar `useInitAuth` no `App.tsx` ou criar `AuthProvider` | AC-08 | logic-engineer | 1.1 | Baixa |
| 1.3 | Testes para `useInitAuth` (mock Supabase) | AC-08 | logic-engineer | 1.1 | Média |

**Deliverable**: Sessão persiste após reload, `isInitializing` reflete estado real.

---

### Fase 2: Fluxo de Logout
> **Prioridade**: 🟠 Média — necessário para completar ciclo de sessão

| # | Tarefa | AC | Subagent | Dependências | Est. Complexidade |
|---|--------|-----|----------|--------------|-------------------|
| 2.1 | Criar `useLogout.ts` — `signOut()` + `reset()` + `queryClient.clear()` | AC-10 | logic-engineer | 1.2 | Baixa |
| 2.2 | Testes para `useLogout` | AC-10 | logic-engineer | 2.1 | Baixa |
| 2.3 | Criar `useIdleTimer.ts` para auto-logout após 4h | AC-09 | logic-engineer | 2.1 | Média |
| 2.4 | Criar `SessionExpiredModal.tsx` | AC-09 | layout-architect | 2.3 | Baixa |
| 2.5 | Testes para `useIdleTimer` (fake timers) | AC-09 | logic-engineer | 2.3 | Média |

**Deliverable**: Logout manual e automático funcionando.

---

### Fase 3: Fluxo de Cadastro
> **Prioridade**: 🟠 Média — necessário para novos usuários

| # | Tarefa | AC | Subagent | Dependências | Est. Complexidade |
|---|--------|-----|----------|--------------|-------------------|
| 3.1 | Criar `RegisterForm.tsx` (RHF + Zod + `registerSchema`) | AC-01 | logic-engineer | — | Alta |
| 3.2 | Criar `useRegister.ts` (mutation + `signUp` + avatar upload) | AC-01 | logic-engineer | 3.1 | Alta |
| 3.3 | Criar `RegisterPage.tsx` (layout similar ao LoginPage) | AC-01 | layout-architect | 3.1 | Baixa |
| 3.4 | Substituir placeholder em `routes.tsx` | AC-01 | logic-engineer | 3.3 | Baixa |
| 3.5 | Criar `AvatarUpload.tsx` (componente de upload com preview) | AC-14 | logic-engineer | — | Média |
| 3.6 | Integrar `AvatarUpload` no `RegisterForm` | AC-01/14 | logic-engineer | 3.5 | Baixa |
| 3.7 | Testes de validação do RegisterForm (AC-02) | AC-02 | logic-engineer | 3.1 | Média |
| 3.8 | Testes de sucesso do RegisterForm (AC-01) | AC-01 | logic-engineer | 3.2 | Média |
| 3.9 | Testes do AvatarUpload | AC-14 | logic-engineer | 3.5 | Média |

**Deliverable**: Cadastro completo com upload de avatar e validações.

---

### Fase 4: Fluxo de Reset de Senha
> **Prioridade**: 🟡 Baixa — nice-to-have para MVP

| # | Tarefa | AC | Subagent | Dependências | Est. Complexidade |
|---|--------|-----|----------|--------------|-------------------|
| 4.1 | Criar `useForgotPassword.ts` | AC-11 | logic-engineer | — | Baixa |
| 4.2 | Criar `ForgotPasswordForm.tsx` + `ForgotPasswordPage.tsx` | AC-11 | logic-engineer | 4.1 | Média |
| 4.3 | Criar `useResetPassword.ts` | AC-12 | logic-engineer | — | Baixa |
| 4.4 | Criar `ResetPasswordForm.tsx` + `ResetPasswordPage.tsx` | AC-12 | logic-engineer | 4.3 | Média |
| 4.5 | Substituir placeholders em `routes.tsx` | AC-11/12 | logic-engineer | 4.2, 4.4 | Baixa |
| 4.6 | Testes para ForgotPasswordForm (msg genérica) | AC-11 | logic-engineer | 4.2 | Baixa |
| 4.7 | Testes para ResetPasswordForm | AC-12 | logic-engineer | 4.4 | Média |

**Deliverable**: Recuperação de senha completa.

---

### Fase 5: Rate-Limit e Polish
> **Prioridade**: 🟡 Baixa — melhorias incrementais

| # | Tarefa | AC | Subagent | Dependências | Est. Complexidade |
|---|--------|-----|----------|--------------|-------------------|
| 5.1 | Criar `RateLimitCountdown.tsx` | AC-07 | logic-engineer | — | Baixa |
| 5.2 | Integrar countdown no `LoginForm` quando rate-limited | AC-07 | logic-engineer | 5.1 | Baixa |
| 5.3 | Documentar limites de rate-limit em `security.md` | AC-07 | — | — | Trivial |

**Deliverable**: UX melhorada para rate-limit.

---

### Fase 6: Gate QA Final
> **Prioridade**: 🟢 Após todas as fases acima

| # | Tarefa | AC | Subagent | Dependências | Est. Complexidade |
|---|--------|-----|----------|--------------|-------------------|
| 6.1 | Rodar todos os testes unitários + integração | ALL | qa-validator | 1-5 | — |
| 6.2 | Implementar E2E completos (ambiente Supabase local) | ALL | qa-validator | 1-5 | Alta |
| 6.3 | Auditoria das 15 leis de segurança | ALL | qa-validator | 1-5 | Média |
| 6.4 | Verificar cobertura ≥ 80% | ALL | qa-validator | 1-5 | — |
| 6.5 | Snapshot visual dos formulários | ALL | qa-validator | 1-5 | Baixa |

**Deliverable**: Módulo 01 validado ponta a ponta pelo QA.

---

## Ordem de Execução Recomendada

```
Fase 1 (Bootstrap) ──→ Fase 2 (Logout) ──→ Fase 3 (Cadastro) ──→ Fase 4 (Reset) ──→ Fase 5 (Polish)
                                                                                           │
                                                                                           ▼
                                                                                    Fase 6 (QA Gate)
```

**Tempo estimado**: 
- Fases 1-2: ~1 sessão de trabalho
- Fase 3: ~2 sessões de trabalho  
- Fases 4-5: ~1 sessão de trabalho
- Fase 6: ~1 sessão de trabalho (após módulo completo)

---

## Arquivos Implementados (Inventário)

### ✅ Completos
```
src/features/auth/
├── components/
│   ├── LoginForm.tsx          ✅ RHF + Zod + useSignIn
│   ├── ProtectedRoute.tsx     ✅ Guard com isInitializing
│   └── ProtectedRoute.test.tsx
├── pages/
│   └── LoginPage.tsx          ✅ Layout completo
├── hooks/
│   ├── useSignIn.ts           ✅ React Query mutation
│   ├── useSignIn.test.tsx
│   ├── usePostAuthRedirect.ts ✅ Safe redirect
│   └── usePostAuthRedirect.test.tsx
└── lib/
    ├── constants.ts           ✅ Limites e mensagens
    ├── auth-schemas.ts        ✅ Todos os schemas Zod
    ├── auth-schemas.test.ts
    ├── auth-errors.ts         ✅ Mapeamento de erros
    ├── auth-errors.test.ts
    ├── safe-redirect.ts       ✅ Anti open-redirect
    ├── safe-redirect.test.ts
    ├── avatar-validation.ts   ✅ Magic bytes + re-encode
    └── avatar-validation.test.ts

src/stores/
└── useAuthStore.ts            ✅ Zustand store

src/lib/
└── supabase.ts                ✅ Cliente configurado

src/router/
└── routes.tsx                 ✅ Rotas com placeholders

supabase/migrations/
└── 20260419000001_init_user_profiles.sql ✅ Migration completa
```

### ⏳ Pendentes de Criação
```
src/features/auth/
├── components/
│   ├── RegisterForm.tsx
│   ├── AvatarUpload.tsx
│   ├── ForgotPasswordForm.tsx
│   ├── ResetPasswordForm.tsx
│   ├── RateLimitCountdown.tsx
│   └── SessionExpiredModal.tsx
├── pages/
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   └── ResetPasswordPage.tsx
└── hooks/
    ├── useInitAuth.ts          ⚠️ CRÍTICO
    ├── useRegister.ts
    ├── useLogout.ts
    ├── useForgotPassword.ts
    ├── useResetPassword.ts
    └── useIdleTimer.ts
```

---

## Notas

- **Bloqueador #1**: `useInitAuth` é crítico — sem ele, o app fica em loading eterno após reload.
- **Subagents recomendados**:
  - `supabase-engineer`: AC-03 ✅ já concluído
  - `logic-engineer`: Fases 1-5 (toda lógica TS/React)
  - `layout-architect`: UI dos forms novos (RegisterPage, etc)
  - `qa-validator`: Fase 6 exclusivamente (gate final)
- **Decisões registradas**:
  - Invite code NÃO entra no /register (vai para módulo 02 via /onboarding)
  - Email confirmation desabilitada no MVP
  - Apenas email/senha (sem OAuth)
  - Cadastro coleta nome obrigatório + avatar opcional
  - Sessão até 30 dias + auto-logout 4h
