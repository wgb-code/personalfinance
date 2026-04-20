# 🗄️ Schema do Banco de Dados — Organizador Financeiro Pessoal

> Leia `STACK.md` e `REQUIREMENTS.md` antes deste documento.  
> Este schema é projetado para **Supabase (PostgreSQL 15+)** com multi-tenancy via `household_id`.

---

## 📐 Convenções & Princípios de Design

- **PKs**: `uuid` gerado com `gen_random_uuid()` — sem serial/integer para evitar enumeração
- **Timestamps**: sempre `timestamptz` (com fuso horário), nunca `timestamp`
- **Soft delete**: não utilizado — dados são excluídos fisicamente. Histórico sensível tem tabelas próprias
- **Padrão de nomenclatura**: `snake_case` em tudo. Tabelas no plural
- **`household_id`**: presente em **todas** as tabelas de domínio — é o discriminador de tenant
- **`author_id`**: referencia `auth.users(id)` — nunca a tabela `user_profiles` diretamente
- **Valores monetários**: `numeric(12, 2)` — precisão exata, sem ponto flutuante
- **Mês de referência**: `date` sempre com dia fixado em `01` (ex: `2025-04-01` = abril/2025)
- **RLS habilitado em todas as tabelas** — sem exceção

---

## 🔤 Enums

```sql
-- Papel do usuário dentro de um household
create type member_role as enum ('owner', 'member');

-- Status de uma conta fixa
create type bill_status as enum ('active', 'paused');

-- Status de um lançamento mensal de conta fixa
create type occurrence_status as enum ('pending', 'paid', 'overdue');

-- Modo de visualização / escopo de um registro
create type view_mode as enum ('personal', 'couple');

-- Tipo de recorrência de uma fonte de renda
create type recurrence_type as enum ('monthly', 'weekly', 'yearly', 'once');

-- Escopo de aplicação de uma categoria
create type category_scope as enum ('fixed', 'variable', 'both');

-- Escopo de uma meta financeira
create type goal_scope as enum ('personal', 'couple');

-- Tipo de evento planejado
create type event_type as enum ('travel', 'moving', 'purchase', 'other');
```

---

## 🔧 Helper Functions (RLS & Triggers)

Estas funções são criadas **antes das tabelas e policies**, pois são dependências.

