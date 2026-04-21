# Especificação do Módulo: 02-household-onboarding

> **Status**: Spec Revisado · Pronto para TDD (28 ACs / 32 cenários Gherkin)
> **Spec criado em**: 2026-04-21
> **Última revisão crítica**: 2026-04-21 (round 2 — spec-review aplicado)
> **Gerado por**: spec-architect (a partir de `/spec-draft "Onboarding de household + invite code"`)

---

## 📋 Objetivo

Implementar a criação de household, geração/regeneração de invite code (alfanumérico curto, válido por 48h), entrada via código, gerenciamento de membros (roles owner/member, soft delete para saída/remoção), audit trail completo de ações de membership, e popular `householdId` no `useAuthStore` — completando o fluxo de onboarding pós-cadastro.

### Princípios Arquiteturais (decisões tomadas)

Este spec formaliza **4 decisões arquiteturais** que atravessam o módulo inteiro. Todas as tarefas do TDD devem respeitá-las:

1. **Fonte de verdade do `householdId`**: sempre resolvida server-side via a query `getCurrentHousehold()` que internamente consulta `get_user_household_id()`. O cliente **nunca** escolhe um `householdId` — ele apenas consome o resultado. O store `useAuthStore` ganha um setter dedicado `setHouseholdId(id | null)` (não é atalho para `setState` direto).
2. **Audit trail via RPC, não via INSERT direto do cliente**: todos os INSERTs em `household_member_audit` ocorrem dentro de RPCs `SECURITY DEFINER` na mesma transação da mutação correspondente. A RLS de INSERT no audit é **defesa em profundidade** — a lógica de autorização vive no RPC.
3. **Identidade single-source-of-truth em `household_members`**: `user_profiles` **NÃO** recebe coluna `household_id`. A tabela `household_members` com o índice parcial único `(user_id) WHERE left_at IS NULL` é a única fonte de verdade de "em qual household este usuário está ativo". Qualquer denormalização futura passa por ADR.
4. **Erros de domínio distintos para o usuário autenticado**: um usuário **logado** tem direito a saber seu próprio estado (já pertence a um household, rate-limited, etc.). A Lei 9 (no leak) aplica-se apenas ao par "código inválido vs expirado" — este é o único caso em que a mensagem é deliberadamente genérica.

---

## 👥 Personas & Casos de Uso

### Personas Envolvidas

- **Maria (novo usuário, futuro owner)**: Acabou de criar conta, não pertence a nenhum household. Quer criar seu próprio lar para começar a organizar finanças.
- **João (novo usuário, futuro member)**: Acabou de criar conta, recebeu código de convite da Maria. Quer entrar no household dela.
- **Carlos (member ativo)**: Já faz parte de um household, pode decidir sair voluntariamente.
- **Ana (usuário com código inválido)**: Tenta usar um código expirado ou incorreto.
- **Pedro (usuário solo)**: Quer usar o app sozinho, sem criar household formal.

### Casos de Uso

- **UC-1**: Maria acessa `/onboarding` após cadastro, escolhe "Criar household", preenche nome "Casa Silva", clica "Criar". Resultado: household criado com Maria como `owner`, invite code gerado, audit `joined` registrado, `useAuthStore.householdId` populado, redirecionada para `/dashboard`.

- **UC-2**: João acessa `/onboarding` após cadastro, escolhe "Tenho um código", digita `ABC123` (código da Maria), clica "Entrar". Resultado: validação OK, vinculado ao household "Casa Silva" como `member`, audit `joined` registrado, `useAuthStore.householdId` populado, redirecionado para `/dashboard`.

- **UC-3**: Maria (owner) acessa "Configurações > Household", clica em "Regenerar código". Resultado: código anterior invalidado, novo código `XYZ789` gerado com validade de 48h, exibido na tela com opção de copiar.

- **UC-4**: João (member) acessa "Configurações > Household", clica em "Sair do household". Resultado: soft delete em `household_members` (campo `left_at` preenchido), audit `left` registrado com `performed_by = João`, `useAuthStore.householdId` resetado para `null`, redirecionado para `/onboarding`.

- **UC-5**: Maria (owner) acessa "Membros", vê Carlos na lista, clica em "Remover". Resultado: soft delete de Carlos, audit `removed` registrado com `performed_by = Maria`, Carlos perde acesso imediato (próximo request verifica `left_at`).

- **UC-6**: Ana acessa `/onboarding`, escolhe "Tenho um código", digita `XYZ999` (código inválido ou expirado), clica "Entrar". Resultado: erro "Código inválido ou expirado" exibido, formulário permanece na tela.

- **UC-7**: Pedro acessa `/onboarding`, clica em "Pular por enquanto" (link secundário). Resultado: household "Meu Lar" criado automaticamente, Pedro é owner, audit `joined` registrado, redirecionado para `/dashboard`.

- **UC-8**: Maria (owner) acessa "Membros", vê lista com: Maria (owner, ativo), João (member, ativo), Carlos (member, inativo - saiu). Cada linha mostra role, status e data de entrada.

- **UC-9**: Maria (owner) acessa "Histórico de membros", vê timeline: "João entrou em 15/04 às 14:30", "Carlos removido por Maria em 18/04 às 10:00", etc. Cada entrada mostra ação, quem foi afetado, quem executou e quando.

---

## ⚖️ Regras de Negócio

### Criação de Household

- **RN-1**: Household obrigatoriamente tem: `name` (1-100 chars), `owner_id` (de `auth.uid()`), `invite_code` (gerado automaticamente), `invite_code_expires_at` (now + 48h). Ausência de `name` = rejeição.

- **RN-2**: Nome do household não precisa ser único globalmente. Dois households podem ter o mesmo nome.

- **RN-3**: Ao criar household, o criador é automaticamente inserido em `household_members` com `role = 'owner'` NA MESMA transação.

- **RN-4**: Ao criar household, registro de audit `joined` é inserido em `household_member_audit` NA MESMA transação.

### Invite Code

- **RN-5**: Invite code é string de 6 caracteres alfanuméricos uppercase. Charset: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem 0/O, 1/I/L para evitar confusão visual). Entropia teórica: 32⁶ ≈ 1,07 bilhão.

- **RN-5.1**: A geração usa `gen_random_bytes()` (CSPRNG do pgcrypto), **não** `random()`. Motivo: `random()` do Postgres é determinístico a partir de um seed fraco e reduz a entropia efetiva do código contra um atacante observador. O mapping bytes→charset usa rejection sampling para evitar módulo-bias.

- **RN-6**: Invite code é único globalmente (constraint UNIQUE na tabela).

- **RN-7**: Invite code expira em 48 horas após geração. Campo `invite_code_expires_at` armazena o timestamp de expiração em UTC.

- **RN-8**: Código expirado não pode ser usado para join. Validação verifica `invite_code_expires_at > now()`.

- **RN-9**: Apenas o `owner` pode regenerar o invite code. Regeneração atualiza `invite_code` e `invite_code_expires_at` (novo período de 48h).

- **RN-10**: Ao regenerar, o código anterior se torna inválido imediatamente (UPDATE na mesma row). Regenerações concorrentes (duas abas do mesmo owner) são serializadas pelo `UPDATE ... RETURNING` no Postgres; a última escrita vence e ambas as respostas carregam o código efetivamente persistido.

### Entrada via Código (Join)

- **RN-11**: Usuário só pode entrar em um household se não pertencer a nenhum (ou se saiu do anterior com `left_at` preenchido).

- **RN-12**: Ao fazer join, usuário é inserido em `household_members` com `role = 'member'`.

- **RN-13**: Ao fazer join, registro de audit `joined` é inserido com `performed_by = auth.uid()`.

- **RN-14**: Tentativa de join com código inválido ou expirado retorna erro genérico "Código inválido ou expirado" (não revela se código existe mas expirou).

