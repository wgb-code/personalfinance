# Checklist TDD: Módulo 02-household-onboarding

> **Status**: ✅ Pronto para execução (`/module-start`)
> **Total de critérios**: 28 (AC-01 a AC-28, incluindo sub-cenários `.1`)
> **Concluídos**: 0 (0%)
> **Em andamento**: 0
> **Pendentes**: 28
> **Spec relacionado**: [spec.md](./spec.md)
> **Audit de segurança**: [security.md](./security.md)
> **Última atualização**: 2026-04-21 (round 2 — ajustes pós `/spec-review`)

---

## Ordem de Implementação

A ordem abaixo respeita dependências técnicas:

0. **Infra de teste de integração Supabase** (pré-requisito): seed helpers, reset DB, auth fixtures (tasks T-INFRA-*)
1. **Migration + RLS + RPCs** (AC-00 infra): infraestrutura de banco + RPCs SECURITY DEFINER
2. **Helper `get_user_household_id()` + `get_current_household()`**: base de RLS + bootstrap
3. **`useAuthStore.setHouseholdId()`** (RN-28): setter controlado antes das mutations
4. **`useCurrentHousehold` + integração com `AuthBootstrap`** (RN-28.1)
5. **Create Household** (AC-01, AC-02): fluxo principal
6. **Invite Code** (AC-03, AC-04, AC-05): geração e regeneração
7. **Join Household** (AC-06, AC-07, AC-08, AC-08.1): entrada via código
8. **Skip Onboarding** (AC-09): fluxo alternativo
9. **Members List** (AC-10): visualização
10. **Leave/Remove** (AC-11, AC-12): ações de saída + invalidação de cache (RN-22.1)
11. **Store & Redirect** (AC-13, AC-14, AC-14.1): integração com Zustand + loading state
12. **Audit Trail** (AC-15 a AC-19): histórico
13. **Re-entry + Concorrência + Rate Limit** (AC-20 a AC-24) — inclui GC de buckets
14. **Edge Cases de Owner Delete** (AC-25, AC-26) — com `FOR UPDATE`
15. **Clipboard UX** (AC-27, AC-27.1): copiar código + fallback
16. **Compat Módulo 01** (AC-28, AC-28.1): users pré-existentes
17. **E2E Tests**: validação completa

---

## Tarefas de Infraestrutura (T-INFRA-*)

### T-INFRA-1: Seed helpers para testes de integração Supabase

- [ ] Criar `tests/integration/helpers/seed.ts` com:
  - `seedUser(email, password)` → retorna `{ userId, session }`
  - `seedHousehold(ownerEmail)` → retorna `{ householdId, inviteCode, ownerId }`
  - `seedMember(householdId, memberEmail)` → retorna `{ memberId }`
  - `loginAs(email)` → autentica client Supabase para chamadas subsequentes
- [ ] Criar `tests/integration/helpers/reset-db.ts` para truncar tabelas entre testes (respeita FKs).
- [ ] Adicionar script `pnpm test:integration` em `package.json` que sobe Supabase local (via `supabase start`) e roda Vitest com config específica (sem jsdom, `testTimeout: 30s`).

**Evidence**:
- `tests/integration/helpers/seed.ts`, `reset-db.ts`
- `package.json` com script `test:integration`
- `vitest.integration.config.ts`

---

### T-INFRA-2: Setter controlado `setHouseholdId` no `useAuthStore`

- [ ] **RED**: Teste em `src/stores/__tests__/useAuthStore.test.tsx` — `setHouseholdId(uuid)` atualiza apenas `householdId`; `setHouseholdId(null)` reseta só esse slot; `reset()` continua zerando todos os campos.
- [ ] **GREEN**: Adicionar `setHouseholdId` ao interface `AuthState` e à factory do store.
- [ ] **REFACTOR**: Documentar no JSDoc que este é o **único** caminho legítimo para mutar `householdId`.
- [ ] **SECURITY**: Garantir que o valor só é aceito como `string | null` (tipagem TS); runtime não valida UUID (confiamos no retorno do RPC `get_current_household`).

**Evidence**:
- `src/stores/useAuthStore.ts` (novo setter)
- `src/stores/__tests__/useAuthStore.test.tsx` (casos do setter)

---

## Tarefas (uma por critério Gherkin)

### 1-AC-01: Criar household com nome válido

- [ ] **RED**: Teste em `src/features/onboarding/components/__tests__/CreateHouseholdForm.test.tsx` — form renderiza, submit chama mutation, success redireciona.
- [ ] **GREEN**: `CreateHouseholdForm.tsx` funcional, chama `useCreateHousehold()` que executa RPC `create_household`.
- [ ] **REFACTOR**: Integra React Query mutation, Zod schema, error mapping pt-BR, loading state. Cobertura ≥ 80%.
- [ ] **SECURITY**: Verificado que (a) `owner_id` vem de `auth.uid()` no RPC, não do body, (b) nome é sanitizado, (c) audit `joined` é inserido na mesma TX.

