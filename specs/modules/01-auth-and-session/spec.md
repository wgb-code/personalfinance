# Especificação do Módulo: 01-auth-and-session

> **Status**: Spec Pronto · Aguardando `/spec-review`
> **Spec criado em**: 2026-04-19
> **Gerado por**: spec-architect (a partir de `/spec-draft "Autenticação & Usuários"`)

---

## 📋 Objetivo

Implementar autenticação completa (cadastro, login, logout, recuperação de senha e sessão persistente com timeout por inatividade) usando **Supabase Auth nativo** com email/senha, criando perfil de usuário (nome obrigatório + avatar opcional) e proteção de rotas — preparando o terreno para o módulo 02 (`household-onboarding`), que tratará invite codes e vinculação a households.

---

## 👥 Personas & Casos de Uso

### Personas Envolvidas

- **Maria (novo usuário)**: Acessa o app pela primeira vez sem qualquer vínculo. Precisa criar uma conta para começar a usar o organizador financeiro.
- **João (usuário existente)**: Já possui conta criada e household configurada (módulo 02 já completo). Acessa diariamente para registrar despesas e checar saldo.
- **Carlos (usuário esquecido)**: Voltou ao app após meses sem acessar. Esqueceu a senha. Precisa recuperar acesso sem perder dados.
- **Visitante anônimo**: Tenta acessar URL profunda do app (`/dashboard`, `/bills`) sem estar autenticado.

### Casos de Uso

- **UC-1**: Maria acessa `/register`, preenche email + senha + confirmação + nome completo + avatar (opcional) e clica "Criar conta". Resultado: conta criada, sessão iniciada automaticamente, redirecionada para `/onboarding` (módulo 02 — ainda sem household).
- **UC-2**: João acessa `/login`, digita email + senha. Resultado: sessão restaurada, redirecionado para `/dashboard` (módulo 08 — futuro) por já ter household associado.
- **UC-3**: Carlos clica em "Esqueci minha senha" no `/login`, informa o email, recebe link por email, clica no link, define nova senha em `/reset-password`. Resultado: senha atualizada, redirecionado para `/login`.
- **UC-4**: João está logado em `/expenses` e fica 4h sem qualquer interação. Resultado: modal "Sua sessão expirou por inatividade" é exibido, sessão é destruída, ao clicar "OK" é redirecionado para `/login`.
- **UC-5**: Maria clica em "Sair" no menu do avatar. Resultado: `supabase.auth.signOut()` é chamado, `useAuthStore` é resetado, redirecionada para `/login`.
- **UC-6**: Visitante anônimo digita `/dashboard` na URL. Resultado: `<ProtectedRoute>` detecta ausência de sessão, redireciona para `/login?redirectTo=/dashboard`. Após login bem-sucedido, é levado direto a `/dashboard`.
- **UC-7**: Maria tenta cadastrar com email já existente. Resultado: erro "Já existe uma conta com este email" exibido inline no campo email, formulário não é enviado.
- **UC-8**: Maria tenta cadastrar com senha "1234". Resultado: validação Zod rejeita ("Senha deve ter ao menos 8 caracteres, incluindo letra e número"), botão "Criar conta" permanece desabilitado.

---

## ⚖️ Regras de Negócio

- **RN-1**: Cadastro exige obrigatoriamente: `email` (formato válido, ≤ 254 chars), `password` (8-72 chars, ≥ 1 letra e ≥ 1 número), `passwordConfirmation` (idêntica a `password`) e `fullName` (1-100 chars). Avatar é opcional.
- **RN-2**: Email é único globalmente (controlado pelo Supabase Auth). Tentativa de cadastro duplicado retorna erro genérico em pt-BR.
- **RN-3**: Senha NUNCA trafega ou é armazenada em plaintext. Supabase Auth aplica bcrypt automaticamente.
- **RN-4**: Confirmação de email está **DESABILITADA no MVP** (Supabase Dashboard → Auth → Email Confirmations = OFF). Usuário loga imediatamente após cadastro.
- **RN-5**: Após cadastro bem-sucedido, sessão é iniciada automaticamente (sem segundo login manual) e usuário é redirecionado para `/onboarding`.
- **RN-6**: Após login bem-sucedido, o destino é determinado pela presença de `household_id`:
  - Sem household → `/onboarding` (módulo 02)
  - Com household → `/dashboard` (módulo 08, ou rota raiz `/` no MVP)
  - Se vier com `?redirectTo=<path>`, respeita esse destino (apenas se path interno seguro).