- **RN-15**: Rate-limit de 5 tentativas de join por minuto por usuário (anti brute-force). Implementado no RPC de join com contador em `join_rate_limits` (`user_id`, `window_bucket`, `attempt_count`). Retorna erro `429 / code='RATE_LIMITED'` se exceder. O incremento é feito por `INSERT ... ON CONFLICT (user_id, window_bucket) DO UPDATE SET attempt_count = attempt_count + 1` — atômico e idempotente contra retries.

- **RN-15.1**: Input de código é normalizado para UPPERCASE antes de lookup (case insensitive para o usuário). Espaços em branco no início/fim são ignorados (`trim()`).

- **RN-15.2**: Rate-limit é aplicado **apenas para falhas** (código inválido/expirado). Joins bem-sucedidos não incrementam o contador — evita punir usuário legítimo que acerta na primeira tentativa.

- **RN-15.3**: Rate-limit por `user_id` não protege contra atacante com múltiplas contas (registro livre). Mitigações adicionais (rate-limit por IP no Supabase Edge, captcha) ficam **fora de escopo** deste módulo e são tracked como TODO no módulo futuro de segurança. A entropia do código (32⁶) já torna brute-force multi-conta inviável: ao custo de 7.200 tentativas/dia/conta, seriam necessárias milhões de contas para ter chance razoável em 48h.

- **RN-15.4**: A tabela `join_rate_limits` é garbage-collected por um trigger `BEFORE INSERT` que apaga buckets com `window_bucket < now() - interval '1 hour'`. Custo amortizado O(1) sem precisar de cron externo.

### Pular Onboarding

- **RN-16**: "Pular onboarding" cria household com nome default "Meu Lar" e usuário como owner.

- **RN-17**: Household solo segue todas as mesmas regras (tem invite code, pode convidar depois).

- **RN-17.1**: Usuário que já pertence a um household e tenta entrar em outro via código deve primeiro sair do household atual. Exibir mensagem **"Você já pertence a um household. Saia primeiro para entrar em outro."** (erro code `ALREADY_MEMBER`).

- **RN-17.2 (Lei 9 — exceção intencional)**: A mensagem de RN-17.1 revela estado do próprio usuário autenticado. Isso é intencional: um usuário logado tem direito a conhecer seu próprio estado de membership. A garantia de não-leak (Lei 9) aplica-se apenas ao par "código inválido vs código expirado" (RN-14), em que o atacante sonda existência de recursos de terceiros.

### Membros e Saída

- **RN-18**: Member pode sair voluntariamente a qualquer momento. Preenche `left_at = now()` (soft delete).

- **RN-19**: Owner pode remover qualquer member (exceto a si mesmo). Preenche `left_at = now()`.

- **RN-20**: Owner não pode sair enquanto houver outros membros ativos. Deve transferir ownership primeiro (fora de escopo deste módulo).

- **RN-21**: Owner não pode se auto-remover.

- **RN-22**: Dados criados pelo member (despesas, contas) permanecem no household após saída. Queries futuras que resolvem "quem criou este registro" devem fazer JOIN em `household_members` **incluindo `left_at IS NOT NULL`** para exibir nome de ex-membros (com flag UI de "ex-membro"). Módulos 04-08 (despesas/contas/parcelas) devem adotar essa semântica.

- **RN-22.1**: Após `leave`/`remove`, React Query invalida no cliente: `household`, `household-members`, `household-audit`, e queries específicas do usuário removido. A sessão **não** é derrubada — apenas `householdId` é resetado e o usuário volta a `/onboarding`.

- **RN-23**: Usuário que saiu pode re-entrar usando novo invite code. Cria NOVO registro em `household_members` (histórico preservado).

### Audit Trail

- **RN-24**: Toda ação de membership (join, leave, remove) gera registro em `household_member_audit`.

- **RN-25**: Audit trail é imutável: apenas INSERT permitido, sem UPDATE ou DELETE.

- **RN-26**: Apenas owner pode visualizar audit trail do household.

- **RN-27**: Audit trail retorna dados mínimos: ação, timestamp, nome do afetado, nome de quem executou. Sem emails ou IDs internos expostos. O endpoint faz JOIN com `user_profiles` para resolver UUIDs em nomes.

### Store e Redirect

- **RN-28**: A mutação/resolução do `householdId` no `useAuthStore` **sempre** passa pelo setter controlado `setHouseholdId(id | null)`. Não há `setState({ householdId })` direto em componentes/hooks. Isso preserva a invariante de Lei 1/9 do store (apenas caminhos documentados mutam a sessão).

- **RN-28.1**: Fluxo de populate:
  1. `AuthBootstrap` → após `setSession(session)`, dispara `useCurrentHousehold()` (React Query) que chama RPC `get_current_household()`.
  2. No `onSuccess`, `setHouseholdId(data?.household_id ?? null)`.
  3. Mutations (`useCreateHousehold`, `useJoinHousehold`, `useSkipOnboarding`) chamam `setHouseholdId(novoId)` **e** `queryClient.invalidateQueries({ queryKey: ['current-household'] })` no `onSuccess`, garantindo que o store e o cache não divirjam.

- **RN-28.2**: Fluxo de reset:
  1. `useLeaveHousehold`/`useRemoveMember` (caso o target seja `auth.uid()`): `setHouseholdId(null)` no `onSuccess` + `queryClient.removeQueries()` com predicate que limpa queries dependentes de household.
  2. `useAuthStore.reset()` (logout) já zera `householdId` por padrão — nenhum código adicional é necessário.

- **RN-29**: Se `householdId === null` e usuário tenta acessar rota protegida que requer household, redireciona para `/onboarding`. A checagem é feita no `<ProtectedRoute requiresHousehold />` — rotas de onboarding definem `requiresHousehold={false}`.

- **RN-30**: Se `householdId !== null`, acesso a `/onboarding` redireciona para `/dashboard`.

- **RN-30.1**: Enquanto `useCurrentHousehold` está em flight (`isLoading === true`) **e** `isAuthenticated === true` **e** `householdId === null`, o `<ProtectedRoute>` renderiza estado de loading — **não** redireciona para `/onboarding`. Evita flash de onboarding em usuários que já têm household mas cujo cache ainda não resolveu.

### Invite Code — Geração e Colisão

- **RN-31**: Função `generate_invite_code()` gera código de 6 chars uppercase do charset (ver RN-5) usando `gen_random_bytes()` + rejection sampling. A função **não** consulta `households` — ela apenas gera bytes aleatórios. A unicidade é garantida pela constraint `UNIQUE` na tabela. Tanto `create_household` quanto `regenerate_invite_code` tratam `unique_violation` (SQLSTATE 23505) em bloco `EXCEPTION` com retry transacional automático até 5x. Após 5 falhas, `raise exception 'GENERATION_FAILED' using errcode = 'P0001'` e o cliente exibe "Não foi possível gerar código, tente novamente."

- **RN-32**: Invite code permite múltiplos joins simultâneos. Não é single-use. Qualquer número de usuários pode entrar com o mesmo código enquanto válido (não expirado).

### Segurança e Sanitização

- **RN-33**: Nome do household é sanitizado no back-end: `trim()` aplicado, máximo 100 chars enforced. React escapa automaticamente no render, prevenindo XSS.

- **RN-34**: Timestamps de expiração (`invite_code_expires_at`) e audit (`performed_at`) são armazenados em UTC (`timestamptz`). A UI exibe em timezone local do navegador usando `Intl.DateTimeFormat('pt-BR', ...)`.

- **RN-34.1 (formato canônico de datas na UI)**:
  - **Data absoluta curta** (tabelas, linhas de audit): `dd/MM às HH:mm` (ex.: "15/04 às 14:30"). Omite ano quando o evento ocorreu no ano corrente.
  - **Data absoluta completa** (tooltip, detalhe): `dd/MM/yyyy 'às' HH:mm` (ex.: "15/04/2026 às 14:30").
  - **Expiração de invite code**: texto "Válido até dd/MM/yyyy 'às' HH:mm" + sub-linha relativa "(em ~Xh)" gerada por utilitário `formatRelativeExpiry()`.
  - **Nunca** exibir "há X horas" sem backup da data absoluta (acessibilidade).