**Evidence**:
- Test: `src/features/onboarding/components/__tests__/CreateHouseholdForm.test.tsx`
- Impl: `src/features/onboarding/components/CreateHouseholdForm.tsx` + `src/features/onboarding/hooks/useCreateHousehold.ts`
- DB: RPC `create_household` com `security definer`
- Sec: `owner_id = auth.uid()` no RPC, nunca aceita do client

---

### 2-AC-02: Rejeitar criação com nome inválido

- [ ] **RED**: Teste em `CreateHouseholdForm.test.tsx` — valida mensagens de erro para nome vazio, só espaços, > 100 chars.
- [ ] **GREEN**: Validação inline com Zod via `zodResolver`. Mensagens em pt-BR.
- [ ] **REFACTOR**: Schema em `onboarding-schemas.ts` com `.trim()` + `.min(1)` + `.max(100)`.
- [ ] **SECURITY**: Schema com `.strict()` rejeita campos extras (Lei 2).

**Evidence**:
- Test: `src/features/onboarding/components/__tests__/CreateHouseholdForm.test.tsx`
- Schema: `src/features/onboarding/lib/onboarding-schemas.ts`

---

### 3-AC-03: Gerar invite code ao criar household

- [ ] **RED**: Teste em `src/features/household/components/__tests__/InviteCodeDisplay.test.tsx` — exibe código, data de expiração no formato canônico (RN-34.1) `Válido até dd/MM/yyyy 'às' HH:mm`, sub-linha relativa "(em ~Xh)", botões Copiar/Regenerar.
- [ ] **GREEN**: Componente renderiza dados do household (código + expires_at) usando helpers `formatShortDate` e `formatRelativeExpiry` em `src/features/household/lib/date-format.ts`.
- [ ] **REFACTOR**: Testes cobrem timezone local vs UTC (mock `Intl.DateTimeFormat`).
- [ ] **SECURITY**: Código não é logado em console/storage, apenas exibido na UI.

**Evidence**:
- Test: `src/features/household/components/__tests__/InviteCodeDisplay.test.tsx`
- Impl: `src/features/household/components/InviteCodeDisplay.tsx` + `src/features/household/lib/date-format.ts`

---

### 4-AC-04: Regenerar invite code (owner only)

- [ ] **RED**: Teste em `src/features/household/hooks/__tests__/useRegenerateInviteCode.test.tsx` — mutation chama RPC, invalida query, exibe novo código.
- [ ] **GREEN**: RPC `regenerate_invite_code` atualiza código e expires_at.
- [ ] **REFACTOR**: Modal de confirmação antes de regenerar, toast de sucesso.
- [ ] **SECURITY**: RPC verifica `auth.uid() = household.owner_id` antes de permitir (Lei 6).

**Evidence**:
- Test: `src/features/household/hooks/__tests__/useRegenerateInviteCode.test.tsx`
- Impl: `useRegenerateInviteCode.ts` + `RegenerateCodeButton.tsx`
- DB: RPC com check `if auth.uid() != owner_id then raise`

---

### 5-AC-05: Código expira após 48h

- [ ] **RED**: Teste de integração — tenta join com código expirado, recebe erro.
- [ ] **GREEN**: RPC `join_household` verifica `invite_code_expires_at > now()`.
- [ ] **REFACTOR**: Mensagem de erro genérica (não revela se expirou vs não existe).
- [ ] **SECURITY**: Lei 9 — não revelar informação sobre existência/estado do código.

**Evidence**:
- Test: `src/features/onboarding/hooks/__tests__/useJoinHousehold.test.tsx` (caso expirado)
- DB: RPC `join_household` com check de expiração

---

### 6-AC-06: Join com código válido

- [ ] **RED**: Teste em `src/features/onboarding/components/__tests__/JoinHouseholdForm.test.tsx` — submit com código válido redireciona.
- [ ] **GREEN**: `JoinHouseholdForm.tsx` chama `useJoinHousehold()`, sucesso popula store e redireciona.
- [ ] **REFACTOR**: Input uppercase automático, validação de formato (6 chars), loading state.
- [ ] **SECURITY**: (a) user_id de `auth.uid()`, (b) audit `joined` inserido, (c) código não logado.

**Evidence**:
- Test: `src/features/onboarding/components/__tests__/JoinHouseholdForm.test.tsx`
- Impl: `JoinHouseholdForm.tsx` + `useJoinHousehold.ts`
- DB: RPC `join_household` com audit insert

---

### 7-AC-07: Rejeitar código inválido ou expirado