- **RN-7**: Login com credenciais inválidas retorna mensagem genérica "Email ou senha incorretos" — sem revelar se o email existe ou não (Lei 9 — Exposição mínima).
- **RN-8**: Recuperação de senha sempre retorna mensagem genérica "Se o email existir, enviamos as instruções" — independentemente do email existir ou não (Lei 9 — Enumeration prevention).
- **RN-9**: Sessão persiste por até **30 dias** via refresh token automático do Supabase. Após esse prazo, usuário precisa logar novamente.
- **RN-10**: Auto-logout por **inatividade de 4 horas**. Atividade é definida por: `mousemove`, `keydown`, `scroll`, `touchstart`, `click`, `focus`. Timer reseta a cada evento.
- **RN-11**: Ao detectar expiração de sessão (server response 401 ou inatividade), exibir modal "Sua sessão expirou" antes de redirecionar — preserva contexto e evita perda silenciosa de trabalho.
- **RN-12**: Logout manual destrói sessão local + revoga refresh token no Supabase + limpa `useAuthStore` + redireciona para `/login`.
- **RN-13**: Avatar deve ser: imagem (MIME `image/jpeg`, `image/png`, `image/webp`), validado por **magic bytes** (não apenas extensão), tamanho ≤ 2 MB. Reprocessado via `<canvas>` para remover EXIF/metadata (Lei 12).
- **RN-14**: Avatar é armazenado no Supabase Storage no bucket `avatars` no path `/{user_id}/avatar.{ext}`. RLS policy garante que apenas o próprio usuário pode escrever, e qualquer membro do mesmo household pode ler (após módulo 02).
- **RN-15**: Trigger `handle_new_user` (já existente em `docs/SCHEMA.md`) cria automaticamente um registro em `user_profiles` com `full_name` extraído de `raw_user_meta_data` na MESMA transação do INSERT em `auth.users` (Lei 8 — Atomicidade).
- **RN-16**: Avatar é uploadado em uma segunda etapa (após cadastro), porque depende de `auth.uid()` válido. Se falhar, cadastro permanece válido, apenas o avatar fica como `null` (graceful degradation).
- **RN-17**: Mensagens de erro do Supabase Auth são mapeadas para pt-BR via `auth-errors.ts` — nunca exibir mensagens em inglês ao usuário final.
- **RN-18**: Política de redirect: APENAS paths internos relativos são aceitos em `?redirectTo=`. Qualquer URL absoluta (com `http://` ou `//`) é descartada (prevenção de open redirect).
- **RN-19**: Acesso a rotas protegidas (`/dashboard`, `/bills`, etc.) sem sessão válida → redireciona para `/login?redirectTo=<path-original>`.
- **RN-20**: `useAuthStore` (Zustand) sincroniza automaticamente com `supabase.auth.onAuthStateChange()` — qualquer mudança de sessão (login, logout, refresh, expiração) atualiza o store globalmente.

---

## 🎯 Critérios de Aceite (Gherkin)

