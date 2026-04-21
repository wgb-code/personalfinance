# 📜 Constituição do Projeto — Organizador Financeiro Pessoal

## Princípios Imutáveis

Estes princípios são leis fundamentais do projeto. TODA decisão arquitetural, code review e planejamento deve verificar conformidade com a constituição antes de prosseguir.

### 1. Especificação Antes de Código (SDD — Spec-Driven Development)

**Lei**: Nenhuma linha de código é escrita sem especificação explícita.

- Cada feature/módulo começa com `spec.md` — documento que define **O QUÊ** será construído.
- Especificação inclui: objetivo, personas, regras de negócio, entrada/saída, critérios de aceite (Gherkin), dependências.
- Somente após `spec.md` estar completo e revisado, o desenvolvimento inicia.
- Toda mudança de requisito retorna à especificação (não é patch no código).

### 2. Testes Antes de Implementação (TDD — Test-Driven Development)

**Lei**: Red → Green → Refactor → Security (4ª fase obrigatória).

- Para cada critério de aceite, escrever teste que falha (Red).
- Implementar o mínimo para passar (Green).
- Limpar código mantendo testes verdes (Refactor).
- Rodar `/sec-audit` para verificar segurança (Security).
- Nenhum PR é mergeado sem cobertura ≥ 80% no módulo.

### 3. Um Módulo por Vez

**Lei**: Trabalho paralelo em diferentes módulos é proibido. Serialização total.

- A ordem de implementação é **fixa e obrigatória** (ver seção 4 abaixo).
- Quando um módulo é marcado como "ativo", nenhum outro pode começar.
- Exceptions raríssimas: críticas de segurança já descobertas em produção (não hipotéticas).
- Rastreamento de módulo ativo em `specs/_progress.md`.

### 4. Multi-tenancy via `household_id` é o Fundamento

**Lei**: Isolamento total entre households, sem exceção.

- Toda tabela de domínio (não global) DEVE ter `household_id`.
- RLS (Row Level Security) SEMPRE habilitado; política padrão: `using (household_id = get_user_household_id())`.
- Teste de isolamento RLS é teste de segurança obrigatório.
- View mode (`personal | couple`) é **filtro de UX na query**, NUNCA no RLS.
- Modo pessoal: `where author_id = userId AND household_id = householdId`.
- Modo casal: `where household_id = householdId` (todas as pessoas, sem filter autor).

### 5. Segurança é Responsabilidade Compartilhada (Zero-Trust)

**Lei**: As 15 Leis de [docs/SECURITY.md](../docs/SECURITY.md) não são "guia", são mandado.

- Toda feature entrega também `security.md` no diretório do módulo.
- `security.md` mapeia as 15 Leis para a feature (o que testar, como testar, evidência).
- `/sec-audit` é gate obrigatório antes de marcar módulo como completo.
- Vulnerabilidade descoberta = rollback automático, não "patch depois".
- Proibições explícitas: anti-padrões A1–A10 de [docs/SECURITY.md](../docs/SECURITY.md) (auth removido, secrets hardcoded, RLS desabilitado, etc.).

### 6. Testes Rodam em DOM Real

**Lei**: Testes de integração e componente usam Vitest + Playwright provider (não jsdom).

- Razão: comportamento real de componentes interativos exige DOM real.
- Padrão: `render()` + `userEvent.*()` real (não simulado).
- Setup: `vitest.config.ts` com `@vitest/browser: { provider: 'playwright', ... }`.
- Cobertura mínima por módulo: 80% statements + branches.
- E2E (fluxos completos): Playwright clássico contra app rodando.

### 7. Ordem Fixa de Implementação

**Lei**: Os 15 módulos devem ser entregues nesta ordem exata.

1. **01-auth-and-session** — Supabase Auth + `user_profiles` trigger + sessão Zustand.
2. **02-household-onboarding** — `households`, `household_members`, `join_household_by_invite()` Edge Function.
3. **03-categories** — CRUD + categorias padrão por household.
4. **04-fixed-bills** — `fixed_bills` + `bill_value_history` trigger.
5. **05-bill-occurrences** — `bill_occurrences` + `generate_bill_occurrences()` RPC + pg_cron job.
6. **06-variable-expenses** — `expenses` simples (sem parcelamento por enquanto).
7. **07-installments** — `installment_groups` + lógica de parcelamento.
8. **08-income** — `income_sources` + `income_entries`.
9. **09-goals-and-events** — `goals`, `goal_contributions`, `events`.
10. **10-dashboard-widgets** — widgets reordenáveis + `widget_preferences`.
11. **11-charts** — Recharts + RPCs de agregação (saldo, distribuição, evolução).
12. **12-filters-and-reports** — filtros globais Zustand + relatório resumido.
13. **13-pdf-csv-export** — `@react-pdf/renderer` + CSV client-side.
14. **14-settings-and-prefs** — `user_settings` + tema claro/escuro.
15. **15-health-score** — `calculate_health_score()` RPC + widget no dashboard.

### 8. Documentação Viva é Código

**Lei**: Docs vivem lado a lado com código; são atualizadas no mesmo commit.

- `spec.md` para cada módulo (antes do desenvolvimento).
- `README.md` do projeto atualizado quando verdade muda.
- `docs/STACK.md`, `docs/REQUIREMENTS.md`, `docs/SCHEMA.md` são fontes de verdade — atualizadas somente via PR explícito.
- Comente apenas por QUÊ, nunca o QUÊ (o código diz o quê).

### 9. Senioridade: Testes são Execução, não Verificação

**Lei**: Testes não "checam se funciona". Testes **definem** o comportamento.

- Red phase: teste é a especificação em código.
- Green phase: implementação obedece ao contrato do teste.
- Refactor phase: mudança de implementação sem mudar contrato.
- Security phase: auditoria das 15 Leis em código + teste.

### 10. TypeScript Rigoroso, Defaults Explícitos

**Lei**: `noImplicitAny: true`, `strictNullChecks: true`, nenhuma exceção.

- Tipos são documentação viva.
- `unknown` é aceito apenas em borders (entrada/saída de sistema).
- Interfaces sobre Types (por estabilidade).
- Defaults são explícitos: `function foo(x: string = ""): void` ✅; `function foo(x = ""): void` ❌.

---

## Referências

- [REQUIREMENTS.md](../docs/REQUIREMENTS.md) — Requisitos funcionais do app.
- [STACK.md](../docs/STACK.md) — Stack tecnológica (React, Vite, Supabase, etc.).
- [SCHEMA.md](../docs/SCHEMA.md) — Modelagem do banco de dados e RLS.
- [SECURITY.md](../docs/SECURITY.md) — 15 Leis de arquitetura segura; anti-padrões A1–A10.

---

## Alterando a Constituição

A constituição é imutável durante um mês. Se descoberta brecha crítica:

1. Propor emenda no `CONSTITUTION.md` (PR separado, discussão).
2. **NUNCA** patch no código esperando que ninguém note.
3. Retroativamente auditar módulos já entregues contra a emenda.