- [ ] **RED**: Teste em `JoinHouseholdForm.test.tsx` — código inexistente e código expirado retornam mesma mensagem.
- [ ] **GREEN**: RPC retorna erro genérico, UI exibe "Código inválido ou expirado".
- [ ] **REFACTOR**: Error mapping em `onboarding-errors.ts`.
- [ ] **SECURITY**: Lei 9 — mensagem idêntica para qualquer falha (enumeration prevention).

**Evidence**:
- Test: `src/features/onboarding/components/__tests__/JoinHouseholdForm.test.tsx`
- Impl: `src/features/onboarding/lib/onboarding-errors.ts`

---

### 8-AC-08: Rejeitar se já pertence a household

- [ ] **RED**: Teste em `OnboardingPage.test.tsx` — se `householdId` presente, redireciona para `/dashboard`.
- [ ] **GREEN**: `OnboardingPage.tsx` verifica `useAuthStore.householdId` no mount.
- [ ] **REFACTOR**: Usar `useEffect` + `navigate` ou `loader` do React Router.
- [ ] **SECURITY**: RPC também valida server-side (usuário ativo em household = rejeita join).

**Evidence**:
- Test: `src/features/onboarding/components/__tests__/OnboardingPage.test.tsx`
- Impl: `OnboardingPage.tsx` com redirect condicional

---

### 9-AC-09: Pular cria household solo

- [ ] **RED**: Teste em `src/features/onboarding/hooks/__tests__/useSkipOnboarding.test.tsx` — cria household "Meu Lar", usuário é owner.
- [ ] **GREEN**: `useSkipOnboarding()` chama `create_household` com nome fixo.
- [ ] **REFACTOR**: Link "Pular por enquanto" estilizado como secundário, confirmação opcional.
- [ ] **SECURITY**: Mesmo fluxo de create (audit inserido, RLS aplicada).

**Evidence**:
- Test: `src/features/onboarding/hooks/__tests__/useSkipOnboarding.test.tsx`
- Impl: `useSkipOnboarding.ts`

---

### 10-AC-10: Listar membros do household

- [ ] **RED**: Teste em `src/features/household/components/__tests__/MembersList.test.tsx` — renderiza lista com roles, status, ações.
- [ ] **GREEN**: Query `household_members` com join em `user_profiles` para nome.
- [ ] **REFACTOR**: Badges de status (ativo/inativo), botão "Remover" condicional (só para owner, só em members ativos).
- [ ] **SECURITY**: RLS garante que só members do household veem a lista.

**Evidence**:
- Test: `src/features/household/components/__tests__/MembersList.test.tsx`
- Impl: `MembersList.tsx` + `useHouseholdMembers.ts`
- RLS: `using (household_id = get_user_household_id())`

---

### 11-AC-11: Member sai voluntariamente

- [ ] **RED**: Teste em `src/features/household/hooks/__tests__/useLeaveHousehold.test.tsx` — soft delete, `setHouseholdId(null)`, `queryClient.removeQueries` chamado para household-dependent keys, redirect para `/onboarding`.
- [ ] **GREEN**: RPC `leave_household` atualiza `left_at`, insere audit `left`.
- [ ] **REFACTOR**: Modal de confirmação, toast de sucesso, helper `clearHouseholdQueries(queryClient)` reutilizável.
- [ ] **SECURITY**: (a) RPC só permite member sair de si mesmo, (b) owner não pode sair se há outros ativos (erro `OWNER_HAS_ACTIVE_MEMBERS`), (c) sessão continua ativa (não é logout — RN-22.1).

**Evidence**:
- Test: `src/features/household/hooks/__tests__/useLeaveHousehold.test.tsx`
- Impl: `useLeaveHousehold.ts` + `LeaveHouseholdButton.tsx` + `clearHouseholdQueries()` helper
- DB: RPC `leave_household` com checks de autorização

---

### 12-AC-12: Owner remove member

- [ ] **RED**: Teste em `src/features/household/hooks/__tests__/useRemoveMember.test.tsx` — soft delete do target, audit com performer, cache do Maria invalida `household-members`/`household-audit`, **não** altera `householdId` do Maria.
- [ ] **GREEN**: RPC `remove_member` verifica owner, atualiza `left_at`, insere audit `removed`.
- [ ] **REFACTOR**: Modal de confirmação com nome do member, toast de sucesso.
- [ ] **SECURITY**: (a) Só owner pode remover (erro `NOT_OWNER`), (b) não pode remover a si mesmo (erro `CANNOT_REMOVE_SELF`), (c) audit registra `performed_by = auth.uid()` do owner, (d) target perde acesso no próximo request via RLS.

**Evidence**:
- Test: `src/features/household/hooks/__tests__/useRemoveMember.test.tsx`
- Impl: `useRemoveMember.ts`
- DB: RPC com `if caller != owner_id then raise`

---

### 13-AC-13: Popular householdId no store após create/join (via setter controlado)