- **RN-34.2 (clipboard)**: Botão "Copiar código" usa `navigator.clipboard.writeText()` com feedback visual: ícone muda para ✓ e label para "Copiado!" por 2s. Fallback em navegadores sem `clipboard` (contexto HTTP inseguro, permissões bloqueadas): abre um `<input readOnly>` pré-selecionado com instrução "Pressione Ctrl+C / Cmd+C para copiar". Sucesso/falha não bloqueia o fluxo — é auxiliar.

### Edge Cases de Deleção

- **RN-35**: Owner não pode deletar sua conta enquanto for owner de um household com outros membros ativos. A trigger `before_user_delete` levanta exceção nesse cenário (nome de erro `OWNER_HAS_MEMBERS`). UI traduz: **"Transfira a ownership ou remova todos os membros antes de deletar sua conta."**

- **RN-36**: Se owner de household solo (sem outros membros ativos) deletar conta, o household é deletado em cascata via trigger `before_user_delete`, arrastando `household_members` e `household_member_audit` por `ON DELETE CASCADE`.

- **RN-36.1 (race em `handle_owner_delete`)**: A trigger roda `SELECT ... FROM household_members ... FOR UPDATE` no bloco de contagem, adquirindo lock de linha nos membros do household. Isso previne race "owner deleta conta enquanto novo member entra". Trade-off aceito: lock curto (single-row scan), impacto desprezível em throughput.

---

## 🔌 Contratos de RPCs (API pública do módulo)

Todos os RPCs são **`LANGUAGE plpgsql`**, **`SECURITY DEFINER`** com `SET search_path = public, pg_temp`, e transacionais por default. Identidade **sempre** vem de `auth.uid()` internamente — nenhum parâmetro de usuário é aceito do cliente (Lei 1). Todos aceitam apenas os parâmetros listados abaixo — parâmetros extras no payload são rejeitados pelo PostgREST.

### `create_household(p_name text) RETURNS json`

**Payload** (cliente → RPC, via Supabase):
```ts
{ p_name: string } // 1-100 chars após trim
```

**Retorno** (sucesso):
```json
{
  "household_id": "uuid",
  "name": "string",
  "invite_code": "ABC234",
  "invite_code_expires_at": "2026-04-23T14:30:00Z",
  "role": "owner"
}
```

**Side-effects atômicos (mesma TX)**:
1. INSERT em `households`.
2. INSERT em `household_members` (role=owner).
3. INSERT em `household_member_audit` (action=joined, performed_by=auth.uid()).

**Erros de domínio** (SQLSTATE `P0001` + mensagem padronizada):
- `NAME_REQUIRED` — nome vazio ou só espaços.
- `NAME_TOO_LONG` — nome > 100 chars.
- `GENERATION_FAILED` — não foi possível gerar código único em 5 tentativas.

---

### `join_household(p_code text) RETURNS json`

**Payload**:
```ts
{ p_code: string } // normalizado para uppercase + trim internamente
```

**Retorno** (sucesso):
```json
{
  "household_id": "uuid",
  "name": "string",
  "role": "member"
}
```

**Side-effects atômicos**:
1. INSERT em `household_members` (role=member).
2. INSERT em `household_member_audit` (action=joined).
3. `join_rate_limits`: incrementa **apenas** em falha (RN-15.2).

**Erros de domínio** (SQLSTATE `P0001`):
- `INVALID_OR_EXPIRED_CODE` — código não existe ou `invite_code_expires_at <= now()`. Mensagem pt-BR IDÊNTICA nos dois casos (Lei 9).
- `ALREADY_MEMBER` — usuário já tem vínculo ativo em algum household.
- `RATE_LIMITED` — 5 tentativas falhas na janela atual; retorna HTTP 429 via Supabase.

---

### `regenerate_invite_code() RETURNS json`

**Payload**: nenhum.

**Retorno**:
```json
{
  "invite_code": "XYZ789",
  "invite_code_expires_at": "2026-04-23T14:30:00Z"
}
```

**Side-effects**:
- UPDATE em `households` (apenas `invite_code` e `invite_code_expires_at`).
- Retry automático até 5x em `unique_violation`.

**Erros**:
- `NOT_OWNER` — `auth.uid()` não é owner do household do usuário.
- `NO_HOUSEHOLD` — usuário não pertence a nenhum household ativo.
- `GENERATION_FAILED` — retry esgotado.

---

### `leave_household() RETURNS void`

**Payload**: nenhum.

**Side-effects atômicos**:
1. UPDATE `household_members` do caller: `left_at = now()`.
2. INSERT em `household_member_audit` (action=left, performed_by=auth.uid()).

**Erros**:
- `NO_HOUSEHOLD` — usuário não está em household ativo.
- `OWNER_HAS_ACTIVE_MEMBERS` — owner não pode sair com outros members ativos (RN-20).

---

### `remove_member(p_target_user_id uuid) RETURNS void`

**Payload**:
```ts
{ p_target_user_id: string } // uuid do membro a remover
```

**Side-effects atômicos**:
1. UPDATE `household_members` do target: `left_at = now()`.
2. INSERT em `household_member_audit` (action=removed, performed_by=auth.uid()).

**Erros**:
- `NOT_OWNER` — caller não é owner.
- `TARGET_NOT_MEMBER` — target não é member ativo do household do caller.
- `CANNOT_REMOVE_SELF` — owner não pode remover a si mesmo (RN-21).

---

### `get_current_household() RETURNS json`

Consulta auxiliar usada pelo `AuthBootstrap` (RN-28.1). **Não é mutação.**

**Retorno**:
```json
{
  "household_id": "uuid | null",
  "name": "string | null",
  "role": "owner | member | null"
}
```

Retorna `{ household_id: null, name: null, role: null }` quando o usuário não pertence a nenhum household. **Nunca** lança erro — o slot vazio é estado válido.

---

## 🎯 Critérios de Aceite (Gherkin)