```gherkin
Funcionalidade: Cadastro de novo usuário

  Cenário AC-01: Cadastro com dados válidos
    Dado que Maria está em "/register"
    Quando ela preenche email "maria@exemplo.com"
    E preenche senha "Segura123" e confirmação "Segura123"
    E preenche nome "Maria Silva"
    E (opcionalmente) seleciona avatar "avatar.jpg" (1MB, image/jpeg)
    E clica em "Criar conta"
    Então a conta é criada no Supabase Auth
    E o trigger handle_new_user popula user_profiles com full_name "Maria Silva"
    E o avatar é enviado para "/avatars/{user_id}/avatar.jpg"
    E a sessão é iniciada automaticamente
    E ela é redirecionada para "/onboarding"

  Cenário AC-02: Rejeição com mensagens claras (validação)
    Dado que Maria está em "/register"
    Quando ela tenta submeter:
      | campo                | valor inválido        | mensagem esperada                                  |
      | email                | "naoeumemail"         | "Informe um email válido"                          |
      | email                | "ja@existe.com" (dup) | "Já existe uma conta com este email"               |
      | password             | "1234"                | "Senha deve ter ao menos 8 caracteres"             |
      | password             | "abcdefgh"            | "Senha deve conter ao menos uma letra e um número" |
      | passwordConfirmation | "Diferente1"          | "As senhas não conferem"                           |
      | fullName             | ""                    | "Nome é obrigatório"                               |
      | avatar               | "arquivo.exe (3MB)"   | "Arquivo não é uma imagem válida"                  |
      | avatar               | "imagem.jpg (3MB)"    | "Avatar deve ter no máximo 2MB"                    |
    Então a mensagem correspondente aparece inline no campo
    E o botão "Criar conta" permanece desabilitado enquanto houver erros

  Cenário AC-03: Trigger handle_new_user cria user_profiles
    Dado que Maria acabou de criar a conta com fullName "Maria Silva"
    Quando o INSERT em auth.users completa
    Então existe exatamente um registro em user_profiles com id = auth.users.id
    E user_profiles.full_name = "Maria Silva"
    E user_profiles.created_at é o mesmo timestamp do auth.users
    E ambas as inserções estão na mesma transação atômica

  Cenário AC-04: Pós-cadastro redireciona para /onboarding
    Dado que Maria acabou de cadastrar com sucesso
    Quando o cadastro retorna sessão válida
    Então useAuthStore é atualizado com user e session
    E ela é redirecionada para "/onboarding"
    E ainda NÃO existe registro em household_members para ela

Funcionalidade: Login

  Cenário AC-05: Login com credenciais válidas e household existente
    Dado que João já tem conta e pertence ao household "hh-Silva"
    Quando ele acessa "/login" e preenche email "joao@exemplo.com" + senha "Segura123"
    E clica em "Entrar"
    Então a sessão é estabelecida
    E useAuthStore é populado com user, session e householdId
    E ele é redirecionado para "/dashboard" (ou "/" no MVP)

  Cenário AC-06: Login com credenciais inválidas (mensagem genérica)
    Dado que Maria está em "/login"
    Quando ela tenta logar com:
      | email             | senha          |
      | inexistente@x.com | qualquer       |
      | maria@exemplo.com | senhaErrada123 |
    Então a mensagem "Email ou senha incorretos" é exibida (idêntica nos dois casos)
    E o erro NÃO revela qual campo está incorreto
    E o erro NÃO revela se o email existe na base

  Cenário AC-07: Login bloqueado após múltiplas tentativas (Supabase rate-limit)
    Dado que Maria errou a senha 5 vezes em sequência
    Quando ela tenta logar pela 6ª vez
    Então o Supabase retorna erro de rate-limit
    E a mensagem "Muitas tentativas. Tente novamente em alguns minutos." é exibida
    E o botão "Entrar" fica desabilitado por 60 segundos com countdown visual

Funcionalidade: Sessão persistente

  Cenário AC-08: Sessão persiste após reload do navegador
    Dado que João fez login e está em "/dashboard"
    Quando ele fecha a aba e reabre o app na URL "/"
    Então a sessão é restaurada automaticamente via supabase.auth.getSession()
    E useAuthStore é repopulado SEM exigir novo login
    E ele permanece em "/dashboard"

  Cenário AC-09: Auto-logout após 4h de inatividade
    Dado que João está logado e em "/expenses"
    E não há eventos de mouse, teclado, scroll ou touch há 4 horas
    Quando o useIdleTimer dispara
    Então um modal "Sua sessão expirou por inatividade" é exibido
    E ao clicar "OK", supabase.auth.signOut() é chamado
    E ele é redirecionado para "/login"
    E useAuthStore é resetado

  Cenário AC-10: Logout manual
    Dado que João está logado em qualquer rota protegida
    Quando ele clica no avatar > "Sair"
    Então supabase.auth.signOut() é chamado
    E useAuthStore é resetado para estado inicial
    E ele é redirecionado para "/login"
    E ao tentar voltar (botão back do navegador), é novamente bloqueado

Funcionalidade: Recuperação de senha

  Cenário AC-11: Solicitação de reset (mensagem genérica)
    Dado que Carlos está em "/forgot-password"
    Quando ele preenche email "carlos@exemplo.com" e clica "Enviar instruções"
    Então a mensagem "Se o email existir, enviamos as instruções" é exibida
    E NÃO é revelado se o email existe ou não na base
    E (se o email existe) o Supabase envia o email com link de reset

  Cenário AC-12: Reset de senha via link
    Dado que Carlos recebeu o email e clicou no link
    E foi levado para "/reset-password?token=..."
    Quando ele preenche nova senha "NovaSegura456" e confirmação "NovaSegura456"
    E clica "Salvar nova senha"
    Então a senha é atualizada no Supabase Auth
    E ele é redirecionado para "/login" com toast "Senha atualizada com sucesso"

Funcionalidade: Proteção de rotas e upload seguro

  Cenário AC-13: Acesso a rota protegida sem sessão
    Dado que não há sessão ativa
    Quando alguém acessa "/dashboard"
    Então é redirecionado para "/login?redirectTo=%2Fdashboard"
    E após login bem-sucedido, é redirecionado de volta para "/dashboard"

  Cenário AC-14: Upload de avatar com validação completa
    Dado que Maria está cadastrando e selecionou um arquivo
    Quando o arquivo é "malicioso.exe" renomeado para "avatar.jpg" (magic byte = MZ)
    Então o upload é REJEITADO antes de chegar ao Storage
    E a mensagem "Arquivo não é uma imagem válida" é exibida
    Quando o arquivo é "foto.png" de 1MB com magic byte válido
    Então é uploadado em "/avatars/{user_id}/avatar.png"
    E EXIF/metadata é removido (re-renderizado via canvas)
```