- [ ] **RED**: Teste em `useCreateHousehold.test.tsx` (e análogos para join/skip) — após `onSuccess`, `useAuthStore.getState().householdId === data.household_id`.
- [ ] **GREEN**: Mutation `onSuccess` chama `setHouseholdId(data.household_id)` **e** `queryClient.invalidateQueries({ queryKey: ['current-household'] })`.
- [ ] **REFACTOR**: Extrair `useOnboardingSuccess()` como helper partilhado entre create/join/skip.
- [ ] **SECURITY**: **NÃO usar** `useAuthStore.setState(...)` direto (Lei 2). Lint rule opcional em `src/features/onboarding/**` bane `.setState`.

**Evidence**:
- Test: `src/features/onboarding/hooks/__tests__/*.test.tsx`
- Impl: `useOnboardingSuccess.ts` + mutations usando setter controlado

---

### 13.1-AC-13 (bootstrap): `useCurrentHousehold` + `AuthBootstrap` integrados

- [ ] **RED**: Teste em `src/features/household/hooks/__tests__/useCurrentHousehold.test.tsx` — query chama RPC `get_current_household`, retorna `{ household_id, name, role }`.
- [ ] **RED**: Teste em `AuthBootstrap.test.tsx` — após `setSession(session)`, `useCurrentHousehold` é disparada e no `onSuccess` chama `setHouseholdId(...)` com `household_id` (pode ser `null`).
- [ ] **GREEN**: Integrar `useCurrentHousehold` no `AuthBootstrap` logo após `useInitAuth`.
- [ ] **REFACTOR**: Garantir que, enquanto `isLoading`, `isInitializing` no render efetivo continua `true` até sabermos `householdId`.
- [ ] **SECURITY**: RPC `get_current_household` retorna `null` se user não tem household, nunca lança erro.

**Evidence**:
- Test: `src/features/household/hooks/__tests__/useCurrentHousehold.test.tsx`
- Test: `src/features/auth/components/__tests__/AuthBootstrap.test.tsx` (novos casos)
- Impl: `useCurrentHousehold.ts`, `AuthBootstrap.tsx` atualizado

---

### 14-AC-14: Redirect correto baseado em household

- [ ] **RED**: Teste em `src/features/auth/components/ProtectedRoute.test.tsx` — se `householdId` null e rota requer, redireciona para `/onboarding`.
- [ ] **GREEN**: `ProtectedRoute` aceita prop `requiresHousehold` (default `true`).
- [ ] **REFACTOR**: Rotas `/onboarding` marcam `requiresHousehold={false}`.
- [ ] **SECURITY**: Verificação server-side também (RLS nega queries se sem household).

**Evidence**:
- Test: `src/features/auth/components/ProtectedRoute.test.tsx` (novos casos)
- Impl: `ProtectedRoute.tsx` atualizado + `src/router/routes.tsx` atualizado

---

### 14.1-AC-14.1: Evitar flash de onboarding durante loading

- [ ] **RED**: Teste em `ProtectedRoute.test.tsx` — com `isAuthenticated=true`, `householdId=null`, `useCurrentHousehold.isLoading=true`, renderiza loading (não redireciona).
- [ ] **GREEN**: `ProtectedRoute` lê status da query `current-household` e trata `isLoading` como estado de espera.
- [ ] **REFACTOR**: Unificar com o estado `isInitializing` existente (possivelmente via `useBootstrapStatus()` helper).
- [ ] **SECURITY**: Nenhum leak de rota durante loading (o conteúdo protegido ainda não monta).

**Evidence**:
- Test: `ProtectedRoute.test.tsx` (caso loading)
- Impl: `ProtectedRoute.tsx`

---

### 15-AC-15: Registrar audit quando member entra

- [ ] **RED**: Teste de integração — após join, `household_member_audit` tem registro com action `joined`.
- [ ] **GREEN**: RPC `join_household` insere audit na mesma TX.
- [ ] **REFACTOR**: Helper `insert_membership_audit()` reutilizável.
- [ ] **SECURITY**: (a) Audit imutável (sem UPDATE/DELETE policy), (b) performed_by = auth.uid().

**Evidence**:
- Test: Integração com Supabase (verificar tabela após join)
- DB: RPC com INSERT em `household_member_audit`

---

### 16-AC-16: Registrar audit quando member sai

- [ ] **RED**: Teste de integração — após leave, audit tem registro com action `left`.
- [ ] **GREEN**: RPC `leave_household` insere audit na mesma TX.
- [ ] **REFACTOR**: Mesma helper `insert_membership_audit()`.
- [ ] **SECURITY**: performed_by = auth.uid() (quem saiu).

**Evidence**:
- Test: Integração com Supabase
- DB: RPC `leave_household`

---

### 17-AC-17: Registrar audit quando owner remove