```gherkin
Funcionalidade: Criar Household

  Cenário AC-01: Criar household com nome válido
    Dado que Maria está autenticada e em "/onboarding"
    E não pertence a nenhum household
    Quando ela escolhe "Criar household"
    E preenche nome "Casa Silva"
    E clica em "Criar"
    Então o household "Casa Silva" é criado
    E Maria é inserida como owner em household_members
    E um invite code de 6 caracteres é gerado
    E invite_code_expires_at é now() + 48h
    E audit "joined" é registrado com performed_by = Maria
    E useAuthStore.householdId é populado
    E ela é redirecionada para "/dashboard"

  Cenário AC-02: Rejeitar criação com nome inválido
    Dado que Maria está em "/onboarding"
    Quando ela tenta criar household com:
      | nome                 | erro esperado                          |
      | ""                   | "Nome é obrigatório"                   |
      | "   " (só espaços)   | "Nome é obrigatório"                   |
      | "a" * 101 (101 chars)| "Nome deve ter no máximo 100 caracteres"|
    Então a mensagem de erro correspondente é exibida
    E o botão "Criar" permanece desabilitado enquanto houver erro


Funcionalidade: Invite Code

  Cenário AC-03: Gerar invite code ao criar household
    Dado que household "Casa Silva" foi criado
    Quando Maria acessa "Configurações > Household"
    Então ela vê o invite code (6 caracteres, ex: "ABC234")
    E vê "Válido até 23/04/2026 às 14:30" (formato RN-34.1)
    E vê sub-linha "(em ~47h)" calculada em runtime
    E há botão "Copiar código"
    E há botão "Regenerar código"

  Cenário AC-04: Regenerar invite code (owner only)
    Dado que Maria é owner do household "Casa Silva"
    E o código atual é "ABC123"
    Quando ela clica em "Regenerar código"
    E confirma a ação
    Então um novo código diferente é gerado (ex: "XYZ789")
    E invite_code_expires_at é atualizado para now() + 48h
    E o código "ABC123" se torna inválido imediatamente
    E toast "Código regenerado com sucesso" é exibido

  Cenário AC-05: Código expira após 48h
    Dado que household "Casa Silva" tem código "ABC123"
    E o código foi gerado há mais de 48 horas
    Quando João tenta usar o código "ABC123" para entrar
    Então erro "Código inválido ou expirado" é exibido
    E João permanece sem household


Funcionalidade: Entrar via Código (Join)

  Cenário AC-06: Join com código válido
    Dado que João está autenticado e em "/onboarding"
    E não pertence a nenhum household
    E o código "ABC123" do household "Casa Silva" é válido (não expirado)
    Quando ele escolhe "Tenho um código"
    E digita "ABC123" (case insensitive)
    E clica em "Entrar"
    Então João é vinculado ao household "Casa Silva"
    E seu role é "member"
    E audit "joined" é registrado com performed_by = João
    E useAuthStore.householdId é populado
    E ele é redirecionado para "/dashboard"

  Cenário AC-07: Rejeitar código inválido ou expirado
    Dado que João está em "/onboarding"
    Quando ele tenta entrar com código "ZZZZZ9" (não existe)
    Então erro "Código inválido ou expirado" é exibido
    E NÃO é revelado se o código existe mas expirou vs não existe
    Quando ele tenta entrar com código "ABC123" (expirado)
    Então o mesmo erro "Código inválido ou expirado" é exibido

  Cenário AC-08: Rejeitar se já pertence a household (acesso direto)
    Dado que João já pertence ao household "Casa Silva"
    E tenta acessar "/onboarding" diretamente
    Então ele é redirecionado para "/dashboard"
    E NÃO vê opções de criar/entrar em household

  Cenário AC-08.1: Rejeitar join se já pertence a household (via API)
    Dado que João já pertence ao household "Casa Silva"
    E tenta fazer join em outro household via código "XYZ789"
    Então o RPC retorna erro com code "ALREADY_MEMBER"
    E a UI exibe "Você já pertence a um household. Saia primeiro para entrar em outro."
    E João permanece no household "Casa Silva"
    # Nota: mensagem não-genérica é intencional (RN-17.2, Lei 9 exceção).


Funcionalidade: Pular Onboarding

  Cenário AC-09: Pular cria household solo
    Dado que Pedro está em "/onboarding"
    E não pertence a nenhum household
    Quando ele clica em "Pular por enquanto"
    Então household "Meu Lar" é criado
    E Pedro é owner
    E invite code é gerado (pode convidar depois)
    E audit "joined" é registrado
    E ele é redirecionado para "/dashboard"


Funcionalidade: Gerenciamento de Membros

  Cenário AC-10: Listar membros do household
    Dado que Maria é owner do household "Casa Silva"
    E o household tem: Maria (owner), João (member ativo), Carlos (member inativo)
    Quando ela acessa "Membros"
    Então ela vê lista com 3 entradas:
      | Nome   | Role   | Status  | Desde       |
      | Maria  | Owner  | Ativo   | 10/04/2026  |
      | João   | Member | Ativo   | 15/04/2026  |
      | Carlos | Member | Inativo | 12/04/2026  |
    E ao lado de João há botão "Remover"
    E ao lado de Carlos não há botão (já inativo)
    E ao lado de Maria não há botão (é owner)

  Cenário AC-11: Member sai voluntariamente
    Dado que João é member do household "Casa Silva"
    Quando ele acessa "Configurações > Household"
    E clica em "Sair do household"
    E confirma a ação
    Então seu registro em household_members recebe left_at = now()
    E audit "left" é registrado com performed_by = João
    E setHouseholdId(null) foi chamado (RN-28.2)
    E queryClient.removeQueries removeu queries dependentes de household
    E ele é redirecionado para "/onboarding"
    E toast "Você saiu do household" é exibido
    E a sessão continua ativa (não é logout)

  Cenário AC-12: Owner remove member
    Dado que Maria é owner do household "Casa Silva"
    E João é member ativo
    Quando Maria acessa "Membros"
    E clica em "Remover" ao lado de João
    E confirma a ação
    Então registro de João em household_members recebe left_at = now()
    E audit "removed" é registrado com performed_by = Maria
    E queryClient do Maria invalida "household-members" e "household-audit"
    E a lista de membros na UI atualiza sem remover João da própria sessão
    E toast "João foi removido do household" é exibido
    E no próximo request do João, RLS nega acesso a dados do household
    E o redirect do João para "/onboarding" só ocorre no próximo ciclo (sem push realtime neste MVP)


Funcionalidade: Store & Redirect

  Cenário AC-13: Popular householdId no store após create/join
    Dado que Maria criou household "Casa Silva" com sucesso
    Então o onSuccess da mutation chamou setHouseholdId(uuid)
    E useAuthStore.householdId contém o UUID do household
    E useAuthStore.isAuthenticated é true
    E queryClient invalidou a query ["current-household"]
    E qualquer componente que usa useAuthStore vê householdId atualizado
    E NENHUM setState({ householdId }) direto foi chamado (setter controlado — RN-28)

  Cenário AC-14: Redirect correto baseado em household
    Dado que usuário está autenticado
    Quando householdId é null e useCurrentHousehold não está loading e tenta acessar "/dashboard"
    Então é redirecionado para "/onboarding"
    Quando householdId é preenchido e tenta acessar "/onboarding"
    Então é redirecionado para "/dashboard"

  Cenário AC-14.1: Evitar flash de onboarding durante loading
    Dado que Maria já pertence a "Casa Silva" (persistido no BD)
    E ela acaba de fazer reload da página
    E useCurrentHousehold.isLoading === true
    E useAuthStore.householdId === null (ainda não resolvido)
    Quando o ProtectedRoute é avaliado
    Então renderiza estado de loading (role="status")
    E NÃO redireciona para "/onboarding" (RN-30.1)
    Quando useCurrentHousehold resolve com household_id = uuid
    Então setHouseholdId é chamado
    E o conteúdo de "/dashboard" é renderizado


Funcionalidade: Audit Trail

  Cenário AC-15: Registrar audit quando member entra
    Dado que João fez join no household "Casa Silva"
    Quando a operação completa com sucesso
    Então existe registro em household_member_audit com:
      | campo        | valor           |
      | household_id | UUID da Casa    |
      | user_id      | UUID do João    |
      | action       | "joined"        |
      | performed_by | UUID do João    |
      | performed_at | ~now()          |

  Cenário AC-16: Registrar audit quando member sai
    Dado que João saiu voluntariamente do household
    Então existe registro em household_member_audit com:
      | campo        | valor        |
      | action       | "left"       |
      | performed_by | UUID do João |

  Cenário AC-17: Registrar audit quando owner remove
    Dado que Maria removeu João do household
    Então existe registro em household_member_audit com:
      | campo        | valor         |
      | user_id      | UUID do João  |
      | action       | "removed"     |
      | performed_by | UUID da Maria |

  Cenário AC-18: Owner visualiza histórico de audit
    Dado que Maria é owner do household "Casa Silva"
    Quando ela acessa "Histórico de membros"
    Então ela vê timeline ordenada por data (mais recente primeiro):
      | Ação                                      | Data/Hora       |
      | João entrou no household                  | 15/04 às 14:30  |
      | Carlos foi removido por Maria             | 18/04 às 10:00  |
      | Ana entrou no household                   | 20/04 às 09:15  |
    E cada entrada mostra: ação legível, quem foi afetado, quem executou, timestamp
    E NÃO mostra: emails, UUIDs, dados internos

  Cenário AC-19: Member não pode ver audit
    Dado que João é member (não owner) do household
    Quando ele tenta acessar "Histórico de membros"
    Então a opção não está visível no menu
    E se tentar acessar diretamente via URL, recebe 403 Forbidden


Funcionalidade: Re-entry em Household

  Cenário AC-20: Usuário que saiu pode re-entrar com novo código
    Dado que João saiu do household "Casa Silva" anteriormente
    E Maria regenerou o invite code para "NEW123"
    E João está em "/onboarding" (sem household)
    Quando ele digita "NEW123" e clica "Entrar"
    Então João é vinculado novamente ao household "Casa Silva"
    E um NOVO registro é criado em household_members (histórico preservado)
    E audit "joined" é registrado
    E ele é redirecionado para "/dashboard"

  Cenário AC-21: Histórico de re-entry preservado
    Dado que João entrou, saiu, e re-entrou no household "Casa Silva"
    Quando Maria acessa "Membros"
    Então ela vê João listado uma vez (registro ativo atual)
    E no audit history ela vê: "João entrou", "João saiu", "João entrou" (cronológico)


Funcionalidade: Concurrent Join

  Cenário AC-22: Múltiplos usuários podem entrar com mesmo código
    Dado que household "Casa Silva" tem código "ABC123" válido
    E Ana e Pedro estão em "/onboarding" simultaneamente
    Quando ambos digitam "ABC123" e clicam "Entrar" ao mesmo tempo
    Então ambos são vinculados ao household "Casa Silva"
    E ambos têm role "member"
    E dois registros de audit "joined" são criados


Funcionalidade: Rate Limiting

  Cenário AC-23: Bloquear após 5 tentativas de join por minuto
    Dado que Ana está em "/onboarding"
    E ela tentou 5 códigos inválidos no último minuto
    Quando ela tenta um 6º código
    Então erro "Muitas tentativas. Aguarde 1 minuto." é exibido
    E a requisição retorna HTTP 429

  Cenário AC-24: Rate limit reseta após 1 minuto
    Dado que Ana foi bloqueada por rate limit
    Quando 1 minuto passa
    E ela tenta o código válido "ABC123"
    Então ela é vinculada ao household com sucesso


Funcionalidade: Edge Cases de Owner

  Cenário AC-25: Owner não pode deletar conta com membros ativos
    Dado que Maria é owner do household "Casa Silva"
    E João é member ativo
    Quando Maria tenta deletar sua conta
    Então erro "Transfira a ownership ou remova todos os membros antes de deletar sua conta." é exibido
    E a conta de Maria permanece ativa

  Cenário AC-26: Owner solo pode deletar conta (cascade)
    Dado que Pedro é owner do household "Meu Lar" (solo, sem outros membros)
    Quando Pedro deleta sua conta
    Então o household "Meu Lar" é deletado automaticamente
    E todos os dados associados são removidos


Funcionalidade: UX de Cópia do Código

  Cenário AC-27: Copiar invite code com clipboard API
    Dado que Maria é owner e está em "Configurações > Household"
    E navigator.clipboard está disponível (contexto seguro HTTPS/localhost)
    Quando ela clica em "Copiar código"
    Então navigator.clipboard.writeText é chamado com o código atual
    E o botão muda para ícone ✓ com label "Copiado!"
    E após 2s o botão volta ao estado original
    E nenhum log/console.info contém o código em texto plano (Lei 14)

  Cenário AC-27.1: Fallback sem clipboard API
    Dado que navigator.clipboard é undefined (contexto inseguro ou bloqueado)
    Quando Maria clica em "Copiar código"
    Então um <input readOnly> aparece com o código pré-selecionado
    E uma instrução "Pressione Ctrl+C / Cmd+C para copiar" é exibida
    E o fluxo não é interrompido (auxiliar)


Funcionalidade: Compatibilidade com Usuários Pré-existentes (Módulo 01)

  Cenário AC-28: Usuário do módulo 01 sem household acessa /onboarding
    Dado que Maria foi criada no módulo 01 (user_profiles existe)
    E não há registros em household_members para ela
    Quando ela faz login e a sessão é bootstrapped
    Então get_current_household() retorna { household_id: null, ... }
    E setHouseholdId(null) é chamado
    E ela é redirecionada para "/onboarding"
    E o fluxo de create/join/skip opera normalmente
    E RLS de user_profiles ainda permite self-select (id = auth.uid())

  Cenário AC-28.1: Migration não quebra user_profiles existentes
    Dado que existem N user_profiles criados antes da migration 02
    Quando a migration 02 roda
    Então user_profiles permanece intacto (sem ALTER TABLE destrutivo)
    E NÃO é adicionada coluna household_id em user_profiles (decisão arquitetural — ver Objetivo)
    E a RLS expandida de user_profiles (SELECT entre household members) segue permitindo self-select quando usuário não tem household
```

