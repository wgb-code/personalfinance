# Checklist TDD: Módulo [NÚMERO-NOME]

> ⚠️ **INSTRUÇÃO**: Para cada critério de aceite do `spec.md`, preencha os 4 estados abaixo. Marque cada checkbox enquanto progride. Nenhuma tarefa sai de "REFACTOR" sem passar em "SECURITY".

## Estrutura de Tarefa

Para cada feature/aceite, copie este template:

```markdown
### [NÚMERO-Aceite] - [Descrição Curta]

- [ ] **RED**: Teste falhando escrito (Vitest ou Playwright)
- [ ] **GREEN**: Implementação mínima, testes passando
- [ ] **REFACTOR**: Código limpo, cobertura ≥ 80%, lints OK
- [ ] **SECURITY**: `/sec-audit` rodado, vulnerabilidades CRÍTICA/ALTA ausentes

**Evidence**:
- Test file: `src/features/bills/components/BillsList.test.tsx`
- Implementation: `src/features/bills/components/BillsList.tsx`
- Coverage: ![coverage badge](./coverage-badge-url)
- Security scorecard: [Nota: A | B | C]
```

---

## Tasks (Copie e Preencha)

### 1-Listar contas fixas em modo pessoal

- [ ] **RED**: Teste em `src/features/bills/components/BillsList.test.tsx` falhando (componente não renderiza nada)
- [ ] **GREEN**: Componente hardcoda 2-3 contas de teste, lista renderiza
- [ ] **REFACTOR**: Integrado com React Query + `useFixedBills()` hook, sem hardcode, cobertura ≥ 80%
- [ ] **SECURITY**: Verificado que usuário A não vê contas de usuário B (RLS policy + isolamento)

**Evidence**:
- Test: `src/features/bills/__tests__/BillsList.mode-personal.test.tsx`
- Impl: `src/features/bills/components/BillsList.tsx`
- Sec: RLS `using (household_id = get_user_household_id() AND author_id = auth.uid())`

---

### 2-Listar contas fixas em modo casal

- [ ] **RED**: Teste falhando (deve listar todas as contas do household, não filtrado por autor)
- [ ] **GREEN**: Query sem filtro de `author_id`, lista renderiza
- [ ] **REFACTOR**: Zustand `useViewMode()` determina filtro, sem hardcode, cobertura OK
- [ ] **SECURITY**: RLS testada para múltiplos usuários no mesmo household

**Evidence**:
- Test: `src/features/bills/__tests__/BillsList.mode-couple.test.tsx`
- Impl: mesma função com `viewMode` condicional

---

### 3-Criar conta fixa (validação obrigatória)

- [ ] **RED**: Teste valida rejeição de campos vazios (nome, valor, vencimento, categoria)
- [ ] **GREEN**: Validação hardcoda ou simples, rejection logic funciona
- [ ] **REFACTOR**: Zod schema ou form validation integrado, messages user-friendly
- [ ] **SECURITY**: Nenhum campo proibido (ex: `household_id`, `author_id`) aceito no input (Lei 2 — Schema Restrito)

**Evidence**:
- Test: `src/features/bills/__tests__/BillForm.validation.test.tsx`
- Schema: `src/features/bills/types/index.ts` ou `zodSchemas.ts`
- Sec: Verificar que `authorId` não vem do body, mas de `auth.uid()` (Lei 5 — IDOR)

---

### 4-Criar conta fixa (sucesso)

- [ ] **RED**: Teste que cria via form e verifica sucesso (toast, reload lista)
- [ ] **GREEN**: Form submete hardcoded para RPC ou mutation
- [ ] **REFACTOR**: Integrado com React Query mutation, optimistic update UI
- [ ] **SECURITY**: Mutation valida `householdId` e `author_id` no backend (RPC), não no cliente

**Evidence**:
- Test: `src/features/bills/__tests__/BillForm.create.test.tsx`
- API: `src/features/bills/api/hooks.ts` useCreateFixedBill()
- DB: Migration `supabase/migrations/20250419_create_fixed_bills.sql` com RLS

---

### 5-Editar conta fixa

