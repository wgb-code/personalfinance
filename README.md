# Personal Finance Frontend

App web de finanças pessoais com multi-tenancy. **React 19** + **Vite** + **TypeScript** + **Tailwind CSS** v4 + **Supabase**.

---

## Início Rápido

```bash
pnpm install
pnpm dev
```

Roda em `http://localhost:5173`.

---

## Estrutura do Projeto

```
.cursor/                    # Configuração do Cursor AI (rules, skills, agents, commands)
├── rules/                  # Arquivos .mdc (diretrizes do projeto)
├── skills/                 # Arquivos SKILL.md (módulos de conhecimento da IA)
├── agents/                 # Arquivos .md (subagents para tarefas complexas)
└── commands/               # Arquivos .md (slash commands: /spec-draft, /module-start, etc)

docs/                       # Documentação do projeto (referência, não código)
├── REQUIREMENTS.md         # Requisitos funcionais (15 módulos)
├── STACK.md                # Decisões de tecnologia (React, Supabase, testes)
├── SCHEMA.md               # Esquema do banco + políticas RLS + triggers
└── SECURITY.md             # 15 Leis Imutáveis de Segurança + anti-padrões

specs/                      # Artefatos do Spec-Driven Development
├── _constitution.md        # 10 princípios imutáveis
├── _tdd-flow.md            # Ciclo Red → Green → Refactor → Security
├── _module-template/       # Templates para spec.md, tasks.md, security.md
│   ├── spec.md
│   ├── tasks.md
│   └── security.md
├── modules/                # Specs gerados (um por módulo)
│   ├── 01-auth-and-session/
│   ├── 02-household-onboarding/
│   └── ... (15 módulos no total)
└── _progress.md            # Rastreador de status dos 15 módulos

src/                        # Código de implementação (apenas após spec pronto)
├── features/               # Módulos de feature (01-*, 02-*, etc)
├── components/             # Componentes React compartilhados
├── hooks/                  # React hooks customizados
├── lib/                    # Utilitários, types, constantes
└── styles/                 # Estilos globais (config Tailwind)

tests/                      # Arquivos de teste (espelhando estrutura de src/)
supabase/                   # Migrations, políticas RLS, Edge Functions
```

---

## Como Trabalhar Aqui

### 1. **Entenda o Fluxo**

Este projeto segue **Spec-Driven Development (SDD)** + **Test-Driven Development (TDD)**:

```
SPEC → CICLO TDD → IMPLEMENTAÇÃO → AUDITORIA DE SEGURANÇA → MERGE
```

**Nunca** escreva código antes do spec estar pronto. **Nunca** faça merge sem testes verdes + auditoria de segurança.

### 2. **Iniciar um Novo Módulo**

Use o agent de IA para gerar um spec detalhado automaticamente:

```bash
/spec-draft "descrição breve do que você quer"
```

**Exemplo**:
```
/spec-draft "Autenticação com email/senha + sessão + recuperação"
```

O agent vai:
1. Indexar a base de conhecimento do projeto (requisitos, schema, leis de segurança)
2. Propor um slug de módulo (ex: `01-auth-and-session`)
3. Fazer 3–5 perguntas críticas para clarificação
4. Apresentar um plano consolidado (objetivo, critérios Gherkin, mapeamento das 15 leis)
5. Gerar 3 arquivos após sua confirmação:
   - `specs/modules/NN-slug/spec.md` — spec detalhado
   - `specs/modules/NN-slug/tasks.md` — checklist TDD
   - `specs/modules/NN-slug/security.md` — template de auditoria de segurança

### 3. **Revisar o Spec**

Antes de codar:

```bash
/spec-review NN-slug
```

Verifica:
- [ ] Todos os critérios Gherkin são executáveis
- [ ] Dependências estão listadas e prontas
- [ ] Todas as 15 Leis de Segurança estão mapeadas
- [ ] Métricas de sucesso são mensuráveis

### 4. **Implementar o Módulo**

Inicie o ciclo TDD:

```bash
/module-start NN-slug
```

Cria uma branch de feature e organiza a estrutura de pastas. Depois siga o ciclo **Red → Green → Refactor → Security** para cada critério de aceite (documentado em `specs/_tdd-flow.md`).

Atualize os checkboxes do `tasks.md` à medida que completa cada fase.

### 5. **Testar Tudo**

Rode os testes do módulo:

```bash
/module-test NN-slug
```

Executa:
- **Vitest** (browser-mode com provider Playwright) — testes unitários + integração no DOM real
- **Playwright** — testes E2E
- **axe** — checagens de acessibilidade

Meta: ≥ 80% de cobertura de código, todos os happy paths + sad paths em E2E.