---

## 📥 Entrada/Saída

### Dados de Entrada

**Formulário de criação de household (`/onboarding` - opção "Criar")**
```
- name: string, 1-100 chars, trim aplicado, obrigatório
```

**Formulário de join (`/onboarding` - opção "Tenho um código")**
```
- code: string, 6 chars, uppercase, obrigatório
```

**Regenerar código (Configurações > Household)**
```
- Nenhum input (usa household_id do contexto)
- Confirmação via modal
```

**Sair do household (Configurações > Household)**
```
- Nenhum input (usa user_id do contexto)
- Confirmação via modal
```

**Remover member (Membros > Remover)**
```
- targetUserId: uuid (do botão clicado)
- Confirmação via modal
```

**Validação obrigatória (Zod)**
- Schemas em `src/features/onboarding/lib/onboarding-schemas.ts`
- `.strict()` para rejeitar campos extras (Lei 2)
- Mensagens em pt-BR

### Dados de Saída

**Para UI (após create/join)**
- `useAuthStore` atualizado **via setter controlado** `setHouseholdId(id)` (RN-28):
  ```ts
  {
    user: User,
    session: Session,
    householdId: string,  // agora preenchido
    isAuthenticated: true,
    isInitializing: false,
  }
  ```
- Novo shape do store:
  ```ts
  interface AuthState {
    // ... campos do módulo 01 ...
    householdId: string | null;
    setSession: (session: Session | null) => void; // do módulo 01
    setHouseholdId: (id: string | null) => void;   // NOVO no módulo 02
    reset: () => void;
  }
  ```
- `reset()` continua zerando `householdId` automaticamente (comportamento do módulo 01 já correto).

**Para UI (lista de membros)**
```ts
{
  id: string,
  userId: string,
  fullName: string,
  role: 'owner' | 'member',
  joinedAt: string,       // ISO timestamp
  leftAt: string | null,  // null = ativo
  isActive: boolean,      // computed: leftAt === null
}[]
```

**Para UI (audit history)**
```ts
{
  id: string,
  action: 'joined' | 'left' | 'removed',
  performedAt: string,    // ISO timestamp
  userFullName: string,   // quem foi afetado
  performerFullName: string, // quem executou
  description: string,    // texto legível: "João entrou no household"
}[]
```

**Para BD (tabelas)**
- `households`: INSERT ao criar, UPDATE ao regenerar código
- `household_members`: INSERT ao join, UPDATE left_at ao sair/remover
- `household_member_audit`: INSERT apenas (imutável)

**Side-effects**
- Helper function `get_user_household_id()` criada para uso em RLS de módulos futuros
- RLS de `user_profiles` expandida para permitir SELECT entre members do mesmo household
- Storage policy de `avatars` expandida para SELECT entre members

---

## 🗄️ Estrutura de Tabelas

> **Nota de autoria**: o SQL abaixo é o **contrato** do módulo. A migration (escrita pelo `supabase-engineer`) pode reorganizar em blocos `begin; ... commit;` e adicionar `drop ... if exists` idempotentes, mas a semântica deve ser preservada 1:1.