- [ ] **RED**: Teste de integração — após remove, audit tem registro com action `removed` e performed_by = owner.
- [ ] **GREEN**: RPC `remove_member` insere audit na mesma TX.
- [ ] **REFACTOR**: Mesma helper.
- [ ] **SECURITY**: performed_by = owner (não o removido).

**Evidence**:
- Test: Integração com Supabase
- DB: RPC `remove_member`

---

### 18-AC-18: Owner visualiza histórico de audit

- [ ] **RED**: Teste em `src/features/household/components/__tests__/AuditHistory.test.tsx` — renderiza timeline com ações.
- [ ] **GREEN**: Query `household_member_audit` com joins para nomes.
- [ ] **REFACTOR**: Formatação legível ("João entrou no household"), ícones por tipo, ordenação desc.
- [ ] **SECURITY**: RLS permite SELECT apenas para owner do household.

**Evidence**:
- Test: `src/features/household/components/__tests__/AuditHistory.test.tsx`
- Impl: `AuditHistory.tsx` + `useHouseholdAudit.ts`
- RLS: `using (household_id = get_user_household_id() AND auth.uid() = (SELECT owner_id FROM households WHERE id = household_id))`

---

### 19-AC-19: Member não pode ver audit

- [ ] **RED**: Teste em `AuditHistory.test.tsx` — member recebe lista vazia ou 403.
- [ ] **GREEN**: RLS nega SELECT para non-owners.
- [ ] **REFACTOR**: UI não exibe link "Histórico" para members.
- [ ] **SECURITY**: Double check: client + server (RLS).

**Evidence**:
- Test: `src/features/household/components/__tests__/AuditHistory.test.tsx` (caso member)
- RLS: Policy de audit com owner check

---

### 20-AC-20: Usuário que saiu pode re-entrar com novo código

- [ ] **RED**: Teste de integração em `useJoinHousehold.test.tsx` cobrindo saída + novo join.
- [ ] **GREEN**: `join_household` cria novo vínculo ativo após `left_at` preenchido no vínculo anterior.
- [ ] **REFACTOR**: Garantir que listagem de membros traz apenas vínculo ativo; histórico fica no audit.
- [ ] **SECURITY**: Constraint de 1 membership ativo por usuário evita dupla associação ativa.

**Evidence**:
- Test: `src/features/onboarding/hooks/__tests__/useJoinHousehold.test.tsx` (caso re-entry)
- DB: índice parcial único por `user_id where left_at is null`

---

### 21-AC-21: Histórico de re-entry preservado

- [ ] **RED**: Teste em `AuditHistory.test.tsx` valida sequência "joined -> left -> joined".
- [ ] **GREEN**: Eventos de audit são inseridos em todas as transições de membership.
- [ ] **REFACTOR**: Timeline ordenada por `performed_at desc` com descrição legível.
- [ ] **SECURITY**: Audit permanece imutável (sem UPDATE/DELETE policy).

**Evidence**:
- Test: `src/features/household/components/__tests__/AuditHistory.test.tsx` (caso re-entry)
- DB: `household_member_audit` sem policies de UPDATE/DELETE

---

### 22-AC-22: Múltiplos usuários podem entrar com mesmo código (concorrência)

- [ ] **RED**: Teste de integração com `Promise.allSettled` para dois usuários em paralelo.
- [ ] **GREEN**: Ambos joins com mesmo código válido funcionam sem corrida de estado.
- [ ] **REFACTOR**: Garantir idempotência por usuário (se já ativo, join deve falhar com erro de negócio).
- [ ] **SECURITY**: Não permitir dois vínculos ativos para o mesmo usuário.

**Evidence**:
- Test: integração `join_household` concorrente
- DB: índice parcial de membership ativo por usuário

---

### 23-AC-23: Bloquear após 5 tentativas de join por minuto

- [ ] **RED**: Teste de integração em `useJoinHousehold.test.tsx` para 6ª tentativa retornar 429.
- [ ] **GREEN**: RPC aplica contador por `user_id + window_bucket` em `join_rate_limits`.
- [ ] **REFACTOR**: Error mapping consistente para "Muitas tentativas. Aguarde 1 minuto."
- [ ] **SECURITY**: Bloqueio anti brute-force sem leak de existência do código.

**Evidence**:
- Test: integração com 6 tentativas no mesmo minuto
- DB: `join_rate_limits` com `unique(user_id, window_bucket)`

---

### 24-AC-24: Rate limit reseta após 1 minuto

- [ ] **RED**: Teste de integração avança janela e valida nova tentativa com sucesso.
- [ ] **GREEN**: RPC recalcula janela por minuto (`date_trunc('minute', now())`).
- [ ] **REFACTOR**: Encapsular lógica de janela em helper SQL para reuso.
- [ ] **SECURITY**: Não carregar contadores antigos para janelas novas.