---

## 📥 Entrada/Saída

### Dados de Entrada

**Formulário de cadastro (`/register`)**
```
- email:                string, formato email, 1-254 chars, obrigatório
- password:             string, 8-72 chars, ≥1 letra + ≥1 número, obrigatório
- passwordConfirmation: string, deve ser idêntica a password, obrigatório
- fullName:             string, 1-100 chars, obrigatório
- avatar?:              File, MIME image/jpeg|png|webp, magic bytes válidos, ≤ 2MB, opcional
```

**Formulário de login (`/login`)**
```
- email:    string, formato email, obrigatório
- password: string, 1-72 chars, obrigatório
- rememberMe?: boolean (futuro — não no MVP)
```

**Formulário de recuperação (`/forgot-password`)**
```
- email: string, formato email, obrigatório
```

**Formulário de reset (`/reset-password`)**
```
- token:                string, da query string (vem do email do Supabase)
- newPassword:          string, 8-72 chars, ≥1 letra + ≥1 número, obrigatório
- newPasswordConfirmation: string, idêntica a newPassword, obrigatório
```

**Validação obrigatória (Zod)**
- Schemas em `src/features/auth/lib/auth-schemas.ts`
- `.strict()` para rejeitar campos extras (Lei 2)
- Mensagens em pt-BR

### Dados de Saída

**Para UI**
- Estado do `useAuthStore` (Zustand):
  ```ts
  {
    user: User | null,           // do Supabase Auth
    session: Session | null,     // do Supabase Auth
    householdId: string | null,  // de household_members (consultado após login)
    isAuthenticated: boolean,    // derivado de session
    isLoading: boolean,
  }
  ```
- Profile carregado em `useUserProfile()` (React Query) com: `id`, `full_name`, `avatar_url`.

**Para BD**
- Tabela `auth.users`: gerenciada 100% pelo Supabase Auth (INSERT no signUp, UPDATE em mudanças de senha).
- Tabela `user_profiles`: INSERT automático via trigger `handle_new_user` (mesma TX que `auth.users`).
- Tabela `user_settings`: **NÃO criada neste módulo** — será criada no módulo 02 (`household-onboarding`) quando o `household_id` for definido (FK obrigatória).
- Storage `avatars`: PUT em `/{user_id}/avatar.{ext}`, com policy `(storage.foldername(name))[1] = auth.uid()::text`.

**Side-effects**
- Trigger `handle_new_user`: cria `user_profiles` com `full_name` extraído de `raw_user_meta_data->>'full_name'`.
- Email do Supabase: enviado em `resetPasswordForEmail()` (template padrão pt-BR).

---