```sql
-- =====================================================================
-- Extensão: pgcrypto (para gen_random_bytes — RN-5.1)
-- =====================================================================
create extension if not exists pgcrypto;

-- =====================================================================
-- Tabela: households
-- =====================================================================
create table public.households (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(name) between 1 and 100),
  owner_id                uuid not null references auth.users(id) on delete restrict,
  invite_code             text not null unique check (char_length(invite_code) = 6),
  invite_code_expires_at  timestamptz not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.households is 'Households (lares) para organização financeira compartilhada.';
comment on column public.households.invite_code is 'Código de 6 chars para convite. Único globalmente.';
comment on column public.households.invite_code_expires_at is 'Expiração do código (48h após geração/regeneração).';

-- Trigger: manter households.updated_at em sincronia (usa helper do módulo 01)
create trigger trg_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Tabela: household_members
-- =====================================================================
create table public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('owner', 'member')) default 'member',
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,  -- soft delete: preenchido = inativo
  
  -- Permite re-entry: mesmo user pode ter múltiplos registros (histórico)
  unique (household_id, user_id, joined_at)
);

-- Garante 1 household ativo por usuário (RN-11), preservando histórico via left_at
create unique index household_members_one_active_per_user_idx
  on public.household_members (user_id)
  where left_at is null;

-- Garante apenas 1 owner ativo por household
create unique index household_members_one_active_owner_per_household_idx
  on public.household_members (household_id)
  where role = 'owner' and left_at is null;

-- Índice auxiliar para queries de lista de membros ativos por household
create index household_members_household_active_idx
  on public.household_members (household_id)
  where left_at is null;

comment on table public.household_members is 'Vínculos usuário-household. Soft delete via left_at.';
comment on column public.household_members.left_at is 'Preenchido = membro inativo (saiu ou foi removido).';

-- =====================================================================
-- Tabela: household_member_audit
-- =====================================================================
create table public.household_member_audit (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id),
  action        text not null check (action in ('joined', 'left', 'removed')),
  performed_by  uuid not null references auth.users(id),
  performed_at  timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb
);

create index household_member_audit_household_time_idx
  on public.household_member_audit (household_id, performed_at desc);

comment on table public.household_member_audit is 'Audit trail imutável de ações de membership.';
comment on column public.household_member_audit.action is 'joined = entrou, left = saiu voluntariamente, removed = removido por owner.';
comment on column public.household_member_audit.performed_by is 'Quem executou a ação. Para joined/left = user_id. Para removed = owner.';

-- =====================================================================
-- Helper function: get_user_household_id()
-- Base de RLS para todos os módulos downstream.
-- =====================================================================
create or replace function public.get_user_household_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
    and left_at is null  -- apenas membros ativos
  order by joined_at desc
  limit 1;
$$;

comment on function public.get_user_household_id() is 
  'Retorna household_id do usuário autenticado (membro ativo). Usado em RLS.';

revoke all on function public.get_user_household_id() from public, anon;
grant execute on function public.get_user_household_id() to authenticated;

-- =====================================================================
-- Tabela: join_rate_limits (rate limiting de tentativas de join)
-- =====================================================================
create table public.join_rate_limits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  window_bucket timestamptz not null default date_trunc('minute', now()),
  attempt_count int not null default 1,
  
  unique (user_id, window_bucket)
);

create index join_rate_limits_window_idx
  on public.join_rate_limits (window_bucket);

comment on table public.join_rate_limits is 'Rate limiting para tentativas de join via invite code (RN-15).';

-- Trigger GC: limpa buckets > 1h a cada INSERT (amortizado O(1), RN-15.4)
create or replace function public.gc_join_rate_limits()
returns trigger
language plpgsql
as $$
begin
  delete from public.join_rate_limits
  where window_bucket < now() - interval '1 hour';
  return new;
end;
$$;

create trigger trg_gc_join_rate_limits
  after insert on public.join_rate_limits
  for each statement execute function public.gc_join_rate_limits();

-- =====================================================================
-- Função: generate_invite_code() — RN-5.1 + RN-31
-- CSPRNG via pgcrypto + rejection sampling (sem módulo-bias).
-- NÃO consulta households; unicidade é garantida pelo constraint UNIQUE
-- na tabela (retry fica no caller via bloco EXCEPTION).
-- =====================================================================
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  charset     constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  charset_len constant int  := 32;
  code        text := '';
  byte_val    int;
  safety_max  constant int  := 256; -- proteção contra loop infinito improvável
  iterations  int := 0;
begin
  -- Rejection sampling: lê bytes aleatórios do CSPRNG e só aceita
  -- valores < 256 - (256 % 32) = 256 (já múltiplo perfeito de 32).
  -- Como 256 % 32 == 0, todo byte é válido — rejection nunca dispara
  -- na prática, mas mantemos o padrão para auditoria clara.
  while char_length(code) < 6 and iterations < safety_max loop
    iterations := iterations + 1;
    byte_val := get_byte(gen_random_bytes(1), 0); -- 0..255
    if byte_val < (256 - (256 % charset_len)) then
      code := code || substr(charset, (byte_val % charset_len) + 1, 1);
    end if;
  end loop;

  if char_length(code) < 6 then
    raise exception 'GENERATION_FAILED: CSPRNG rejection loop excedido' using errcode = 'P0001';
  end if;

  return code;
end;
$$;

comment on function public.generate_invite_code() is 
  'Gera invite code de 6 chars via pgcrypto + rejection sampling (RN-5.1).';

revoke all on function public.generate_invite_code() from public, anon, authenticated;
-- Invocada apenas pelos RPCs create_household e regenerate_invite_code,
-- ambos SECURITY DEFINER — não precisa grant para authenticated.

-- =====================================================================
-- Trigger: before_user_delete (RN-35, RN-36, RN-36.1)
-- Usa FOR UPDATE para prevenir race com joins concorrentes.
-- =====================================================================
create or replace function public.handle_owner_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owned_household_id uuid;
  active_member_count int;
begin
  select id into owned_household_id
  from public.households
  where owner_id = old.id
  for update;  -- lock do household alvo

  if owned_household_id is not null then
    -- Lock de linha nos membros ativos para evitar race com novo join
    select count(*) into active_member_count
    from public.household_members
    where household_id = owned_household_id
      and user_id != old.id
      and left_at is null
    for update;

    if active_member_count > 0 then
      raise exception 'OWNER_HAS_MEMBERS: não é possível deletar conta com membros ativos.'
        using errcode = 'P0001';
    end if;

    -- Household solo: deleta em cascata (members + audit via FK cascade)
    delete from public.households where id = owned_household_id;
  end if;

  return old;
end;
$$;

create trigger before_user_delete
  before delete on auth.users
  for each row
  execute function public.handle_owner_delete();

-- =====================================================================
-- RLS: households
-- =====================================================================
alter table public.households enable row level security;
alter table public.households force  row level security;

-- SELECT: qualquer member ativo vê seu household
create policy "households_select_member"
  on public.households
  for select
  to authenticated
  using (id = public.get_user_household_id());

-- INSERT/UPDATE/DELETE: bloqueados via policy (todos os writes vão por RPC SECURITY DEFINER).
-- Não criar policy = negado por default com RLS ativada.

-- =====================================================================
-- RLS: household_members
-- =====================================================================
alter table public.household_members enable row level security;
alter table public.household_members force  row level security;

-- SELECT: members ativos/inativos do mesmo household (lista + histórico na UI)
create policy "household_members_select_same_household"
  on public.household_members
  for select
  to authenticated
  using (household_id = public.get_user_household_id());

-- INSERT/UPDATE/DELETE: via RPCs SECURITY DEFINER. Sem policy = negado.

-- =====================================================================
-- RLS: household_member_audit
-- Decisão arquitetural (R4): INSERTs ocorrem dentro de RPCs SECURITY
-- DEFINER (bypass RLS). Mantemos RLS ativa como defesa em profundidade
-- contra writes diretos via PostgREST.
-- =====================================================================
alter table public.household_member_audit enable row level security;
alter table public.household_member_audit force  row level security;

-- INSERT via cliente direto: BLOQUEADO (sem policy). Apenas RPCs SECURITY
-- DEFINER podem escrever, pois bypassam RLS por padrão.

-- SELECT: apenas owner do household pode visualizar audit (RN-26)
create policy "household_member_audit_select_owner"
  on public.household_member_audit
  for select
  to authenticated
  using (
    household_id in (
      select id from public.households where owner_id = auth.uid()
    )
  );

-- UPDATE/DELETE: sem policy = imutável (RN-25).

-- =====================================================================
-- RLS: join_rate_limits
-- Gerenciado exclusivamente pelo RPC join_household (SECURITY DEFINER).
-- Sem policies de cliente.
-- =====================================================================
alter table public.join_rate_limits enable row level security;
alter table public.join_rate_limits force  row level security;

-- =====================================================================
-- Expansão de RLS existente: user_profiles (módulo 01 → módulo 02)
-- SELECT expandida para permitir ver colegas do mesmo household.
-- =====================================================================
drop policy if exists "user_profiles_select_own" on public.user_profiles;

create policy "user_profiles_select_own_or_household"
  on public.user_profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or id in (
      select user_id
      from public.household_members
      where household_id = public.get_user_household_id()
    )
  );

-- Nota: incluímos membros com left_at IS NOT NULL propositalmente — a lista
-- de audit e histórico de despesas (módulos 04-08) precisa resolver nomes
-- de ex-membros (RN-22). A UI filtra "ativos" no lado do cliente.

-- =====================================================================
-- Expansão de Storage policy: avatars (módulo 01 → módulo 02)
-- SELECT expandida para members ativos do mesmo household.
-- =====================================================================
drop policy if exists "avatars_select_own" on storage.objects;

create policy "avatars_select_own_or_household"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text
        from public.household_members
        where household_id = public.get_user_household_id()
          and left_at is null
      )
    )
  );

-- INSERT/UPDATE/DELETE: mantidos como módulo 01 (apenas dono do path).

-- =====================================================================
-- Grants explícitos (menor privilégio)
-- =====================================================================
revoke all on table public.households                from public, anon;
grant  select on table public.households             to authenticated;

revoke all on table public.household_members         from public, anon;
grant  select on table public.household_members      to authenticated;

revoke all on table public.household_member_audit    from public, anon;
grant  select on table public.household_member_audit to authenticated;

revoke all on table public.join_rate_limits         from public, anon, authenticated;
-- Writes via RPC SECURITY DEFINER; SELECT não é útil ao cliente.
```