```sql
-- ─────────────────────────────────────────────────────────────
-- Retorna o household_id do usuário autenticado
-- SECURITY DEFINER: executa com permissões do owner da função
-- STABLE: resultado cacheável dentro da transação (performance)
-- Usada em TODAS as RLS policies de tabelas de domínio
-- ─────────────────────────────────────────────────────────────
create or replace function get_user_household_id()
returns uuid
language sql
security definer
stable
as $$
  select household_id
  from household_members
  where user_id = auth.uid()
  limit 1;
$$;


-- ─────────────────────────────────────────────────────────────
-- Verifica se o usuário autenticado é owner do seu household
-- Usada nas policies de UPDATE/DELETE em recursos administrativos
-- ─────────────────────────────────────────────────────────────
create or replace function is_household_owner()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from household_members
    where user_id = auth.uid()
      and role = 'owner'
  );
$$;


-- ─────────────────────────────────────────────────────────────
-- Trigger function: atualiza updated_at automaticamente
-- Aplicada em todas as tabelas com coluna updated_at
-- ─────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

---

## 📦 Tabelas

### `households`
Unidade central de multi-tenancy. Cada household é um tenant isolado.

```sql
create table households (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null check (char_length(name) between 1 and 100),
  invite_code       text        unique,
  invite_expires_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_households_updated_at
  before update on households
  for each row execute function set_updated_at();
```

---

### `household_members`
Membros de cada household. Máximo de 2 por household (owner + member).

```sql
create table household_members (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references households(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  role         member_role not null default 'member',
  joined_at    timestamptz not null default now(),

  -- Um usuário pertence a apenas um household
  constraint uq_household_members_user unique (user_id),
  -- Sem duplicatas de usuário dentro do mesmo household
  constraint uq_household_members_pair unique (household_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- Trigger: impede mais de 2 membros por household
-- ─────────────────────────────────────────────────────────────
create or replace function check_household_member_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from household_members
    where household_id = new.household_id
  ) >= 2 then
    raise exception 'household_full'
      using hint = 'A household supports a maximum of 2 members.';
  end if;
  return new;
end;
$$;

create trigger trg_household_member_limit
  before insert on household_members
  for each row execute function check_household_member_limit();
```

---

### `user_profiles`
Dados de perfil estendidos além do `auth.users`. O `id` espelha `auth.users.id`.

```sql
create table user_profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text        check (char_length(full_name) <= 100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Trigger: cria user_profile automaticamente ao registrar usuário
-- Ativado via Supabase Auth Hook (Database Webhook em auth.users)
-- ─────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into user_profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

---

### `user_settings`
Preferências individuais de cada usuário.

```sql
create table user_settings (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        not null references auth.users(id) on delete cascade,
  household_id             uuid        not null references households(id) on delete cascade,
  financial_month_start_day int        not null default 1
                                        check (financial_month_start_day between 1 and 28),
  due_alert_days           int         not null default 3
                                        check (due_alert_days between 1 and 30),
  theme                    text        not null default 'system'
                                        check (theme in ('light', 'dark', 'system')),
  default_view_mode        view_mode   not null default 'personal',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint uq_user_settings_user unique (user_id)
);

create trigger trg_user_settings_updated_at
  before update on user_settings
  for each row execute function set_updated_at();
```

---

### `widget_preferences`
Configuração de ordem e visibilidade dos widgets do dashboard por usuário.

```sql
create table widget_preferences (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  household_id uuid        not null references households(id) on delete cascade,
  -- Estrutura: [{ "widget_id": "balance", "order": 1, "visible": true }, ...]
  config       jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint uq_widget_preferences_user unique (user_id)
);

create trigger trg_widget_preferences_updated_at
  before update on widget_preferences
  for each row execute function set_updated_at();
```

---

### `categories`
Categorias de despesas, configuradas por household.

```sql
create table categories (
  id           uuid           primary key default gen_random_uuid(),
  household_id uuid           not null references households(id) on delete cascade,
  name         text           not null check (char_length(name) between 1 and 60),
  icon         text,          -- nome do ícone (ex: "shopping-cart", "home")
  color        text           check (color ~ '^#[0-9A-Fa-f]{6}$'),
  scope        category_scope not null default 'both',
  is_default   boolean        not null default false,
  created_at   timestamptz    not null default now(),
  updated_at   timestamptz    not null default now(),

  constraint uq_category_name_per_household unique (household_id, name)
);

create trigger trg_categories_updated_at
  before update on categories
  for each row execute function set_updated_at();
```

---

### `fixed_bills`
Contas fixas recorrentes mensais.

```sql
create table fixed_bills (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references households(id) on delete cascade,
  author_id    uuid        not null references auth.users(id),
  category_id  uuid        references categories(id) on delete set null,
  name         text        not null check (char_length(name) between 1 and 100),
  amount       numeric(12,2) not null check (amount > 0),
  due_day      int         not null check (due_day between 1 and 28),
  status       bill_status not null default 'active',
  is_shared    boolean     not null default false,
  attachment_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_fixed_bills_updated_at
  before update on fixed_bills
  for each row execute function set_updated_at();
```

---

### `bill_value_history`
Histórico de alterações de valor de uma conta fixa. Populado via trigger.

```sql
create table bill_value_history (
  id         uuid        primary key default gen_random_uuid(),
  bill_id    uuid        not null references fixed_bills(id) on delete cascade,
  old_amount numeric(12,2) not null,
  new_amount numeric(12,2) not null,
  changed_by uuid        not null references auth.users(id),
  changed_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Trigger: loga no histórico sempre que o valor da conta muda
-- ─────────────────────────────────────────────────────────────
create or replace function log_bill_value_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.amount <> new.amount then
    insert into bill_value_history (bill_id, old_amount, new_amount, changed_by)
    values (new.id, old.amount, new.amount, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_fixed_bills_value_history
  after update of amount on fixed_bills
  for each row execute function log_bill_value_change();
```

---

### `bill_occurrences`
Lançamentos mensais gerados pela recorrência das contas fixas.

```sql
create table bill_occurrences (
  id              uuid              primary key default gen_random_uuid(),
  household_id    uuid              not null references households(id) on delete cascade,
  bill_id         uuid              not null references fixed_bills(id) on delete cascade,
  author_id       uuid              not null references auth.users(id),
  reference_month date              not null, -- sempre dia 01 (ex: 2025-04-01)
  amount          numeric(12,2)     not null check (amount > 0), -- snapshot do valor no mês
  due_date        date              not null, -- reference_month + (due_day - 1) days
  status          occurrence_status not null default 'pending',
  paid_at         timestamptz,
  created_at      timestamptz       not null default now(),
  updated_at      timestamptz       not null default now(),

  -- Apenas um lançamento por conta por mês
  constraint uq_bill_occurrence_per_month unique (bill_id, reference_month)
);

create trigger trg_bill_occurrences_updated_at
  before update on bill_occurrences
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Trigger: ao marcar como 'paid', preenche paid_at automaticamente
-- Ao desmarcar, limpa paid_at
-- ─────────────────────────────────────────────────────────────
create or replace function handle_occurrence_payment()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' and old.status <> 'paid' then
    new.paid_at = coalesce(new.paid_at, now());
  elsif new.status <> 'paid' then
    new.paid_at = null;
  end if;
  return new;
end;
$$;

create trigger trg_occurrence_payment
  before update of status on bill_occurrences
  for each row execute function handle_occurrence_payment();
```

---

### `installment_groups`
Agrupa parcelas de uma mesma compra parcelada.

```sql
create table installment_groups (
  id                uuid      primary key default gen_random_uuid(),
  household_id      uuid      not null references households(id) on delete cascade,
  author_id         uuid      not null references auth.users(id),
  category_id       uuid      references categories(id) on delete set null,
  description       text      not null check (char_length(description) between 1 and 200),
  total_amount      numeric(12,2) not null check (total_amount > 0),
  installment_count int       not null check (installment_count between 2 and 360),
  tags              text[]    not null default '{}',
  view_mode         view_mode not null default 'personal',
  created_at        timestamptz not null default now()
  -- Sem updated_at: grupo é imutável após criação
);
```

---

### `expenses`
Despesas variadas (avulsas ou parcelas de um grupo).

```sql
create table expenses (
  id                   uuid        primary key default gen_random_uuid(),
  household_id         uuid        not null references households(id) on delete cascade,
  author_id            uuid        not null references auth.users(id),
  category_id          uuid        references categories(id) on delete set null,
  installment_group_id uuid        references installment_groups(id) on delete set null,
  event_id             uuid        references events(id) on delete set null,
  description          text        not null check (char_length(description) between 1 and 200),
  amount               numeric(12,2) not null check (amount > 0),
  expense_date         date        not null,
  installment_number   int         check (installment_number >= 1),
  total_installments   int         check (total_installments >= 2),
  view_mode            view_mode   not null default 'personal',
  tags                 text[]      not null default '{}',
  attachment_url       text,
  is_paid              boolean     not null default false,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Garante consistência: parcela exige grupo e vice-versa
  constraint chk_installment_consistency check (
    (installment_group_id is null) = (installment_number is null)
  )
);

create trigger trg_expenses_updated_at
  before update on expenses
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Trigger: ao marcar expense como paga, registra paid_at
-- ─────────────────────────────────────────────────────────────
create or replace function handle_expense_payment()
returns trigger
language plpgsql
as $$
begin
  if new.is_paid = true and old.is_paid = false then
    new.paid_at = coalesce(new.paid_at, now());
  elsif new.is_paid = false then
    new.paid_at = null;
  end if;
  return new;
end;
$$;

create trigger trg_expense_payment
  before update of is_paid on expenses
  for each row execute function handle_expense_payment();
```

> ⚠️ **Nota**: `events` é referenciado aqui mas declarado abaixo. No script de migração real, declare `events` antes de `expenses`, ou use `ALTER TABLE` para adicionar a FK depois.

---

### `income_sources`
Fontes de renda recorrentes (salário, freelance fixo etc.).

```sql
create table income_sources (
  id            uuid            primary key default gen_random_uuid(),
  household_id  uuid            not null references households(id) on delete cascade,
  author_id     uuid            not null references auth.users(id),
  name          text            not null check (char_length(name) between 1 and 100),
  expected_amount numeric(12,2) not null check (expected_amount > 0),
  recurrence    recurrence_type not null default 'monthly',
  is_active     boolean         not null default true,
  created_at    timestamptz     not null default now(),
  updated_at    timestamptz     not null default now()
);

create trigger trg_income_sources_updated_at
  before update on income_sources
  for each row execute function set_updated_at();
```

---

### `income_entries`
Lançamentos reais de renda por mês (valor efetivamente recebido).

```sql
create table income_entries (
  id               uuid        primary key default gen_random_uuid(),
  household_id     uuid        not null references households(id) on delete cascade,
  author_id        uuid        not null references auth.users(id),
  income_source_id uuid        references income_sources(id) on delete set null,
  description      text        not null check (char_length(description) between 1 and 200),
  expected_amount  numeric(12,2) check (expected_amount > 0), -- null se renda extra pontual
  actual_amount    numeric(12,2) not null check (actual_amount > 0),
  reference_month  date        not null, -- sempre dia 01
  received_at      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_income_entries_updated_at
  before update on income_entries
  for each row execute function set_updated_at();
```

---

### `events`
Eventos financeiros planejados (viagem, mudança, compra grande).

```sql
create table events (
  id               uuid        primary key default gen_random_uuid(),
  household_id     uuid        not null references households(id) on delete cascade,
  author_id        uuid        not null references auth.users(id),
  name             text        not null check (char_length(name) between 1 and 100),
  type             event_type  not null default 'other',
  estimated_budget numeric(12,2) check (estimated_budget > 0),
  planned_date     date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_events_updated_at
  before update on events
  for each row execute function set_updated_at();
```

---

### `goals`
Metas financeiras (viagem, reserva de emergência etc.).

```sql
create table goals (
  id                   uuid        primary key default gen_random_uuid(),
  household_id         uuid        not null references households(id) on delete cascade,
  author_id            uuid        not null references auth.users(id),
  name                 text        not null check (char_length(name) between 1 and 100),
  target_amount        numeric(12,2) not null check (target_amount > 0),
  current_amount       numeric(12,2) not null default 0 check (current_amount >= 0),
  monthly_contribution numeric(12,2) check (monthly_contribution > 0),
  deadline             date,
  scope                goal_scope  not null default 'personal',
  is_completed         boolean     not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_goals_updated_at
  before update on goals
  for each row execute function set_updated_at();
```

---

### `goal_contributions`
Aportes mensais vinculados a uma meta.

```sql
create table goal_contributions (
  id              uuid        primary key default gen_random_uuid(),
  household_id    uuid        not null references households(id) on delete cascade,
  goal_id         uuid        not null references goals(id) on delete cascade,
  author_id       uuid        not null references auth.users(id),
  amount          numeric(12,2) not null check (amount > 0),
  reference_month date        not null, -- sempre dia 01
  contributed_at  timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  -- Apenas um aporte por usuário por meta por mês
  constraint uq_contribution_per_user_month unique (goal_id, author_id, reference_month)
);

-- ─────────────────────────────────────────────────────────────
-- Trigger: recalcula goals.current_amount após INSERT/UPDATE/DELETE
-- de goal_contributions
-- ─────────────────────────────────────────────────────────────
create or replace function sync_goal_current_amount()
returns trigger
language plpgsql
security definer
as $$
declare
  v_goal_id uuid;
begin
  v_goal_id = coalesce(new.goal_id, old.goal_id);

  update goals
  set
    current_amount = (
      select coalesce(sum(amount), 0)
      from goal_contributions
      where goal_id = v_goal_id
    ),
    is_completed = (
      select coalesce(sum(amount), 0) >= target_amount
      from goals
      where id = v_goal_id
    )
  where id = v_goal_id;

  return coalesce(new, old);
end;
$$;

create trigger trg_goal_contributions_sync
  after insert or update or delete on goal_contributions
  for each row execute function sync_goal_current_amount();
```

---

### `monthly_notes`
Notas mensais livres por usuário (contexto do mês).

```sql
create table monthly_notes (
  id              uuid        primary key default gen_random_uuid(),
  household_id    uuid        not null references households(id) on delete cascade,
  author_id       uuid        not null references auth.users(id),
  reference_month date        not null, -- sempre dia 01
  content         text        not null check (char_length(content) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Uma nota por usuário por mês
  constraint uq_monthly_note_per_user unique (household_id, author_id, reference_month)
);

create trigger trg_monthly_notes_updated_at
  before update on monthly_notes
  for each row execute function set_updated_at();
```

---

## 📇 Índices

Criados separadamente das tabelas para clareza. Seguem o princípio: **indexar o que é filtrado com frequência**, não tudo.

```sql
-- ── household_members ────────────────────────────────────────
-- Lookup mais frequente do sistema (chamado em toda RLS policy)
create index idx_household_members_user_id
  on household_members(user_id);

create index idx_household_members_household_id
  on household_members(household_id);

-- ── households ───────────────────────────────────────────────
-- Busca por invite_code na tela de onboarding
create index idx_households_invite_code
  on households(invite_code)
  where invite_code is not null;

-- ── categories ───────────────────────────────────────────────
create index idx_categories_household_id
  on categories(household_id);

-- ── fixed_bills ──────────────────────────────────────────────
-- Consultas de listagem filtrando por household + status
create index idx_fixed_bills_household_status
  on fixed_bills(household_id, status);

create index idx_fixed_bills_author_id
  on fixed_bills(author_id);

create index idx_fixed_bills_category_id
  on fixed_bills(category_id);

-- ── bill_value_history ───────────────────────────────────────
create index idx_bill_value_history_bill_id
  on bill_value_history(bill_id);

-- ── bill_occurrences ─────────────────────────────────────────
-- Dashboard: saldo do mês, contas a vencer
create index idx_bill_occurrences_household_month
  on bill_occurrences(household_id, reference_month);

-- Busca de lançamentos pendentes/atrasados (alertas)
create index idx_bill_occurrences_status
  on bill_occurrences(status)
  where status in ('pending', 'overdue');

create index idx_bill_occurrences_bill_id
  on bill_occurrences(bill_id);

-- ── expenses ─────────────────────────────────────────────────
-- Consulta por período (filtro principal de relatórios)
create index idx_expenses_household_date
  on expenses(household_id, expense_date);

-- Filtros por categoria e autor
create index idx_expenses_category_id
  on expenses(category_id);

create index idx_expenses_author_id
  on expenses(author_id);

-- Busca de parcelas de um grupo
create index idx_expenses_installment_group_id
  on expenses(installment_group_id)
  where installment_group_id is not null;

-- Gastos vinculados a um evento
create index idx_expenses_event_id
  on expenses(event_id)
  where event_id is not null;

-- Busca por tags (GIN para arrays)
create index idx_expenses_tags
  on expenses using gin(tags);

-- ── income_sources ───────────────────────────────────────────
create index idx_income_sources_household_id
  on income_sources(household_id);

create index idx_income_sources_author_id
  on income_sources(author_id);

-- ── income_entries ───────────────────────────────────────────
-- Dashboard: renda total do mês
create index idx_income_entries_household_month
  on income_entries(household_id, reference_month);

create index idx_income_entries_source_id
  on income_entries(income_source_id)
  where income_source_id is not null;

-- ── goals ────────────────────────────────────────────────────
create index idx_goals_household_id
  on goals(household_id);

-- ── goal_contributions ───────────────────────────────────────
create index idx_goal_contributions_goal_id
  on goal_contributions(goal_id);

create index idx_goal_contributions_household_month
  on goal_contributions(household_id, reference_month);

-- ── events ───────────────────────────────────────────────────
create index idx_events_household_id
  on events(household_id);

-- ── monthly_notes ────────────────────────────────────────────
create index idx_monthly_notes_household_month
  on monthly_notes(household_id, reference_month);

-- ── user_settings ────────────────────────────────────────────
create index idx_user_settings_household_id
  on user_settings(household_id);
```

---

## ⚙️ Functions de Negócio

### `generate_bill_occurrences` — Geração de Recorrências

Chamada pelo `pg_cron` na virada de cada mês. Gera os lançamentos do próximo mês para todas as contas fixas ativas.

```sql
create or replace function generate_bill_occurrences(p_reference_month date)
returns void
language plpgsql
security definer
as $$
begin
  -- Garante que p_reference_month seja sempre o dia 1
  p_reference_month := date_trunc('month', p_reference_month)::date;

  insert into bill_occurrences (
    household_id,
    bill_id,
    author_id,
    reference_month,
    amount,
    due_date
  )
  select
    fb.household_id,
    fb.id,
    fb.author_id,
    p_reference_month,
    fb.amount,
    -- Compõe a due_date: primeiro dia do mês + (due_day - 1)
    (p_reference_month + (fb.due_day - 1) * interval '1 day')::date
  from fixed_bills fb
  where fb.status = 'active'
  -- Evita duplicatas (a constraint de unique já protege, mas on conflict é mais elegante)
  on conflict (bill_id, reference_month) do nothing;
end;
$$;
```

### `mark_overdue_occurrences` — Marcar Atrasadas

Chamada diariamente pelo `pg_cron`. Marca como `overdue` os lançamentos vencidos não pagos.

```sql
create or replace function mark_overdue_occurrences()
returns void
language plpgsql
security definer
as $$
begin
  update bill_occurrences
  set status = 'overdue'
  where status = 'pending'
    and due_date < current_date;
end;
$$;
```

### `join_household_by_invite` — Entrar em um Household

Valida e consome o `invite_code`. Chamada via Edge Function para evitar exposição no cliente.

```sql
create or replace function join_household_by_invite(p_invite_code text)
returns uuid -- retorna o household_id em caso de sucesso
language plpgsql
security definer
as $$
declare
  v_household_id uuid;
begin
  -- Busca household com invite válido e não expirado
  select id into v_household_id
  from households
  where invite_code = p_invite_code
    and (invite_expires_at is null or invite_expires_at > now());

  if v_household_id is null then
    raise exception 'invalid_or_expired_invite'
      using hint = 'The invite code is invalid or has expired.';
  end if;

  -- Verifica se já tem 2 membros (o trigger também protege, mas melhor mensagem aqui)
  if (select count(*) from household_members where household_id = v_household_id) >= 2 then
    raise exception 'household_full'
      using hint = 'This household already has 2 members.';
  end if;

  -- Verifica se o usuário já pertence a algum household
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'user_already_in_household'
      using hint = 'You are already a member of a household.';
  end if;

  -- Insere o membro
  insert into household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'member');

  -- Invalida o invite_code após uso
  update households
  set invite_code = null, invite_expires_at = null
  where id = v_household_id;

  -- Cria configurações padrão para o novo usuário
  insert into user_settings (user_id, household_id)
  values (auth.uid(), v_household_id)
  on conflict (user_id) do nothing;

  return v_household_id;
end;
$$;
```

### `calculate_monthly_balance` — Saldo Mensal (RPC para Dashboard)

```sql
create or replace function calculate_monthly_balance(p_reference_month date)
returns table (
  total_income   numeric,
  total_expenses numeric,
  total_bills    numeric,
  balance        numeric
)
language plpgsql
security definer
stable
as $$
declare
  v_household_id uuid := get_user_household_id();
  v_month        date := date_trunc('month', p_reference_month)::date;
begin
  return query
  select
    coalesce(ie.total, 0)  as total_income,
    coalesce(ex.total, 0)  as total_expenses,
    coalesce(bo.total, 0)  as total_bills,
    coalesce(ie.total, 0) - coalesce(ex.total, 0) - coalesce(bo.total, 0) as balance
  from
    (select sum(actual_amount) as total
     from income_entries
     where household_id = v_household_id
       and reference_month = v_month) ie,
    (select sum(amount) as total
     from expenses
     where household_id = v_household_id
       and date_trunc('month', expense_date)::date = v_month) ex,
    (select sum(amount) as total
     from bill_occurrences
     where household_id = v_household_id
       and reference_month = v_month) bo;
end;
$$;
```

### `calculate_health_score` — Score de Saúde Financeira (RPC)

```sql
create or replace function calculate_health_score(p_reference_month date)
returns table (
  score           int,
  balance_ok      boolean,
  goals_on_track  boolean,
  bills_on_time   boolean
)
language plpgsql
security definer
stable
as $$
declare
  v_household_id uuid := get_user_household_id();
  v_month        date := date_trunc('month', p_reference_month)::date;
  v_balance_ok   boolean;
  v_goals_ok     boolean;
  v_bills_ok     boolean;
  v_score        int := 0;
begin
  -- Critério 1: Saldo positivo no mês (40 pontos)
  select (coalesce(ie.total, 0) - coalesce(ex.total, 0) - coalesce(bo.total, 0)) > 0
  into v_balance_ok
  from
    (select sum(actual_amount) as total from income_entries
     where household_id = v_household_id and reference_month = v_month) ie,
    (select sum(amount) as total from expenses
     where household_id = v_household_id
       and date_trunc('month', expense_date)::date = v_month) ex,
    (select sum(amount) as total from bill_occurrences
     where household_id = v_household_id and reference_month = v_month) bo;

  -- Critério 2: Metas com aporte realizado no mês (30 pontos)
  select not exists (
    select 1 from goals g
    where g.household_id = v_household_id
      and g.is_completed = false
      and g.monthly_contribution is not null
      and not exists (
        select 1 from goal_contributions gc
        where gc.goal_id = g.id
          and gc.reference_month = v_month
      )
  ) into v_goals_ok;

  -- Critério 3: Contas pagas sem atraso (30 pontos)
  select not exists (
    select 1 from bill_occurrences
    where household_id = v_household_id
      and reference_month = v_month
      and status = 'overdue'
  ) into v_bills_ok;

  if v_balance_ok then v_score := v_score + 40; end if;
  if v_goals_ok   then v_score := v_score + 30; end if;
  if v_bills_ok   then v_score := v_score + 30; end if;

  return query select v_score, v_balance_ok, v_goals_ok, v_bills_ok;
end;
$$;
```

---

## 🕐 Jobs pg_cron

```sql
-- Habilitar extensão (via Supabase Dashboard ou migration)
create extension if not exists pg_cron;

-- Gerar lançamentos do próximo mês — roda no 1º dia de cada mês às 00:01
select cron.schedule(
  'generate-monthly-bill-occurrences',
  '1 0 1 * *',
  $$select generate_bill_occurrences(date_trunc('month', now())::date)$$
);

-- Marcar lançamentos atrasados — roda todos os dias às 01:00
select cron.schedule(
  'mark-overdue-occurrences',
  '0 1 * * *',
  $$select mark_overdue_occurrences()$$
);
```

---

## 🔐 Row Level Security & Policies

### Habilitar RLS em todas as tabelas

```sql
alter table households           enable row level security;
alter table household_members    enable row level security;
alter table user_profiles        enable row level security;
alter table user_settings        enable row level security;
alter table widget_preferences   enable row level security;
alter table categories           enable row level security;
alter table fixed_bills          enable row level security;
alter table bill_value_history   enable row level security;
alter table bill_occurrences     enable row level security;
alter table installment_groups   enable row level security;
alter table expenses             enable row level security;
alter table income_sources       enable row level security;
alter table income_entries       enable row level security;
alter table events               enable row level security;
alter table goals                enable row level security;
alter table goal_contributions   enable row level security;
alter table monthly_notes        enable row level security;
```

---

### Policies: `households`

```sql
-- Membros veem apenas o seu próprio household
create policy "households_select"
  on households for select
  using (
    id = get_user_household_id()
  );

-- Owner pode atualizar o household (nome, invite_code etc.)
create policy "households_update"
  on households for update
  using (
    id = get_user_household_id() and is_household_owner()
  );

-- Qualquer autenticado pode criar um household (onboarding)
create policy "households_insert"
  on households for insert
  with check (true);

-- Owner pode deletar o household
create policy "households_delete"
  on households for delete
  using (
    id = get_user_household_id() and is_household_owner()
  );
```

---

### Policies: `household_members`

```sql
-- Membros veem os colegas do mesmo household
create policy "household_members_select"
  on household_members for select
  using (
    household_id = get_user_household_id()
  );

-- Qualquer autenticado pode se inserir via função (onboarding)
-- A validação real é feita pela função join_household_by_invite
create policy "household_members_insert"
  on household_members for insert
  with check (
    user_id = auth.uid()
  );

-- Owner pode atualizar papéis
create policy "household_members_update"
  on household_members for update
  using (
    household_id = get_user_household_id() and is_household_owner()
  );

-- Owner pode remover membros (exceto a si mesmo)
create policy "household_members_delete"
  on household_members for delete
  using (
    household_id = get_user_household_id()
    and is_household_owner()
    and user_id <> auth.uid()
  );
```

---

### Policies: `user_profiles`

```sql
-- Usuário vê apenas o próprio perfil e o do parceiro do household
create policy "user_profiles_select"
  on user_profiles for select
  using (
    id = auth.uid()
    or id in (
      select user_id from household_members
      where household_id = get_user_household_id()
    )
  );

-- Usuário edita apenas o próprio perfil
create policy "user_profiles_update"
  on user_profiles for update
  using (id = auth.uid());

-- Insert via trigger (handle_new_user) — sem policy de insert para usuário direto
create policy "user_profiles_insert"
  on user_profiles for insert
  with check (id = auth.uid());
```

---

### Policies: `user_settings` & `widget_preferences`
*(políticas idênticas para ambas — escopo por usuário)*

```sql
-- user_settings
create policy "user_settings_all"
  on user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- widget_preferences
create policy "widget_preferences_all"
  on widget_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

---

### Macro-policy de Household Isolation
*Aplicada às tabelas de domínio: `categories`, `fixed_bills`, `bill_occurrences`, `installment_groups`, `expenses`, `income_sources`, `income_entries`, `events`, `goals`, `goal_contributions`, `monthly_notes`*

```sql
-- ─────────────────────────────────────────────────────────────
-- Padrão repetido para cada tabela de domínio.
-- Substitua <table_name> pelo nome da tabela.
-- ─────────────────────────────────────────────────────────────

create policy "<table_name>_select"
  on <table_name> for select
  using (household_id = get_user_household_id());

create policy "<table_name>_insert"
  on <table_name> for insert
  with check (
    household_id = get_user_household_id()
    and author_id = auth.uid()
  );

create policy "<table_name>_update"
  on <table_name> for update
  using (household_id = get_user_household_id());

create policy "<table_name>_delete"
  on <table_name> for delete
  using (household_id = get_user_household_id());
```

> **Exemplo concreto para `fixed_bills`:**

```sql
create policy "fixed_bills_select"
  on fixed_bills for select
  using (household_id = get_user_household_id());

create policy "fixed_bills_insert"
  on fixed_bills for insert
  with check (
    household_id = get_user_household_id()
    and author_id = auth.uid()
  );

create policy "fixed_bills_update"
  on fixed_bills for update
  using (household_id = get_user_household_id());

create policy "fixed_bills_delete"
  on fixed_bills for delete
  using (household_id = get_user_household_id());
```

---

### Policies: `bill_value_history`

```sql
-- Histórico é read-only para o usuário (write ocorre via trigger)
create policy "bill_value_history_select"
  on bill_value_history for select
  using (
    bill_id in (
      select id from fixed_bills
      where household_id = get_user_household_id()
    )
  );

-- Nenhum usuário pode inserir/atualizar/deletar diretamente
-- Escrita exclusiva via trigger (log_bill_value_change)
```

---

## 🔑 Grants

```sql
-- ─────────────────────────────────────────────────────────────
-- SCHEMA: usuários autenticados podem usar o schema public
-- ─────────────────────────────────────────────────────────────
grant usage on schema public to authenticated;
grant usage on schema public to anon;

-- ─────────────────────────────────────────────────────────────
-- TABELAS: authenticated pode operar em tabelas de domínio
-- anon não tem acesso a nenhuma tabela de domínio
-- ─────────────────────────────────────────────────────────────
grant select, insert, update, delete on table
  households,
  household_members,
  user_profiles,
  user_settings,
  widget_preferences,
  categories,
  fixed_bills,
  bill_occurrences,
  installment_groups,
  expenses,
  income_sources,
  income_entries,
  events,
  goals,
  goal_contributions,
  monthly_notes
to authenticated;

-- bill_value_history: apenas leitura para usuário (escrita via trigger/service_role)
grant select on table bill_value_history to authenticated;

-- ─────────────────────────────────────────────────────────────
-- FUNCTIONS: authenticated pode chamar as RPCs públicas
-- ─────────────────────────────────────────────────────────────
grant execute on function get_user_household_id()          to authenticated;
grant execute on function is_household_owner()             to authenticated;
grant execute on function join_household_by_invite(text)   to authenticated;
grant execute on function calculate_monthly_balance(date)  to authenticated;
grant execute on function calculate_health_score(date)     to authenticated;

-- Funções de sistema: apenas service_role (pg_cron, Edge Functions)
grant execute on function generate_bill_occurrences(date)  to service_role;
grant execute on function mark_overdue_occurrences()       to service_role;

-- ─────────────────────────────────────────────────────────────
-- SEQUENCES: necessário para tabelas sem uuid default (não se aplica aqui)
-- Mantido como referência caso sequences sejam adicionadas
-- ─────────────────────────────────────────────────────────────
-- grant usage on all sequences in schema public to authenticated;
```

---

## 🗺️ Diagrama de Relacionamentos (Resumo)

```
auth.users
    │
    ├──► user_profiles (1:1)
    ├──► user_settings (1:1)
    └──► widget_preferences (1:1)
         │
         └──► household_members ◄──────────────────── households
                                                           │
                    ┌──────────────────────────────────────┤
                    │                                       │
               [household_id em todas as tabelas abaixo]   │
                    │                                       │
                    ├── categories                          │
                    ├── fixed_bills ──► bill_value_history  │
                    │       └──► bill_occurrences           │
                    ├── installment_groups                  │
                    │       └──► expenses ◄── events        │
                    ├── income_sources                      │
                    │       └──► income_entries             │
                    ├── goals                               │
                    │       └──► goal_contributions         │
                    └── monthly_notes                       │
```

---

## 📎 Documentos Relacionados

- `REQUIREMENTS.md` — Requisitos funcionais
- `STACK.md` — Decisões técnicas de arquitetura
- `RLS.md` — (este documento já cobre as RLS; arquivo separado opcional para documentação detalhada)