## 🔗 Dependências de Outros Módulos

- ❌ **Nenhuma dependência de módulo anterior** — este é o primeiro módulo da ordem fixa.

### Dependências de Infraestrutura (criadas pelo `supabase-engineer` no início do módulo)

- ✅ Migration `001_auth_and_profiles.sql`:
  - Helper functions: `set_updated_at()` (já documentada em SCHEMA.md)
  - Tabela `user_profiles` (já documentada em SCHEMA.md, linhas 177-215)
  - Trigger `handle_new_user()` (já documentada em SCHEMA.md, linhas 197-215)
  - RLS policies para `user_profiles`
  - **NÃO incluir** `user_settings` (depende de `households` que vem no módulo 02)
- ✅ Bucket Storage `avatars` com policy:
  ```sql
  -- Apenas o próprio usuário escreve em sua pasta
  create policy "avatars_user_write"
    on storage.objects for insert
    with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Qualquer autenticado lê (será restringido por household no módulo 02)
  create policy "avatars_authenticated_read"
    on storage.objects for select
    using (bucket_id = 'avatars' and auth.role() = 'authenticated');
  ```
- ✅ Configuração Supabase Auth (via Dashboard ou `supabase/config.toml`):
  - Email confirmations: **OFF** (MVP)
  - JWT expiry: 3600s (1h, padrão)
  - Refresh token rotation: ON, max age 30 dias
  - Password requirements: min 8 chars (validação extra via Zod no frontend)
  - Site URL: `http://localhost:5173` (dev) / produção quando deploy

### Modules que dependem deste

- 🔜 Módulo 02 (`household-onboarding`): consome `useAuthStore` e exige sessão ativa.
- 🔜 Todos os módulos seguintes (03-15): exigem rota protegida e `auth.uid()` válido.

---

## 📝 Fora de Escopo

- ❌ **Criação ou vinculação de household** → módulo 02 (`household-onboarding`)
- ❌ **Validação/consumo de invite_code** → módulo 02
- ❌ **Alternância Pessoal ↔ Casal no header** → módulo 02 ou 09
- ❌ **Tela de gerenciamento de household** (membros, regenerar invite) → módulo 02
- ❌ **OAuth (Google, GitHub, Apple)** → módulo futuro (não no MVP)
- ❌ **Magic link / Passwordless login** → módulo futuro
- ❌ **2FA / MFA** → módulo 15 (`security-and-compliance`)
- ❌ **Confirmação de email obrigatória** → desabilitada no MVP por decisão explícita; pode ser ativada em módulo futuro
- ❌ **Tela de edição de perfil completa** (mudar nome, avatar depois do cadastro) → módulo futuro de "Configurações de perfil"
- ❌ **Mudança de email** → módulo futuro
- ❌ **Exclusão de conta (LGPD)** → módulo 15 (`security-and-compliance`)
- ❌ **Auditoria de logins / histórico de sessões** → módulo 15
- ❌ **Customização do email template do Supabase** → módulo de UX/marca futuro
- ❌ **Criação de `user_settings`** (depende de household_id, vai para módulo 02)
- ❌ **Criação de `widget_preferences`** (depende de household_id, vai para módulo 09)

---

## 🏗️ Sugestão de Estrutura de Arquivos

