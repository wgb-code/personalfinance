# 🏗️ Stack & Decisões Técnicas — Organizador Financeiro Pessoal

> Este documento serve como contexto técnico para o agente de IA que auxiliará no desenvolvimento do projeto. Leia-o antes de qualquer implementação.

---

## 📌 Visão Geral do Projeto

Aplicação web de organização financeira pessoal voltada para casais. A arquitetura é **multi-tenant desde a origem** — cada casal opera em um `household` completamente isolado dos demais, sem vazamento de dados entre tenants.

O uso inicial é pessoal (um casal), mas o código é aberto e preparado para múltiplos casais usarem a mesma instância com total isolamento.

Todo o input de dados é **manual (CRUD)** — sem integração com APIs bancárias.

---

## 👥 Usuários, Cadastro & Multi-tenancy

### Modelo de Tenant

A unidade de tenant é o **`household`** (casal/núcleo financeiro). Cada household:
- Possui de 1 a 2 membros
- Tem seus dados completamente isolados dos demais via RLS
- Opera de forma independente

### Fluxo de Cadastro e Vinculação

```
Usuário se registra (email + senha)
        │
        ▼
Escolhe uma das opções:
        │
        ├──► Criar um novo Household
        │         └── Torna-se owner do household
        │             Gera um invite_code único
        │
        └──► Entrar em um Household existente
                  └── Informa o invite_code do parceiro
                      Vincula-se ao household como member
                      invite_code é invalidado após uso
```

### Regras de Negócio do Household

- Um household suporta no máximo **2 membros** (owner + member)
- O `invite_code` é gerado no momento da criação do household, tem validade configurável (ex: 7 dias) e é de uso único
- Um usuário só pode pertencer a **um household ativo** por vez
- O owner pode remover o member e gerar um novo invite_code se necessário
- Cada entidade cadastrada carrega `author_id`, `household_id`, `created_at` e `updated_at`

### Modos de Visualização

A aplicação possui dois modos alternáveis no header, com escopo **sempre dentro do household**:

- `Pessoal` → exibe apenas os dados do usuário logado dentro do household
- `Casal` → exibe dados compartilhados de todos os membros do household

O modo ativo é gerenciado no estado global do frontend (Zustand) e influencia as queries enviadas ao Supabase. As RLS **não mudam** entre os modos — elas garantem o teto de acesso ao household. O filtro de modo é aplicado na query.

---

## 🖥️ Frontend

| Tecnologia | Observação |
|---|---|
| **React** | Última stable — com Vite como bundler |
| **Vite** | Build tool e dev server |
| **TypeScript** | Obrigatório em todo o projeto |
| **Tailwind CSS** | Estilização utilitária |
| **shadcn/ui** | Componentes headless baseados em Radix UI + Tailwind |
| **Zustand** | Estado global: modo de visualização, usuário ativo, household ativo, filtros globais |
| **React Query (TanStack Query)** | Fetching, cache e sincronização de dados com o Supabase |
| **Recharts** | Gráficos e visualizações de dados |
| **@react-pdf/renderer** | Geração de relatórios em PDF **client-side** (sem servidor) |
| **React Router v6** | Roteamento SPA |

### Decisões de Frontend

- **Zustand** gerencia: modo de visualização (`personal | couple`), usuário logado, `household_id` ativo e filtros globais
- **React Query** gerencia toda comunicação com Supabase (queries + mutations), sem estado local para dados remotos
- **shadcn/ui** escolhido por ser headless/customizável e integrar nativamente com Tailwind
- **PDF client-side** via `@react-pdf/renderer` elimina necessidade de Edge Function para relatórios
- O **modo de visualização** não altera RLS — filtra as queries no nível do frontend via Zustand

### Fluxo de Autenticação no Frontend

```
App inicia
    │
    ▼
supabase.auth.getSession()
    │
    ├── Sem sessão → /login ou /register
    │
    └── Com sessão
            │
            ▼
        Busca household_members onde user_id = auth.uid()
            │
            ├── Sem household → /onboarding (criar ou entrar em um household)
            │
            └── Com household → App principal
```

---

## 🔧 Backend — Supabase (BaaS)

O projeto utiliza **Supabase** como backend completo. Não há API Node.js/Express separada.

| Serviço Supabase | Uso no Projeto |
|---|---|
| **Auth** | Registro email/senha, login, sessão persistente, JWT, refresh token |
| **PostgreSQL** | Banco de dados principal — todas as entidades |
| **Row Level Security (RLS)** | Isolamento total entre households + controle por usuário |
| **PostgREST** | API REST automática a partir do schema |
| **Storage** | Comprovantes e anexos, organizados por household |
| **Realtime** | Sincronização em tempo real entre os membros do household |
| **Edge Functions** | Lógica server-side: recorrência mensal, validação de invite_code, score de saúde |
| **pg_cron** | Agendamento da geração de lançamentos recorrentes |

### Decisões de Backend