### Assinaturas dos RPCs (esqueleto de referência)

Os RPCs vivem na mesma migration. Os esqueletos abaixo documentam **estrutura esperada** — a implementação detalhada é tarefa do `supabase-engineer` no TDD:

```sql
-- create_household(p_name text) ----------------------------------------
create or replace function public.create_household(p_name text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trimmed text := trim(coalesce(p_name, ''));
  v_household_id uuid;
  v_code text;
  v_expires_at timestamptz := now() + interval '48 hours';
  v_attempts int := 0;
begin
  -- Validação (RN-1, Lei 3)
  if char_length(v_trimmed) = 0 then
    raise exception 'NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_trimmed) > 100 then
    raise exception 'NAME_TOO_LONG' using errcode = 'P0001';
  end if;

  -- Retry em colisão de invite_code (RN-31)
  loop
    v_attempts := v_attempts + 1;
    begin
      v_code := public.generate_invite_code();
      insert into public.households (name, owner_id, invite_code, invite_code_expires_at)
        values (v_trimmed, auth.uid(), v_code, v_expires_at)
        returning id into v_household_id;
      exit;
    exception when unique_violation then
      if v_attempts >= 5 then
        raise exception 'GENERATION_FAILED' using errcode = 'P0001';
      end if;
    end;
  end loop;

  -- Owner membership + audit (RN-3, RN-4) — mesma TX
  insert into public.household_members (household_id, user_id, role)
    values (v_household_id, auth.uid(), 'owner');

  insert into public.household_member_audit
    (household_id, user_id, action, performed_by)
    values (v_household_id, auth.uid(), 'joined', auth.uid());

  return json_build_object(
    'household_id', v_household_id,
    'name', v_trimmed,
    'invite_code', v_code,
    'invite_code_expires_at', v_expires_at,
    'role', 'owner'
  );
end;
$$;

revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
```

Esqueletos análogos (omitidos por brevidade, mesma estrutura de `SECURITY DEFINER` + validação + bloco EXCEPTION onde necessário):

- `join_household(p_code text)` — normaliza input (`upper(trim(p_code))`), incrementa rate-limit em falha, valida `invite_code_expires_at > now()`, verifica `ALREADY_MEMBER`, faz INSERT em `household_members` + `household_member_audit`.
- `regenerate_invite_code()` — valida owner, gera novo código com retry até 5x em `unique_violation`, `UPDATE ... RETURNING`.
- `leave_household()` — valida not-owner-with-members, `UPDATE left_at = now()` + audit.
- `remove_member(p_target_user_id uuid)` — valida owner + target≠self + target é ativo, `UPDATE left_at` + audit.
- `get_current_household()` — `SELECT` simples sobre `household_members` JOIN `households`, retorna JSON com slots nullable.

**Grants**: todos os RPCs acima recebem `grant execute ... to authenticated` e `revoke ... from public, anon`.

---

## 🔗 Dependências de Outros Módulos

- ✅ **Módulo 01 (auth-and-session)**: COMPLETO. Necessário: `useAuthStore`, `auth.uid()`, sessão ativa, `user_profiles`, trigger `handle_new_user`, helper `set_updated_at()`, bucket `avatars`.

### Ajuste retroativo no módulo 01 (não-destrutivo)