### 6. **Auditoria de Segurança**

Verifique todas as 15 Leis:

```bash
/sec-audit NN-slug
```

Checa:
- Políticas RLS aplicadas (`household_id = get_user_household_id()`)
- Sem segredos hardcoded
- Validação de input (schemas Zod)
- Sanitização de output (escape do React)
- Transações atômicas
- Rate limiting (quando aplicável)
- Logging seguro (sem senhas em logs)

Marque o `security.md` como "Verificado" ao concluir.

### 7. **Merge**

Quando o spec estiver 100%, testes passando e auditoria de segurança ✅:

```bash
/module-complete NN-slug
```

Faz merge na `main` e atualiza o status no `_progress.md` para "✅ Completo".

---

## Comandos Principais

| Comando | Função |
|---------|--------|
| `/spec-draft "tema"` | Gera spec detalhado a partir de descrição breve |
| `/spec-new <número> <slug>` | Cria scaffold em branco (raramente usado; prefira `/spec-draft`) |
| `/spec-review NN-slug` | Valida spec antes da implementação |
| `/module-start NN-slug` | Inicia ciclo TDD; cria branch de feature |
| `/module-test NN-slug` | Roda Vitest + Playwright + axe do módulo |
| `/sec-audit NN-slug` | Verifica todas as 15 Leis de Segurança |
| `/module-complete NN-slug` | Faz merge na main e marca módulo como completo |

---

## Princípios do Projeto

**De `specs/_constitution.md`** — Estes são inegociáveis:

1. **Spec-Driven Development** → Toda feature começa com um spec detalhado
2. **Test-Driven Development** → RED → GREEN → REFACTOR → SECURITY
3. **Um Módulo por Vez** → Sem features em paralelo (impõe foco)
4. **Multi-tenancy por Padrão** → Toda tabela tem `household_id`; RLS é obrigatório
5. **Segurança Zero-Trust** → Nunca confie no cliente; valide tudo no backend
6. **Testes em DOM Real** → Testes rodam em browser real (sem mocks)
7. **Ordem Fixa de Módulos** → Respeite a sequência dos 15 módulos (dependências exigem)
8. **Specs São Documentação Viva** → Atualize conforme aprende; specs = contratos executáveis
9. **Testes São o Spec** → Se o teste passa, o spec foi cumprido
10. **TypeScript Estrito** → Sem `any`; checagens exaustivas em unions/enums

---

## Stack Tecnológica

**Frontend**:
- **React 19** com Hooks
- **Vite** (build rápido)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** (styling utility-first atômico)
- **shadcn/ui** (componentes Radix UI Nova)
- **Zustand** (estado de UI + sessão)
- **React Query** (cache de dados remotos)
- **Recharts** (gráficos do dashboard)
- **@react-pdf/renderer** (export PDF client-side)

**Backend**:
- **Supabase** (PostgreSQL 15+, Auth, Storage, Realtime, Edge Functions)
- **Row-Level Security (RLS)** (isolamento de tenant)
- **pg_cron** (jobs agendados)

**Testes**:
- **Vitest** (browser-mode com provider Playwright)
- **Playwright** (testes E2E)
- **axe-core** (testes de acessibilidade)

**Dinheiro & Datas**:
- `numeric(12,2)` no PostgreSQL → `Decimal.js` no frontend
- `timestamptz` para todas as datas (sem ambiguidade)
- Locale `pt-BR`

---

## Segurança

**15 Leis Imutáveis** (de `docs/SECURITY.md`):

Todo módulo deve atender estas leis:

1. **Nunca confie no cliente** → Proteção contra IDOR/BOLA
2. **Schema com whitelist** → Sem mass assignment
3. **Limites de tamanho e taxa** → Prevenção de DoS
4. **Proteção de perímetro** → CORS, CSRF, rate limiting
5. **Identidade extraída** → Do JWT, nunca do body da requisição
6. **Autorização por operação** → Cada read/write valida roles
7. **RLS aplicado** → Políticas Row-Level Security
8. **Transações atômicas** → Sem updates parciais
9. **Exposição mínima** → Retorne apenas dados necessários
10. **Escape de HTML** → Prevenção de XSS
11. **Segredos fora do código** → Apenas em `.env.local`
12. **Upload e SSRF seguros** → Magic bytes, URLs assinadas
13. **Supply chain** → `pnpm audit` limpo
14. **Logging seguro** → Ações + erros, sem senhas
15. **Configuração segura por padrão** → HTTPS, cookies HttpOnly, CSP estrita