- [ ] **RED**: Teste que abre modal, muda um campo, salva, verifica mudança
- [ ] **GREEN**: Mutation hardcoda sucesso
- [ ] **REFACTOR**: Integrado com React Query, invalidation correta
- [ ] **SECURITY**: Verifica autorização (só `author_id` ou `household.owner` podem editar) (Lei 6 — Broken Access Control)

**Evidence**:
- Test: `src/features/bills/__tests__/BillForm.edit.test.tsx`
- Sec: RLS policy `UPDATE fixed_bills USING (author_id = auth.uid() OR is_household_owner())`

---

### 6-Deletar conta fixa

- [ ] **RED**: Teste clica delete, confirma, item some da lista
- [ ] **GREEN**: Mutation hardcoda sucesso
- [ ] **REFACTOR**: Delete com confirmação, toast sucesso/erro
- [ ] **SECURITY**: Authorization check (só owner/author)

**Evidence**:
- Test: `src/features/bills/__tests__/BillActions.delete.test.tsx`
- Sec: RLS policy DELETE

---

### 7-Pausar/Retomar conta fixa

- [ ] **RED**: Teste toggle status active↔paused, verifica estado visual
- [ ] **GREEN**: Update hardcoda
- [ ] **REFACTOR**: Button inteligente (mostra "Pausar" se ativa, "Retomar" se pausada), icon feedback
- [ ] **SECURITY**: Status update validado no RPC (não client-side trusting)

**Evidence**:
- Test: `src/features/bills/__tests__/BillActions.toggle.test.tsx`

---

### 8-Histórico de alterações de valor

- [ ] **RED**: Teste que edita valor duas vezes, verifica que `bill_value_history` registra ambas com timestamp
- [ ] **GREEN**: Trigger cria registros (hardcoded ou via mutation manual)
- [ ] **REFACTOR**: Trigger `log_bill_value_change()` automático na atualização
- [ ] **SECURITY**: Histórico é read-only para não-owners (Lei 9 — Data Exposure se não protegido)

**Evidence**:
- Test: `src/features/bills/__tests__/BillValueHistory.test.tsx`
- DB: Trigger em `supabase/migrations/`.sql
- Sec: RLS em `bill_value_history` (SELECT permitido, UPDATE/DELETE proibido)

---

### 9-Modal de upload de anexo (comprovante)

- [ ] **RED**: Teste select file, upload sucesso, preview renderiza
- [ ] **GREEN**: File input basic, storage upload hardcoded
- [ ] **REFACTOR**: Validação de tipo (image/PDF), max size 10MB, retry on failure
- [ ] **SECURITY**: Magic byte validation (não confiar em extension), uploaded to `/{household_id}/{user_id}/{filename}` (Lei 12 — Upload & SSRF)

**Evidence**:
- Test: `src/features/bills/__tests__/BillAttachment.test.tsx`
- Storage: Supabase Storage với `AuthorizedRead` policy
- Sec: Magic bytes check no Edge Function

---

### 10-Exibição de alerta de vencimento próximo

- [ ] **RED**: Teste que bill próximo a vencer é destacado visualmente
- [ ] **GREEN**: CSS hardcoda highlight (red border, yellow bg, etc)
- [ ] **REFACTOR**: Usa `user_settings.alert_days_before` (default 5), cálculo dinâmico
- [ ] **SECURITY**: Apenas user vê seus próprios alerts (RLS)

**Evidence**:
- Test: `src/features/bills/__tests__/BillAlert.test.tsx`
- UX: Visual indicator (badge, border, text)
- Sec: Verificar que query filtra por `household_id`

---

## Resumo do Módulo

| Aceite | RED | GREEN | REFACTOR | SECURITY | Status |
|--------|-----|-------|----------|----------|--------|
| 1 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 2 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 3 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 4 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 5 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 6 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 7 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 8 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 9 | [ ] | [ ] | [ ] | [ ] | ⏳ |
| 10 | [ ] | [ ] | [ ] | [ ] | ⏳ |

**Cobertura de Testes**: [XX]% (Target: ≥ 80%)
**Security Scorecard**: [—] (A/B/C, Target: ≥ B)

---

## Notas

- Adicione notas de bloqueadores, decisões arquiteturais, ou mudanças de escopo aqui.
- Se descobrir um critério faltando no `spec.md`, adicione e confirme com o plano antes de prosseguir.