O comentário nas linhas 11-13 da migration `20260419000001_init_user_profiles.sql` prevê adicionar `household_id` em `user_profiles`. **Decisão atualizada**: esta coluna **não** será adicionada (ver Princípio Arquitetural #3 no Objetivo). A única fonte de verdade de "household ativo" é `household_members` + índice parcial único. Essa decisão:

- Elimina denormalização redundante.
- Evita trigger de sincronização (antes ausente, agora desnecessária).
- Simplifica RLS de módulos futuros: `household_id = public.get_user_household_id()` em vez de `household_id = (SELECT household_id FROM user_profiles WHERE id = auth.uid())`.

A migration do módulo 02 inclui comentário `COMMENT ON COLUMN` em `user_profiles` anotando essa decisão como ADR inline.

### Dependências de Infraestrutura (criadas pelo `supabase-engineer` no início do módulo)

- ✅ Migration `20260420000001_households_and_members.sql`:
  - `CREATE EXTENSION IF NOT EXISTS pgcrypto` (RN-5.1)
  - Tabelas: `households`, `household_members`, `household_member_audit`, `join_rate_limits`
  - Índices (incluindo parciais para unicidade e performance)
  - Helper function: `get_user_household_id()` (`STABLE`, `SECURITY DEFINER`)
  - Função `generate_invite_code()` via `gen_random_bytes()` + rejection sampling
  - RPCs: `create_household`, `join_household`, `regenerate_invite_code`, `leave_household`, `remove_member`, `get_current_household` (todos `SECURITY DEFINER`)
  - Trigger `before_user_delete` + `handle_owner_delete()` com `FOR UPDATE`
  - Trigger `trg_gc_join_rate_limits` (garbage collect de buckets antigos)
  - Trigger `trg_households_updated_at` usando `public.set_updated_at()` do módulo 01
  - RLS policies para todas as tabelas (audit imutável, households/members por `get_user_household_id()`)
  - `DROP` + `CREATE` da policy expandida de `user_profiles` (self OR household)
  - `DROP` + `CREATE` da policy expandida de `avatars` (self OR active household members)
  - Grants explícitos (menor privilégio)

### Módulos que dependem deste

- 🔜 **Módulo 03 (categories)**: precisa de `household_id` para vincular categorias — usará `public.get_user_household_id()` em default e RLS.
- 🔜 **Todos os módulos seguintes (04-15)**: usam `get_user_household_id()` em RLS.

---

## 📝 Fora de Escopo

- ❌ **Transferência de ownership** — Módulo futuro de administração avançada
- ❌ **Merge de households** — Não planejado
- ❌ **Convite por email** (envio automático) — Módulo de notificações futuro
- ❌ **Múltiplos households por usuário** — Usuário pertence a 1 household por vez
- ❌ **Edição do nome do household** — Módulo 14 (settings-and-prefs)
- ❌ **Criação de `user_settings`** — Módulo 14 (settings-and-prefs)
- ❌ **Widget preferences** — Módulo 10 (dashboard-widgets)
- ❌ **Exportação de audit trail** (PDF/CSV) — Módulo 13 (pdf-csv-export)
- ❌ **Notificações push/email de ações** — Módulo futuro de notificações

---

## 🏗️ Sugestão de Estrutura de Arquivos

```
src/features/onboarding/
├── components/
│   ├── OnboardingPage.tsx           # Tela com duas opções + pular
│   ├── CreateHouseholdForm.tsx      # Form de criação
│   ├── JoinHouseholdForm.tsx        # Form de entrada via código
│   └── __tests__/
│       ├── OnboardingPage.test.tsx
│       ├── CreateHouseholdForm.test.tsx
│       └── JoinHouseholdForm.test.tsx
├── hooks/
│   ├── useCreateHousehold.ts        # React Query mutation
│   ├── useJoinHousehold.ts          # React Query mutation
│   ├── useSkipOnboarding.ts         # Cria household solo
│   └── __tests__/
│       ├── useCreateHousehold.test.tsx
│       ├── useJoinHousehold.test.tsx
│       └── useSkipOnboarding.test.tsx
├── lib/
│   ├── onboarding-schemas.ts        # Zod schemas
│   └── constants.ts                 # INVITE_CODE_LENGTH, INVITE_CODE_EXPIRY_HOURS
└── index.ts

src/features/household/
├── components/
│   ├── MembersList.tsx              # Lista de membros
│   ├── MemberRow.tsx                # Linha com ações
│   ├── InviteCodeDisplay.tsx        # Exibe código + copiar + regenerar
│   ├── CopyCodeButton.tsx           # Clipboard + fallback (RN-34.2, AC-27)
│   ├── RegenerateCodeButton.tsx     # Botão para owner
│   ├── LeaveHouseholdButton.tsx     # Botão para member sair
│   ├── AuditHistory.tsx             # Timeline de ações — owner only
│   ├── AuditRow.tsx                 # Linha de audit
│   └── __tests__/
│       ├── MembersList.test.tsx
│       ├── InviteCodeDisplay.test.tsx
│       ├── CopyCodeButton.test.tsx
│       └── AuditHistory.test.tsx
├── hooks/
│   ├── useCurrentHousehold.ts       # Query get_current_household() — RN-28.1
│   ├── useHouseholdMembers.ts       # React Query query
│   ├── useRegenerateInviteCode.ts   # Mutation
│   ├── useLeaveHousehold.ts         # Member sai
│   ├── useRemoveMember.ts           # Owner remove
│   ├── useHouseholdAudit.ts         # Query audit history
│   └── __tests__/
│       ├── useCurrentHousehold.test.tsx
│       ├── useHouseholdMembers.test.tsx
│       ├── useRegenerateInviteCode.test.tsx
│       ├── useLeaveHousehold.test.tsx
│       ├── useRemoveMember.test.tsx
│       └── useHouseholdAudit.test.tsx
├── lib/
│   ├── household-schemas.ts         # Zod schemas
│   ├── household-errors.ts          # Map de códigos P0001 → mensagem pt-BR
│   ├── date-format.ts               # formatShortDate / formatRelativeExpiry (RN-34.1)
│   └── audit-utils.ts               # Formatadores de ação
└── index.ts

src/stores/
└── useAuthStore.ts                  # + setHouseholdId(id | null) (RN-28)

supabase/migrations/
└── 20260420000001_households_and_members.sql

tests/e2e/onboarding/
├── create-household.spec.ts
├── join-household.spec.ts
├── skip-onboarding.spec.ts
├── regenerate-code.spec.ts
├── leave-household.spec.ts
├── remove-member.spec.ts
└── audit-history.spec.ts
```

---

## 🎨 Diretrizes de UI/UX

- **Onboarding Page**: Card centralizado, max-width 500px. Duas opções grandes (cards clicáveis): "Criar meu household" e "Tenho um código". Link secundário "Pular por enquanto" abaixo.
- **Invite Code Display**: Código em fonte monospace grande (32px), fácil de ler/copiar. Botão "Copiar" com feedback visual (ícone muda para check por 2s).
- **Members List**: Tabela responsiva, avatares à esquerda, status via badge (verde = ativo, cinza = inativo).
- **Audit History**: Timeline vertical com ícones por tipo de ação (entrada = verde, saída = amarelo, remoção = vermelho).
- **Confirmações**: Modal shadcn/ui para ações destrutivas (sair, remover, regenerar).
- **Toasts**: Sucesso em verde, erro em vermelho, duração 3s.

---

## 📊 Métricas de Sucesso

- ✅ Todos os **28 ACs Gherkin** (AC-01 a AC-28; com sub-cenários AC-08.1, AC-14.1, AC-27.1 e AC-28.1 = 32 cenários totais) transformados em testes RED → GREEN.
- ✅ Cobertura de testes ≥ **80%** (statements + branches) em `src/features/onboarding/` e `src/features/household/`.
- ✅ `/sec-audit 02-household-onboarding` retorna scorecard ≥ **B** (zero CRÍTICAS, zero ALTAS).
- ✅ **7 happy-paths E2E (Playwright)**: criar household, join via código, pular onboarding, regenerar código, visualizar audit, re-entry após saída, concurrent join.
- ✅ **6 sad-paths E2E**: código inválido, código expirado, join quando já em household, member tenta ver audit, rate limit exceeded, owner delete com membros.
- ✅ Zero anti-padrões de Vibe Coding (A1-A10) detectados pelo `qa-validator`.
- ✅ `pnpm audit --prod` sem vulnerabilidades críticas/altas.
- ✅ Helper `get_user_household_id()` testado com múltiplos usuários/households.
- ✅ Audit trail imutável: testes confirmam que UPDATE/DELETE são bloqueados por RLS (policies não existem = negado).
- ✅ Rate limiting: testes confirmam bloqueio após 5 tentativas, reset após 1 minuto **e GC de buckets antigos**.
- ✅ Colisão de invite code: testes confirmam retry automático no RPC (via bloco `EXCEPTION`) e erro `GENERATION_FAILED` após 5 falhas.
- ✅ Geração CSPRNG: teste estatístico simples confirma distribuição uniforme sobre charset (chi-square < threshold em 10k amostras).
- ✅ Cascade de owner solo: teste confirma deleção de household quando owner solo deleta conta.
- ✅ Compatibilidade retroativa: usuário criado no módulo 01 sem household passa por `/onboarding` sem erros de RLS.
- ✅ Setter controlado: testes confirmam que **nenhuma** mutation usa `useAuthStore.setState({ householdId })` direto — todos passam por `setHouseholdId(...)`.
- ✅ Performance: lista de até 100 membros carrega < 300ms.
- ✅ **Lighthouse Accessibility ≥ 95** nas páginas de onboarding.

---

## 🧭 Referências Cruzadas

- 📋 Módulo 01: [specs/modules/01-auth-and-session/spec.md](../01-auth-and-session/spec.md)
- 🔐 Segurança deste módulo: [security.md](./security.md)
- 📝 Tarefas TDD: [tasks.md](./tasks.md)