**Anti-padrões a evitar** (de `docs/SECURITY.md`, A1–A10):
- Código gerado por IA sem revisão
- Lógica hardcoded em Edge Functions
- Queries N+1
- Uploads de arquivos não validados
- Logging de dados sensíveis
- ... (veja a lista completa em `docs/SECURITY.md`)

---

## Design System

**De `.impeccable.md`** — Personalidade da marca: "Calmo. Claro. Honesto."

- Estética minimalista e refinada
- Light mode (primário), dark mode (secundário)
- Hierarquia tipográfica clara
- Espaços em branco generosos
- Sem "vibes coding" (sem números mágicos, sem efeitos inexplicados)

Todos os componentes de UI ficam em `src/components/` e são construídos com **shadcn/ui** (Radix UI Nova).

---

## 15 Módulos (Ordem Fixa)

A ordem de implementação é **fixa** (dependências exigem):

1. **01-auth-and-session** — Supabase Auth + JWT + estado de sessão
2. **02-household-onboarding** — Criação de household, convite de membros, RLS
3. **03-categories** — Categorias de despesa/receita
4. **04-fixed-bills** — Contas fixas mensais
5. **05-expenses** — Despesas avulsas + anexos
6. **06-income** — Salário e receitas variáveis
7. **07-goals-and-events** — Metas de poupança, eventos de vida
8. **08-dashboard** — Visão geral + estatísticas rápidas
9. **09-widgets-and-customization** — Widgets do dashboard
10. **10-filters-and-reports** — Filtros, drill-down, export P&L
11. **11-notifications-and-alerts** — Alertas de contas, marcos de metas
12. **12-configurations** — Configurações do app (tema, idioma)
13. **13-mobile-responsive** — Otimização mobile
14. **14-export-and-ical** — PDF + sync iCal
15. **15-security-and-compliance** — Auditoria final, GDPR, rotação de segredos

Veja `specs/_progress.md` para o status atual.

---

## Referências Úteis

- `docs/REQUIREMENTS.md` — O que o app deve fazer (spec funcional)
- `docs/STACK.md` — Por que escolhemos esta stack (log de decisões)
- `docs/SCHEMA.md` — Esquema do banco + políticas RLS (referência para tarefas de backend)
- `docs/SECURITY.md` — 15 Leis + anti-padrões (bíblia de segurança)
- `specs/_constitution.md` — Princípios imutáveis (leia uma vez, viva por isso)
- `specs/_tdd-flow.md` — Ciclo Red → Green → Refactor → Security (como testar)
- `.impeccable.md` — Design system + marca (diretrizes de UI)

---

## Pedindo Ajuda à IA

Os agents do Cursor AI estão configurados para ajudar:

**Para geração de spec**:
```
/spec-draft "Seu tema ou requisito"
```

**Para dúvidas de implementação**:
- "Como implemento login com Supabase Auth?"
- "Qual o padrão de RLS para esta tabela?"
- "Por que este teste está falhando?"

**Para revisão de código**:
- "Revise este componente quanto à segurança"
- "Está seguindo as 15 Leis?"
- "Posso otimizar esta query?"

---

## Armadilhas Comuns

🚫 **Não faça**:
- Escrever código antes do spec estar pronto
- Pular testes ou auditoria de segurança
- Usar `any` em TypeScript
- Commitar segredos no git (use `.env.local`)
- Hardcodar `household_id` (extraia do JWT)
- Retornar todos os campos da API (exposição mínima)
- Mockar o DOM em testes (use browser real)
- Reordenar módulos ou pular passos

✅ **Faça**:
- Leia o spec primeiro
- Escreva testes RED antes do código GREEN
- Rode `/module-test` antes de fazer merge
- Atualize `tasks.md` conforme avança
- Faça perguntas de clarificação cedo (Fase 2 do `/spec-draft`)
- Use Gherkin para critérios de aceite
- Extraia `household_id` do JWT em todas as checagens RLS
- Retorne apenas campos necessários (segurança + performance)

---

## Onde Buscar Ajuda

1. **Leia o spec** (`specs/modules/NN-slug/spec.md`) — Este é seu contrato.
2. **Veja os templates** (`specs/_module-template/`) — Exemplos de specs bem feitos.
3. **Revise módulos anteriores** (`specs/modules/`) — Aprenda com o que já foi feito.
4. **Pergunte à IA** — Use `/spec-draft`, `/spec-review`, ou pergunte no chat.
5. **Consulte os docs** (`docs/`) — REQUIREMENTS, STACK, SCHEMA, SECURITY têm todas as respostas.

---

## Status

Progresso atual: `specs/_progress.md`

- Módulos completos: 0/15
- Specs prontos: 0/15
- Cobertura de testes: —%

Comece com `/spec-draft "Autenticação e Usuários"` para criar o primeiro spec. 🚀