- **Sem API extra**: toda lógica server-side usa Edge Functions (Deno) ou RPCs/Functions do PostgreSQL
- **pg_cron** agenda a geração de recorrências na virada do mês (`0 0 1 * *`)
- **Views e RPCs** são preferidas para agregações (saldo mensal, totais por categoria)
- **Storage** organizado por household: `/{household_id}/{userId}/{filename}`
- O **invite_code** é gerado e validado via Edge Function para evitar exposição de lógica no cliente

---

## 🔐 Estratégia de Segurança (RLS Multi-tenant)

### Tabelas Centrais de Multi-tenancy

```sql
-- Núcleo financeiro (tenant)
households (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  invite_code       text unique,
  invite_expires_at timestamptz,
  created_at        timestamptz default now()
)

-- Membros do household (máx. 2 por household)
household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  role         text check (role in ('owner', 'member')) default 'member',
  joined_at    timestamptz default now(),
  unique(household_id, user_id),
  unique(user_id) -- um usuário pertence a apenas um household
)
```

### Helper Function (usada em todas as policies)

```sql
-- Retorna o household_id do usuário autenticado
create or replace function get_user_household_id()
returns uuid as $$
  select household_id
  from household_members
  where user_id = auth.uid()
  limit 1;
$$ language sql security definer stable;
```

### Padrão de Policy (aplicado a TODAS as tabelas de domínio)

```sql
-- Exemplo para a tabela fixed_bills
-- Isolamento: usuário só acessa dados do SEU household
create policy "household_isolation"
on fixed_bills for all
using (
  household_id = get_user_household_id()
);

-- O filtro de modo pessoal/casal é feito na QUERY, não na policy:
-- Modo pessoal: .eq('author_id', userId)
-- Modo casal:   sem filtro de author (vê tudo do household)
```

> ⚠️ **Princípio fundamental**: O RLS garante o isolamento entre households. O modo de visualização (pessoal/casal) é um filtro de UX aplicado na query do frontend, nunca na camada de segurança.

---

## 📁 Estrutura de Pastas (Frontend)

```
src/
├── assets/
├── components/
│   ├── ui/              # Componentes shadcn/ui (gerados via CLI)
│   └── shared/          # Componentes reutilizáveis do projeto
├── features/            # Módulos por domínio
│   ├── auth/            # Login, Register, fluxo de sessão
│   ├── onboarding/      # Criar household, entrar via invite_code
│   ├── bills/           # Contas fixas
│   ├── expenses/        # Contas variadas
│   ├── income/          # Renda
│   ├── planning/        # Metas e eventos
│   ├── dashboard/       # Widgets e gráficos
│   └── reports/         # Filtros e exportações
├── hooks/               # Custom hooks globais
├── lib/
│   ├── supabase.ts      # Cliente Supabase configurado
│   └── utils.ts
├── stores/              # Zustand stores
│   ├── useViewMode.ts   # Modo pessoal/casal
│   ├── useAuthStore.ts  # Usuário + household_id
│   └── useFilters.ts    # Filtros globais ativos
├── types/               # Tipos TypeScript globais
│   ├── database.ts      # Tipos gerados pelo Supabase CLI
│   └── app.ts           # Tipos de domínio da aplicação
└── main.tsx
```

---

## 🗓️ Funcionalidades com Lógica Específica

### Recorrência Automática (Contas Fixas)
- Conta fixa cadastrada com `is_recurring = true`
- `pg_cron` roda na virada do mês e dispara Edge Function que gera `bill_occurrences` para todos os households ativos
- Usuário marca cada ocorrência como **paga** com a data real de pagamento

### Parcelamento (Contas Variadas)
- Despesa parcelada gera **N registros filhos** vinculados a um `installment_group_id`
- Cada parcela tem `due_date` e status de pagamento independentes
- UI exibe visão consolidada (grupo) ou individual (parcelas)

### Convite de Parceiro (Invite Code)
- Owner do household recebe um `invite_code` único ao criar o household
- Code tem validade configurável e é de **uso único**
- Validação e consumo do code feitos via **Edge Function** (não expõe lógica no cliente)
- Após o segundo membro entrar, o code é invalidado e removido

### Score de Saúde Financeira
- Calculado via RPC no PostgreSQL ou Edge Function, com escopo no `household_id`
- Critérios: saldo positivo, metas em dia, contas pagas sem atraso
- Retorna score 0–100 com breakdown por critério

### Geração de PDF
- 100% client-side com `@react-pdf/renderer`
- Respeita filtros ativos no momento da exportação
- Sem Edge Function ou infraestrutura adicional

---

## 🚫 O que este projeto NÃO tem

- Integração com APIs bancárias — tudo é CRUD manual
- Mais de 2 membros por household (limitação de negócio intencional)
- API Node.js/Express separada — lógica server-side via Edge Functions (Deno)
- Troca de household por usuário (um usuário = um household ativo)

---

## 🔑 Variáveis de Ambiente (.env)

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> A `anon key` é segura no frontend pois o acesso real é controlado inteiramente pelo RLS no banco.

---

## 📎 Documentos Relacionados

- `REQUIREMENTS.md` — Requisitos funcionais completos da aplicação
- `SCHEMA.md` — Modelagem do banco de dados (a criar)
- `RLS.md` — Políticas de segurança detalhadas por tabela (a criar)