**Evidence**:
- Test: integração com troca de janela de 1 minuto
- DB: coluna `window_bucket` usada no upsert/increment

---

### 25-AC-25: Owner não pode deletar conta com membros ativos

- [ ] **RED**: Teste de integração para deleção de owner com membros ativos falhar.
- [ ] **GREEN**: Trigger `before_user_delete` bloqueia deleção com mensagem de domínio.
- [ ] **REFACTOR**: UI traduz erro técnico para mensagem amigável.
- [ ] **SECURITY**: Regra impedida no banco (não só no client).

**Evidence**:
- Test: integração em fluxo de delete de conta
- DB: trigger `before_user_delete` + `handle_owner_delete()`

---

### 26-AC-26: Owner solo pode deletar conta (cascade)

- [ ] **RED**: Teste de integração para owner solo deletar conta e household ser removido.
- [ ] **GREEN**: Trigger remove household e dados relacionados em cascata.
- [ ] **REFACTOR**: Documentar side-effects (members/audit) no teste.
- [ ] **SECURITY**: Garantir que não há órfãos após cascade.

**Evidence**:
- Test: integração de deleção de owner solo
- DB: `ON DELETE CASCADE` + trigger validado

---

### 27-AC-27: Copiar invite code com clipboard API

- [ ] **RED**: Teste em `src/features/household/components/__tests__/CopyCodeButton.test.tsx` — clicar no botão chama `navigator.clipboard.writeText(code)`, label muda para "Copiado!" por 2s, volta ao original depois.
- [ ] **GREEN**: Componente `CopyCodeButton` com estado local `isCopied` + `setTimeout` de 2s.
- [ ] **REFACTOR**: Extrair helper `useCopyToClipboard()` se reusado em outros módulos.
- [ ] **SECURITY**: Teste adicional que confirma que nenhum `console.log`/`console.info` é chamado com o código (Lei 14).

**Evidence**:
- Test: `src/features/household/components/__tests__/CopyCodeButton.test.tsx`
- Impl: `CopyCodeButton.tsx`

---

### 27.1-AC-27.1: Fallback sem clipboard API

- [ ] **RED**: Teste em `CopyCodeButton.test.tsx` — com `navigator.clipboard === undefined`, o botão revela um `<input readOnly>` pré-selecionado e instrução "Pressione Ctrl+C / Cmd+C".
- [ ] **GREEN**: Branch de fallback usando `<input readOnly ref>` + `.select()`.
- [ ] **REFACTOR**: A11y — `aria-live="polite"` na mudança de estado; input tem `aria-label`.
- [ ] **SECURITY**: Nenhum vazamento de código via URL ou localStorage.

**Evidence**:
- Test: `CopyCodeButton.test.tsx` (caso sem clipboard)
- Impl: `CopyCodeButton.tsx`

---

### 28-AC-28: Usuário do módulo 01 sem household acessa /onboarding

- [ ] **RED**: Teste de integração — seed usuário do módulo 01 (sem `household_members`), login, chama `get_current_household()`, verifica retorno `{ household_id: null, ... }` e que `user_profiles_select_own_or_household` ainda permite self-select.
- [ ] **GREEN**: RPC `get_current_household` retorna slots nullable sem erro. RLS expandida de `user_profiles` é correta.
- [ ] **REFACTOR**: Teste adicional com 10 users legados + 3 novos com household — cross-checks RLS.
- [ ] **SECURITY**: Usuário legado não consegue ver perfis de outros users (sem household = só vê o próprio).

**Evidence**:
- Test: `tests/integration/compat-module-01.test.ts`
- DB: RPC `get_current_household` + RLS expandida

---

### 28.1-AC-28.1: Migration não quebra user_profiles existentes

- [ ] **RED**: Teste SQL que confirma (a) user_profiles intacto após migration, (b) coluna `household_id` **NÃO** foi adicionada, (c) policies antigas foram substituídas sem perda de acesso.
- [ ] **GREEN**: Migration usa `DROP POLICY IF EXISTS` + `CREATE POLICY` para `user_profiles_select_*`.
- [ ] **REFACTOR**: `COMMENT ON COLUMN` em `user_profiles` documenta ADR de não-denormalização.
- [ ] **SECURITY**: Nenhum usuário pré-existente fica sem acesso ao próprio perfil após migration.

**Evidence**:
- Test: teste de integração que simula base pré-módulo-02 e aplica migration 02
- DB: migration idempotente com `DROP/CREATE POLICY`

---

## Tarefas E2E

### E2E-01: Happy path - Criar household

- [ ] **E2E**: `tests/e2e/onboarding/create-household.spec.ts`
  - Cadastrar usuário novo
  - Acessar `/onboarding`
  - Preencher nome "Casa Teste"
  - Clicar "Criar"
  - Verificar redirect para `/dashboard`
  - Verificar que header mostra "Casa Teste"