```
src/features/auth/
├── components/
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── ForgotPasswordForm.tsx
│   ├── ResetPasswordForm.tsx
│   ├── AvatarUpload.tsx          # Input file + preview + crop básico
│   ├── SessionExpiredModal.tsx   # Modal exibido quando sessão expira
│   ├── ProtectedRoute.tsx        # Wrapper de rota protegida
│   └── PasswordStrengthMeter.tsx # Visual feedback de força da senha
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   └── AuthCallbackPage.tsx      # Recebe redirect do Supabase (reset, etc)
├── hooks/
│   ├── useLogin.ts               # React Query mutation
│   ├── useRegister.ts            # React Query mutation + upload avatar
│   ├── useLogout.ts              # mutation + cleanup
│   ├── useResetPassword.ts       # 2 fases: request + confirm
│   ├── useIdleTimer.ts           # Detecta inatividade (4h default)
│   └── useUserProfile.ts         # React Query do user_profiles
├── lib/
│   ├── auth-schemas.ts           # Zod schemas (register, login, reset, etc)
│   ├── avatar-validation.ts      # Magic bytes + size + EXIF strip via canvas
│   ├── auth-errors.ts            # Mapeamento de erros Supabase → pt-BR
│   └── safe-redirect.ts          # Sanitiza ?redirectTo= (open redirect prevention)
└── index.ts                      # Re-exports

src/stores/
└── useAuthStore.ts               # Zustand: user, session, householdId, isAuthenticated

src/components/shared/
├── UserAvatar.tsx                # Avatar com fallback de iniciais
└── PageLoadingSpinner.tsx        # Spinner full-page (usado em ProtectedRoute)

src/lib/
└── supabase.ts                   # Cliente Supabase (singleton)

src/router/
└── routes.tsx                    # Configuração React Router v7 + ProtectedRoute

supabase/migrations/
└── 20260419000001_auth_and_profiles.sql

tests/e2e/auth/
├── register.spec.ts
├── login.spec.ts
├── logout.spec.ts
├── reset-password.spec.ts
├── session-persistence.spec.ts
└── protected-routes.spec.ts
```

---

## 🎨 Diretrizes de UI/UX (do `.impeccable.md`)

- **Personalidade**: Calma, clara, honesta. Mensagens de erro são humanas e acionáveis (ex: "Senha precisa de pelo menos uma letra e um número" em vez de "Invalid password format").
- **Layout**: Cards centralizados, max-width 400px nos formulários. Espaços em branco generosos.
- **Tipografia**: Hierarquia clara — H1 do form (32px), labels (14px), help text (12px), error text (12px com cor de erro).
- **Feedback**: Botões com estados de loading explícitos (spinner inline, texto "Entrando…"). Toasts para sucesso/erro de operações assíncronas.
- **Acessibilidade**: WCAG AA mínimo. Todos os inputs com `<label>` associado, `aria-invalid`, `aria-describedby` para erros. Foco visível. Navegação por teclado completa.
- **Tema**: Light mode primário no MVP. Dark mode usa tokens já definidos no Tailwind v4 + shadcn/ui.
- **Sem "vibes coding"**: zero números mágicos. Constantes em `src/features/auth/lib/constants.ts` (`SESSION_TIMEOUT_MS`, `MAX_AVATAR_SIZE_BYTES`, etc.).

---

## 📊 Métricas de Sucesso

- ✅ Todos os 14 critérios Gherkin transformados em testes RED → GREEN.
- ✅ Cobertura de testes ≥ **80%** (statements + branches) em `src/features/auth/` e `src/stores/useAuthStore.ts`.
- ✅ `/sec-audit 01-auth-and-session` retorna scorecard ≥ **B** (zero CRÍTICAS, zero ALTAS).
- ✅ Pelo menos **6 happy-paths E2E (Playwright)** + **4 sad-paths** (credenciais inválidas, email duplicado, avatar inválido, redirect malicioso).
- ✅ **Lighthouse Accessibility ≥ 95** nas 4 páginas (`/login`, `/register`, `/forgot-password`, `/reset-password`).
- ✅ **Performance**: LCP ≤ 1.5s em `/login` (página mais acessada).
- ✅ Zero anti-padrões de Vibe Coding (A1-A10) detectados pelo `qa-validator`.
- ✅ `pnpm audit --prod` sem vulnerabilidades críticas/altas.
- ✅ Bundle size do feature `auth`: ≤ 60 KB gzipped.

---

## 🧭 Referências cruzadas

- 📋 Requisitos: [docs/REQUIREMENTS.md, linhas 7-14](../../../docs/REQUIREMENTS.md)
- 🏗️ Stack: [docs/STACK.md, seção "Fluxo de Autenticação no Frontend"](../../../docs/STACK.md)
- 🗄️ Schema: [docs/SCHEMA.md, tabelas `user_profiles` + trigger `handle_new_user`](../../../docs/SCHEMA.md)
- 🔐 Segurança: [docs/SECURITY.md, 15 Leis](../../../docs/SECURITY.md) → ver `security.md` deste módulo
- 📜 Constituição: [specs/_constitution.md](../../_constitution.md)
- 🔄 Fluxo TDD: [specs/_tdd-flow.md](../../_tdd-flow.md)