---

### E2E-02: Happy path - Join via código

- [ ] **E2E**: `tests/e2e/onboarding/join-household.spec.ts`
  - Criar household com usuário A
  - Copiar código
  - Cadastrar usuário B
  - Acessar `/onboarding`
  - Colar código
  - Verificar redirect para `/dashboard`
  - Verificar que ambos veem o mesmo household

---

### E2E-03: Happy path - Pular onboarding

- [ ] **E2E**: `tests/e2e/onboarding/skip-onboarding.spec.ts`
  - Cadastrar usuário
  - Clicar "Pular por enquanto"
  - Verificar household "Meu Lar" criado
  - Verificar redirect para `/dashboard`

---

### E2E-04: Happy path - Regenerar código

- [ ] **E2E**: `tests/e2e/onboarding/regenerate-code.spec.ts`
  - Criar household
  - Anotar código original
  - Clicar "Regenerar"
  - Verificar que código mudou
  - Verificar que código antigo não funciona (com outro usuário)

---

### E2E-05: Happy path - Visualizar audit

- [ ] **E2E**: `tests/e2e/onboarding/audit-history.spec.ts`
  - Criar household com Maria
  - João entra via código
  - Maria remove João
  - Maria acessa histórico
  - Verificar 3 entradas (Maria joined, João joined, João removed)

---

### E2E-06: Sad path - Código inválido

- [ ] **E2E**: `tests/e2e/onboarding/invalid-code.spec.ts`
  - Cadastrar usuário
  - Digitar código inexistente "ZZZZZ9"
  - Verificar erro "Código inválido ou expirado"

---

### E2E-07: Sad path - Código expirado

- [ ] **E2E**: `tests/e2e/onboarding/expired-code.spec.ts`
  - Criar household
  - Manipular DB para expirar código (set expires_at = past)
  - Tentar join com código
  - Verificar mesmo erro genérico

---

### E2E-08: Sad path - Join quando já em household

- [ ] **E2E**: `tests/e2e/onboarding/already-in-household.spec.ts`
  - Criar household com usuário
  - Tentar acessar `/onboarding`
  - Verificar redirect imediato para `/dashboard`

---

### E2E-09: Sad path - Member tenta ver audit

- [ ] **E2E**: `tests/e2e/onboarding/member-audit-denied.spec.ts`
  - Criar household com Maria
  - João entra como member
  - João tenta acessar "Histórico de membros"
  - Verificar que opção não aparece OU acesso negado

---

### E2E-10: Happy path - Re-entry após saída

- [ ] **E2E**: `tests/e2e/onboarding/reentry-after-leave.spec.ts`
  - Criar household com Maria
  - João entra via código
  - João sai do household
  - Maria regenera código
  - João entra novamente
  - Verificar João ativo na lista e histórico com 3 eventos

---

### E2E-11: Happy path - Concurrent join

- [ ] **E2E**: `tests/e2e/onboarding/concurrent-join.spec.ts`
  - Criar household com código válido
  - Executar dois joins simultâneos com usuários diferentes
  - Verificar ambos no mesmo household como `member`

---

### E2E-12: Sad path - Rate limit excedido

- [ ] **E2E**: `tests/e2e/onboarding/rate-limit-exceeded.spec.ts`
  - Usuário tenta 6 códigos inválidos em menos de 1 minuto
  - Verificar erro "Muitas tentativas. Aguarde 1 minuto."
  - Verificar status 429 na última tentativa

---

### E2E-13: Sad path - Owner delete bloqueado com membros

- [ ] **E2E**: `tests/e2e/onboarding/owner-delete-blocked.spec.ts`
  - Criar household com owner + 1 member ativo
  - Owner tenta deletar conta
  - Verificar bloqueio e mensagem de transferência/remoção prévia

---

## Resumo do Módulo

| AC | Critério | RED | GREEN | REFACTOR | SECURITY | Status |
|----|----------|-----|-------|----------|----------|--------|
| 01 | Criar household válido | [x] | [x] | [x] | [x] | ✅ |
| 02 | Rejeitar nome inválido | [x] | [x] | [x] | [x] | ✅ |
| 03 | Gerar invite code | [x] | [x] | [x] | [x] | ✅ |
| 04 | Regenerar código | [x] | [x] | [x] | [x] | ✅ |
| 05 | Código expira 48h | [x] | [x] | [x] | [x] | ✅ |
| 06 | Join código válido | [x] | [x] | [x] | [x] | ✅ |
| 07 | Rejeitar código inválido | [x] | [x] | [x] | [x] | ✅ |
| 08 | Rejeitar se já em household (UI) | [x] | [x] | [x] | [x] | ✅ |
| 08.1 | Rejeitar se já em household (API) | [x] | [x] | [x] | [x] | ✅ |
| 09 | Pular onboarding | [x] | [x] | [x] | [x] | ✅ |
| 10 | Listar membros | [x] | [x] | [x] | [x] | ✅ |
| 11 | Member sai | [x] | [x] | [x] | [x] | ✅ |
| 12 | Owner remove | [x] | [x] | [x] | [x] | ✅ |
| 13 | Popular store via setter (inclui bootstrap via useCurrentHousehold — task 13.1) | [x] | [x] | [x] | [x] | ✅ |
| 14 | Redirect correto | [x] | [x] | [x] | [x] | ✅ |
| 14.1 | Sem flash durante loading | [x] | [x] | [x] | [x] | ✅ |
| 15 | Audit: join | [x] | [x] | [x] | [x] | ✅ |
| 16 | Audit: leave | [x] | [x] | [x] | [x] | ✅ |
| 17 | Audit: remove | [x] | [x] | [x] | [x] | ✅ |
| 18 | Owner vê audit | [x] | [x] | [x] | [x] | ✅ |
| 19 | Member não vê audit | [x] | [x] | [x] | [x] | ✅ |
| 20 | Re-entry com novo código | [x] | [x] | [x] | [x] | ✅ |
| 21 | Histórico preservado no re-entry | [x] | [x] | [x] | [x] | ✅ |
| 22 | Join concorrente no mesmo código | [x] | [x] | [x] | [x] | ✅ |
| 23 | Rate limit após 5 tentativas | [x] | [x] | [x] | [x] | ✅ |
| 24 | Reset de rate limit após 1 min | [x] | [x] | [x] | [x] | ✅ |
| 25 | Owner não deleta conta com membros | [x] | [x] | [x] | [x] | ✅ |
| 26 | Owner solo deleta conta com cascade | [x] | [x] | [x] | [x] | ✅ |
| 27 | Clipboard: copiar código | [x] | [x] | [x] | [x] | ✅ |
| 27.1 | Fallback sem clipboard API | [x] | [x] | [x] | [x] | ✅ |
| 28 | Compat módulo 01 (usuário pré-existente) | [x] | [x] | [x] | [x] | ✅ |
| 28.1 | Migration não destrutiva em user_profiles | [x] | [x] | [x] | [x] | ✅ |

### Tarefas de Infraestrutura (pré-AC)

| ID | Descrição | Status |
|----|-----------|--------|
| T-INFRA-1 | Seed helpers + reset DB + script `test:integration` | ✅ |
| T-INFRA-2 | `setHouseholdId` no `useAuthStore` | ✅ |

**Legenda**: [ ] = Pendente, [x] = Concluído

---

## Métricas Atuais

| Métrica | Valor | Alvo | Status |
|---------|-------|------|--------|
| **ACs Implementados** | 28/28 | 28 | ✅ |
| **Testes Unitários** | 450 | — | ✅ |
| **Statements** | 77% | ≥ 80% | ⚠️ |
| **Branches** | 70% | ≥ 75% | ⚠️ |
| **Functions** | 66% | ≥ 80% | ⚠️ |
| **Lines** | 77% | ≥ 80% | ⚠️ |
| **Security Score** | — | ≥ B | ⏳ |
| **Anti-padrões A1-A10** | — | 0 | ⏳ |
| **E2E Happy Paths** | 0/7 | 7 | ⏳ |
| **E2E Sad Paths** | 0/6 | 6 | ⏳ |
| **Tasks T-INFRA** | 2/2 | 2 | ✅ |

---

## Notas

- **Migration + RPCs devem ser criados primeiro**: todas as tasks de UI/hooks dependem das tabelas, RLS e RPCs (`create_household`, `join_household`, etc.).
- **Setter `setHouseholdId` primeiro** (T-INFRA-2): todas as mutations dependem dele. NUNCA usar `useAuthStore.setState({ householdId })` direto (RN-28).
- **Infra de teste de integração** (T-INFRA-1): pré-requisito para ACs 5, 15-17, 20-26, 28. Se não existir, criar primeiro.
- **Helper `get_user_household_id()`**: crítico para RLS de todos os módulos futuros. Testar exaustivamente.
- **Audit imutável**: verificar que não há policy de UPDATE/DELETE em `household_member_audit`. INSERT **apenas** via RPCs `SECURITY DEFINER` (R4 do spec-review).
- **Rate-limiting em join**: implementação via RPC + trigger de GC (RN-15.4). Mitigação multi-conta (por IP) fica para módulo futuro de segurança (RN-15.3).
- **Formato de data canônico**: sempre usar helpers `formatShortDate`/`formatRelativeExpiry` em `src/features/household/lib/date-format.ts` (RN-34.1). Não duplicar `Intl.DateTimeFormat` em componentes.
