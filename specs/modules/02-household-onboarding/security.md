# Segurança: Módulo 02-household-onboarding

> **Status**: ✅ Checklist de segurança pronto para execução por tarefa
> **Spec relacionado**: [spec.md](./spec.md)
> **Tarefas TDD**: [tasks.md](./tasks.md)
> **Última atualização**: 2026-04-21 (round 2 — ajustes pós `/spec-review`)

## Decisões arquiteturais que afetam segurança

1. **RPC-based audit insert** (R4): INSERTs em `household_member_audit` acontecem **exclusivamente dentro de RPCs `SECURITY DEFINER`**. O cliente PostgREST **nunca** escreve direto na tabela. A ausência de policy INSERT (RLS ativa) é **defesa em profundidade**: caso alguém tente bypass, é negado.
2. **Setter controlado `setHouseholdId`** no `useAuthStore`: nenhuma mutation usa `setState({ householdId })` direto. Preserva a invariante de Lei 1/9 do store (único caminho legítimo de mutação).
3. **CSPRNG em `generate_invite_code()`**: `gen_random_bytes()` (pgcrypto) + rejection sampling em vez de `random()`. Entropia real garantida para mitigação de brute-force.
4. **Exceção intencional à Lei 9**: `ALREADY_MEMBER` expõe estado do próprio usuário autenticado. Justificativa: usuário tem direito a conhecer seu próprio estado; o leak protegido é apenas o par "código inválido vs expirado" (recursos de terceiros).

---

## 15 Leis de Arquitetura Segura

### Lei 1: Nunca Confie no Cliente

**Aplicação ao módulo**:
- [ ] `owner_id` em `households` SEMPRE vem de `auth.uid()` no RPC, nunca do input.
- [ ] `user_id` em `household_members` SEMPRE vem de `auth.uid()` no RPC.
- [ ] `performed_by` em `household_member_audit` SEMPRE vem de `auth.uid()` dentro do RPC (tabela **não** aceita INSERT direto do cliente — R4).
- [ ] `household_id` para queries vem de `get_user_household_id()`, nunca do client.
- [ ] Invite code é validado server-side (existência + expiração), não confiar em validação client.
- [ ] `useAuthStore.householdId` é mutável apenas via `setHouseholdId(...)` — setter controlado cujo argumento vem do response de RPCs confiáveis.

**O que testar**:
- Tentar criar household passando `owner_id` diferente no body → ignorado, usa `auth.uid()`.
- Tentar join passando `user_id` diferente → ignorado, usa `auth.uid()`.
- Tentar inserir audit com `performed_by` forjado → RPC não aceita esse campo.

**Como testar**:
```typescript
test("SECURITY-1: create_household ignora owner_id do body", async () => {
  await loginAs("maria@exemplo.com")
  
  const { data, error } = await supabase.rpc("create_household", {
    name: "Casa Teste",
    owner_id: "outro-user-uuid" // tentativa de injeção
  })
  
  // owner_id deve ser o de Maria, não o forjado
  const household = await supabase
    .from("households")
    .select("owner_id")
    .eq("id", data.id)
    .single()
  
  expect(household.data.owner_id).toBe(mariaUserId)
  expect(household.data.owner_id).not.toBe("outro-user-uuid")
})

test("SECURITY-1: join_household ignora user_id do body", async () => {
  await loginAs("joao@exemplo.com")
  
  const { error } = await supabase.rpc("join_household", {
    code: "ABC123",
    user_id: "maria-user-uuid" // tentativa de IDOR
  })
  
  // Deve vincular João, não Maria
  const member = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .single()
  
  expect(member.data.user_id).toBe(joaoUserId)
})
```

**Evidência**:
- [ ] RPCs `create_household`, `join_household`, `leave_household`, `remove_member`, `regenerate_invite_code` usam `auth.uid()` internamente
- [ ] Nenhum RPC aceita `owner_id`, `user_id` ou `performed_by` como parâmetro (apenas `p_name`, `p_code`, `p_target_user_id`)
- [ ] Lint/grep automático confirma ausência de `useAuthStore.setState({ householdId` no código
- [ ] Testes acima passam

---

### Lei 2: Schema Restrito (Mass Assignment Protection)

**Aplicação ao módulo**:
- [ ] Schema Zod de criação aceita APENAS `name`.
- [ ] Schema Zod de join aceita APENAS `code`.
- [ ] RPCs não aceitam campos extras (ex: `role`, `created_at`, `invite_code`).
- [ ] Não há `Object.assign(payload, body)` ou spread `...req.body`.

**O que testar**:
- Criar household com campo extra `is_premium: true` → ignorado ou erro.
- Join com campo extra `role: "owner"` → ignorado ou erro.

**Como testar**:
```typescript
test("SECURITY-2: createHouseholdSchema rejeita campos extras", () => {
  const result = createHouseholdSchema.safeParse({
    name: "Casa Teste",
    is_premium: true,
    invite_code: "HACK123"
  })
  
  expect(result.success).toBe(false)
  // Zod com .strict() retorna "unrecognized_keys"
})

test("SECURITY-2: joinHouseholdSchema rejeita campos extras", () => {
  const result = joinHouseholdSchema.safeParse({
    code: "ABC123",
    role: "owner" // tentativa de privilege escalation
  })
  
  expect(result.success).toBe(false)
})
```

**Evidência**:
- [ ] `onboarding-schemas.ts` usa `.strict()` em todos os schemas
- [ ] RPCs definem parâmetros explícitos, não aceitam JSONB genérico
- [ ] Testes acima passam

---

### Lei 3: Limites de Tamanho e Taxa (DoS Prevention)

**Aplicação ao módulo**:
- [ ] `name`: 1-100 chars (validado client + server via constraint)
- [ ] `invite_code`: exatamente 6 chars (constraint CHECK)
- [ ] Lista de membros: LIMIT 100 por household
- [ ] Histórico de audit: LIMIT 500 com paginação
- [ ] Rate-limit de join: 5 tentativas/minuto por IP/user

**O que testar**:
- Criar household com nome de 101 chars → rejeição.
- Query de membros com 200 registros → retorna apenas 100.
- 6 tentativas de join em 1 minuto → 6ª é rate-limited.

**Como testar**:
```typescript
test("SECURITY-3: rejeita name > 100 chars", async () => {
  const { error } = await supabase.rpc("create_household", {
    name: "a".repeat(101)
  })
  
  expect(error).toBeTruthy()
  expect(error.message).toMatch(/100|tamanho|limite/i)
})

test("SECURITY-3: lista de membros limitada a 100", async () => {
  // Setup: household com 150 membros (seed)
  const { data } = await supabase
    .from("household_members")
    .select("*")
    .eq("household_id", bigHouseholdId)
  
  expect(data.length).toBeLessThanOrEqual(100)
})

test("SECURITY-3: rate-limit em join após 5 tentativas", async () => {
  for (let i = 0; i < 5; i++) {
    await supabase.rpc("join_household", { code: "WRONG1" })
  }
  
  const { error } = await supabase.rpc("join_household", { code: "WRONG2" })
  
  expect(error?.message).toMatch(/rate.?limit|muitas tentativas/i)
})
```

**Evidência**:
- [ ] Constraint CHECK em `households.name`: `char_length(name) between 1 and 100`
- [ ] RPC de listagem usa `LIMIT 100`
- [ ] RPC `join_household` verifica contador de tentativas
- [ ] Testes acima passam

---

### Lei 4: Proteção de Perímetro (Middleware Shield)

**Aplicação ao módulo**:
- [ ] **Rate-limiting em join**: 5 tentativas/min por user para prevenir brute-force do código.
- [ ] **CORS**: configurado no Supabase Dashboard.
- [ ] **CSRF**: SPA pura com SameSite=Strict, CSRF não é vetor relevante.

**O que testar**:
- Brute-force de código (tentativas rápidas) → bloqueado após 5 falhas.
- Request de origin desconhecida → CORS bloqueia (browser enforced).

**Como testar**:
```typescript
test("SECURITY-4: brute-force de código é bloqueado", async () => {
  const codes = ["AAA111", "BBB222", "CCC333", "DDD444", "EEE555", "FFF666"]
  
  for (let i = 0; i < 5; i++) {
    await supabase.rpc("join_household", { code: codes[i] })
  }
  
  const { error } = await supabase.rpc("join_household", { code: codes[5] })
  
  expect(error?.code).toBe("RATE_LIMITED") // ou status 429
})
```

**Evidência**:
- [ ] RPC `join_household` incrementa contador em tabela `join_rate_limits`
- [ ] Chave de rate-limit usa `unique(user_id, window_bucket)`
- [ ] Contador reseta após 60 segundos
- [ ] Teste acima passa

> **Nota MVP**: Rate-limiting implementado via contador simples no RPC. Middleware completo em módulo futuro.

---

### Lei 5: Identidade Extraída, Nunca Recebida (IDOR/BOLA Protection)

**Aplicação ao módulo**:
- [ ] Usuário A não consegue ver/gerenciar household de usuário B.
- [ ] `get_user_household_id()` retorna household do usuário autenticado, nunca do input.
- [ ] Audit `performed_by` vem de `auth.uid()`, nunca de parâmetro.

**O que testar**:
- Maria tenta listar membros do household de Pedro → 0 resultados (RLS).
- Maria tenta remover membro de outro household → falha.
- Join com código válido mas `user_id` forjado → ignora, usa `auth.uid()`.

**Como testar**:
```typescript
test("SECURITY-5: Maria não vê membros do household de Pedro", async () => {
  const pedroHouseholdId = await seedHousehold("pedro@x.com")
  await loginAs("maria@x.com")
  
  const { data } = await supabase
    .from("household_members")
    .select("*")
    .eq("household_id", pedroHouseholdId)
  
  expect(data).toEqual([]) // RLS nega
})

test("SECURITY-5: Maria não remove membro de outro household", async () => {
  const joaoInPedroHousehold = await seedMember("joao@x.com", pedroHouseholdId)
  await loginAs("maria@x.com")
  
  const { error } = await supabase.rpc("remove_member", {
    target_user_id: joaoInPedroHousehold.userId
  })
  
  expect(error).toBeTruthy()
  expect(error.message).toMatch(/autorização|permissão|denied/i)
})
```

**Evidência**:
- [ ] RLS em `household_members`: `using (household_id = get_user_household_id())`
- [ ] RPC `remove_member` verifica que target está no mesmo household
- [ ] Testes acima passam

---

### Lei 6: Autorização em Cada Operação

**Aplicação ao módulo**:
- [ ] **Regenerar código**: apenas owner.
- [ ] **Remover member**: apenas owner (e não pode remover a si mesmo).
- [ ] **Sair do household**: apenas o próprio member (owner não pode se há outros ativos).
- [ ] **Ver audit**: apenas owner.

**O que testar**:
- Member tenta regenerar código → 403.
- Member tenta remover outro member → 403.
- Owner tenta sair com outros ativos → erro.
- Member tenta ver audit → 0 resultados ou 403.

**Como testar**:
```typescript
test("SECURITY-6: member não pode regenerar código", async () => {
  await seedHouseholdWithMember("maria@x.com", "joao@x.com")
  await loginAs("joao@x.com") // member
  
  const { error } = await supabase.rpc("regenerate_invite_code")
  
  expect(error?.code).toBe("42501") // permission denied
})

test("SECURITY-6: member não pode remover outro member", async () => {
  await seedHouseholdWithMembers(["maria@x.com", "joao@x.com", "carlos@x.com"])
  await loginAs("joao@x.com") // member
  
  const { error } = await supabase.rpc("remove_member", {
    target_user_id: carlosUserId
  })
  
  expect(error).toBeTruthy()
})

test("SECURITY-6: owner não pode sair se há outros membros ativos", async () => {
  await seedHouseholdWithMember("maria@x.com", "joao@x.com")
  await loginAs("maria@x.com") // owner
  
  const { error } = await supabase.rpc("leave_household")
  
  expect(error?.message).toMatch(/transferir|outros membros|não pode sair/i)
})

test("SECURITY-6: member não pode ver audit", async () => {
  await seedHouseholdWithMember("maria@x.com", "joao@x.com")
  await loginAs("joao@x.com") // member
  
  const { data } = await supabase
    .from("household_member_audit")
    .select("*")
  
  expect(data).toEqual([]) // RLS nega
})
```

**Evidência**:
- [ ] RPC `regenerate_invite_code`: `if auth.uid() != household.owner_id then raise 'NOT_OWNER'`
- [ ] RPC `remove_member`: verifica owner (caller) + target ≠ self + target é member ativo
- [ ] RPC `leave_household`: verifica que não é owner com membros ativos (lança `OWNER_HAS_ACTIVE_MEMBERS`)
- [ ] RLS `household_member_audit_select_owner`: `using (household_id in (select id from households where owner_id = auth.uid()))`
- [ ] INSERT em `household_member_audit` **bloqueado** para acesso direto do cliente: ausência de policy INSERT + RLS ativa
- [ ] Testes acima passam

---

### Lei 7: Row Level Security e Tenant Isolation

**Aplicação ao módulo**:
- [ ] RLS HABILITADO **e** `FORCE` em `households`, `household_members`, `household_member_audit`, `join_rate_limits`.
- [ ] Nenhuma policy com `USING (true)`.
- [ ] Helper `get_user_household_id()` é a base de todas as policies de tenant.
- [ ] Dois households não compartilham dados.
- [ ] `households`, `household_members`, `household_member_audit`, `join_rate_limits` **não têm** policy de INSERT/UPDATE/DELETE — todos os writes passam por RPCs `SECURITY DEFINER`.

**O que testar**:
- Query em `household_members` sem filtro retorna apenas do próprio household.
- Query em `households` retorna apenas o próprio.
- Audit de outro household não aparece.

**Como testar**:
```sql
-- Verificar RLS está ON
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('households', 'household_members', 'household_member_audit');
-- Resultado: rowsecurity = true para todas

-- Verificar nenhuma policy permissiva
SELECT polname, polqual::text
FROM pg_policy
WHERE polrelid IN (
  'households'::regclass,
  'household_members'::regclass,
  'household_member_audit'::regclass
);
-- Nenhum 'true' isolado em polqual
```

```typescript
test("SECURITY-7: isolamento entre households", async () => {
  const hh1 = await seedHousehold("maria@x.com")
  const hh2 = await seedHousehold("pedro@x.com")
  
  await loginAs("maria@x.com")
  
  const { data: households } = await supabase.from("households").select("*")
  expect(households.length).toBe(1)
  expect(households[0].id).toBe(hh1.id)
  
  const { data: members } = await supabase.from("household_members").select("*")
  expect(members.every(m => m.household_id === hh1.id)).toBe(true)
})
```

**Evidência**:
- [ ] Migration com `ENABLE ROW LEVEL SECURITY` nas 4 tabelas
- [ ] Migration com `FORCE ROW LEVEL SECURITY` em todas (inclusive as de write-only-via-RPC)
- [ ] SQL audit acima retorna resultados esperados
- [ ] Testes acima passam

---

### Lei 8: Atomicidade Transacional (Race Condition Prevention)

**Aplicação ao módulo**:
- [ ] Create household: INSERT `households` + INSERT `household_members` (owner) + INSERT `audit` na MESMA TX.
- [ ] Join household: INSERT `household_members` + INSERT `audit` na MESMA TX.
- [ ] Leave/Remove: UPDATE `left_at` + INSERT `audit` na MESMA TX.
- [ ] Regenerate code: race condition no código único tratada.

**O que testar**:
- Se audit INSERT falhar, household não fica criado.
- Dois joins simultâneos com mesmo código e usuários diferentes → ambos podem ter sucesso.
- Duas regenerações simultâneas → códigos diferentes.

**Como testar**:
```typescript
test("SECURITY-8: create_household é atômico (audit falha = rollback)", async () => {
  // Simular: trigger que força falha no audit insert
  // Verificar que household também não foi criado
  
  const { error } = await supabase.rpc("create_household_with_audit_failure", {
    name: "Teste Atomicidade"
  })
  
  expect(error).toBeTruthy()
  
  const { data } = await supabase
    .from("households")
    .select("*")
    .eq("name", "Teste Atomicidade")
  
  expect(data).toEqual([]) // rollback funcionou
})

test("SECURITY-8: join simultâneo com mesmo código em usuários diferentes", async () => {
  const code = await seedHouseholdGetCode("owner@x.com")
  
  const [r1, r2] = await Promise.allSettled([
    supabase.rpc("join_household", { code }).auth("user1@x.com"),
    supabase.rpc("join_household", { code }).auth("user2@x.com")
  ])
  
  const successes = [r1, r2].filter(r => r.status === "fulfilled" && !r.value.error)
  expect(successes.length).toBe(2)
  // Invite code é multi-use; garantia de consistência é 1 vínculo ativo por usuário
})
```

**Evidência**:
- [ ] RPCs usam `BEGIN; ... COMMIT;` ou são transacionais por default
- [ ] Índice parcial único em `household_members(user_id) WHERE left_at IS NULL`
- [ ] Testes acima passam

---

### Lei 9: Exposição Mínima de Dados

**Aplicação ao módulo**:
- [ ] Lista de membros retorna: `id`, `user_id`, `full_name`, `role`, `joined_at`, `left_at`. NÃO retorna: email, avatar_url interna, metadata.
- [ ] Audit retorna: `action`, `performed_at`, `user_full_name`, `performer_full_name`. NÃO retorna: UUIDs, emails.
- [ ] Erro de código inválido/expirado: mensagem genérica idêntica.
- [ ] Invite code não aparece em logs ou URLs.

**O que testar**:
- Response de membros não contém email.
- Response de audit não contém UUIDs.
- Erro de join com código inexistente vs expirado → mensagem idêntica.

**Como testar**:
```typescript
test("SECURITY-9: lista de membros não expõe email", async () => {
  await seedHouseholdWithMember("maria@x.com", "joao@x.com")
  await loginAs("maria@x.com")
  
  const { data } = await supabase
    .from("household_members")
    .select("*, user_profiles(full_name)")
  
  data.forEach(member => {
    expect(member).not.toHaveProperty("email")
    expect(member.user_profiles).not.toHaveProperty("email")
  })
})

test("SECURITY-9: audit expõe apenas nomes, não UUIDs no response formatado", async () => {
  await loginAs("owner@x.com")
  
  const auditFormatted = await getFormattedAuditHistory()
  
  auditFormatted.forEach(entry => {
    expect(entry.description).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/) // UUID pattern
    expect(entry).not.toHaveProperty("user_id")
    expect(entry).not.toHaveProperty("performed_by")
  })
})

test("SECURITY-9: erro de join não revela se código existe", async () => {
  await loginAs("user@x.com")
  
  const r1 = await supabase.rpc("join_household", { code: "NOEXIS" }) // não existe
  const r2 = await supabase.rpc("join_household", { code: expiredCode }) // expirado
  
  expect(r1.error?.message).toBe("Código inválido ou expirado")
  expect(r2.error?.message).toBe("Código inválido ou expirado")
  expect(r1.error?.message).toBe(r2.error?.message) // IDÊNTICOS
})
```

**Evidência**:
- [ ] View ou RPC retorna campos explícitos (não `SELECT *`)
- [ ] Componente `AuditHistory` formata dados antes de exibir
- [ ] RPC `join_household` retorna erro genérico
- [ ] Testes acima passam

---

### Lei 10: Sanitização de Output (XSS/Injection Prevention)

**Aplicação ao módulo**:
- [ ] Nome do household renderizado via `{}` (React escape).
- [ ] Nomes no audit renderizados via `{}`.
- [ ] ZERO uso de `dangerouslySetInnerHTML` em componentes deste módulo.
- [ ] Invite code exibido em `<code>` sem innerHTML.

**O que testar**:
- Criar household com nome `<script>alert('xss')</script>` → renderiza como texto.
- Audit com nome de usuário contendo HTML → escapado.

**Como testar**:
```typescript
test("SECURITY-10: nome do household com XSS é escapado", async () => {
  await createHousehold({ name: "<img src=x onerror='alert(1)'>" })
  
  render(<HouseholdHeader />)
  
  const nameEl = screen.getByText(/img src=x/i)
  expect(nameEl.outerHTML).not.toContain("onerror")
  expect(nameEl.tagName.toLowerCase()).not.toBe("img")
})

test("SECURITY-10: nenhum dangerouslySetInnerHTML em onboarding/household", async () => {
  const files = await glob("src/features/{onboarding,household}/**/*.{ts,tsx}")
  
  for (const file of files) {
    const content = await fs.readFile(file, "utf-8")
    expect(content).not.toContain("dangerouslySetInnerHTML")
  }
})
```

**Evidência**:
- [ ] Grep no projeto retorna 0 `dangerouslySetInnerHTML` em `src/features/onboarding/` e `src/features/household/`
- [ ] Testes acima passam

---

### Lei 11: Segredos Nunca no Bundle

**Aplicação ao módulo**:
- [ ] Invite code gerado server-side (RPC ou Edge Function), não no client.
- [ ] Nenhuma chave de API ou service role no frontend.
- [ ] Charset do código está em constante, não em env var secreta.

**O que testar**:
- Grep em `src/` por patterns de secrets → 0 matches.
- Build output não contém service role key.
- Função de geração de código está em RPC, não em `src/`.

**Como testar**:
```bash
# Grep no source
grep -r "service_role\|SUPABASE_SERVICE\|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" src/ \
  && echo "❌ SECRETS EXPOSED" \
  || echo "✅ No hardcoded secrets"

# Verificar que geração de código está em RPC
grep -r "generate.*invite.*code\|INVITE_CHARSET" src/ \
  && echo "⚠️ Code generation logic in client (review)" \
  || echo "✅ Code generation in RPC"
```

**Evidência**:
- [ ] Função `generate_invite_code()` está em migration SQL usando `gen_random_bytes()` (pgcrypto), **não** `random()` (RN-5.1)
- [ ] `src/features/onboarding/lib/constants.ts` contém apenas constantes públicas (EXPIRY_HOURS, CODE_LENGTH, CODE_CHARSET)
- [ ] Scan acima passa
- [ ] `CREATE EXTENSION IF NOT EXISTS pgcrypto` presente na migration

---

### Lei 12: Upload e SSRF Zero-Trust

**Aplicação ao módulo**:
- [ ] Este módulo NÃO tem uploads diretos.
- [ ] Expandir policy de `avatars` para permitir SELECT entre members do household.

**O que testar**:
- Member do household A pode ver avatar de outro member do mesmo household.
- Member do household A NÃO pode ver avatar de member do household B.

**Como testar**:
```typescript
test("SECURITY-12: member vê avatar de colega do mesmo household", async () => {
  const { mariaId, joaoId, householdId } = await seedHouseholdWithMember("maria@x.com", "joao@x.com")
  
  // Maria fez upload de avatar
  await uploadAvatar(mariaId, "maria-avatar.jpg")
  
  // João consegue ver
  await loginAs("joao@x.com")
  const { data, error } = await supabase.storage
    .from("avatars")
    .download(`${mariaId}/avatar.jpg`)
  
  expect(error).toBeNull()
  expect(data).toBeTruthy()
})

test("SECURITY-12: member NÃO vê avatar de outro household", async () => {
  const { pedroId } = await seedHousehold("pedro@x.com") // outro household
  await uploadAvatar(pedroId, "pedro-avatar.jpg")
  
  await loginAs("maria@x.com") // household diferente
  const { error } = await supabase.storage
    .from("avatars")
    .download(`${pedroId}/avatar.jpg`)
  
  expect(error).toBeTruthy()
  expect(error.message).toMatch(/policy|denied|unauthorized/i)
})
```

**Evidência**:
- [ ] Storage policy `avatars_select` expandida: `bucket_id = 'avatars' AND (folder_owner = auth.uid() OR folder_owner IN (SELECT user_id FROM household_members WHERE household_id = get_user_household_id() AND left_at IS NULL))`
- [ ] Testes acima passam

---

### Lei 13: Dependency e Supply Chain Awareness

**Aplicação ao módulo**:
- [ ] `pnpm audit --prod` sem vulnerabilidades críticas/altas.
- [ ] Dependências usadas: apenas libs já existentes no projeto (Zustand, React Query, Zod, React Router).
- [ ] Nenhum pacote novo adicionado (ou se adicionar, verificar npmjs.com).

**O que testar**:
- `pnpm audit` retorna 0 critical/high.
- Nenhum pacote "phantom" (inventado pela IA).

**Como testar**:
```bash
pnpm audit --prod --json | jq '.metadata.vulnerabilities'
# Expected: { "critical": 0, "high": 0 }

# Verificar package.json diff
git diff HEAD~1 package.json | grep "^\+"
# Se houver novas deps, verificar em npmjs.com
```

**Evidência**:
- [ ] Output do `pnpm audit` limpo
- [ ] Nenhuma nova dependência adicionada (ou justificativa se houver)

---

### Lei 14: Logging Seguro e Observável

**Aplicação ao módulo**:
- [ ] Tentativas de join (válidas/inválidas) logadas com: `user_id`, `timestamp`, `code_hash` (NUNCA código plain).
- [ ] Audit trail registra TODAS as ações de membership (joined, left, removed).
- [ ] Erros de RPC logados com contexto (user, action, error_code), sem stack traces para client.
- [ ] Invite code NUNCA aparece em logs (hash se necessário).

**O que testar**:
- Log de tentativa de join não contém código plain.
- Audit trail tem entries para todas as ações.
- Erro de validação logado com contexto, sem dados sensíveis.

**Como testar**:
```typescript
test("SECURITY-14: log de join não contém código plain", async () => {
  const logs: string[] = []
  const spy = vi.spyOn(console, "info").mockImplementation((...args) => {
    logs.push(JSON.stringify(args))
  })
  
  await supabase.rpc("join_household", { code: "ABC123" })
  
  spy.mockRestore()
  
  const allLogs = logs.join("\n")
  expect(allLogs).not.toContain("ABC123")
  expect(allLogs).toMatch(/join.*attempt|code_hash/i) // log existe, mas com hash
})

test("SECURITY-14: audit trail registra todas as ações", async () => {
  const householdId = await seedHousehold("maria@x.com")
  await joinHousehold("joao@x.com", householdId)
  await leaveHousehold("joao@x.com")
  
  const { data } = await adminClient
    .from("household_member_audit")
    .select("action")
    .eq("household_id", householdId)
    .order("performed_at")
  
  expect(data.map(d => d.action)).toEqual(["joined", "joined", "left"])
  // Maria joined (create), João joined, João left
})
```

**Evidência**:
- [ ] RPC `join_household` loga `sha256(code)` em vez de code plain
- [ ] Tabela `household_member_audit` populada em todas as ações
- [ ] Testes acima passam

---

### Lei 15: Configuração Segura por Padrão

**Aplicação ao módulo**:
- [ ] HTTPS obrigatório em produção (Vite dev permite HTTP localhost).
- [ ] Invite code transmitido via POST body (não URL query param).
- [ ] Cookies do Supabase: HttpOnly, Secure, SameSite=Strict.
- [ ] Source maps desabilitados em produção.

**O que testar**:
- Formulário de join usa POST, não GET.
- Código não aparece em URL/browser history.
- Build de produção não tem source maps.

**Como testar**:
```typescript
test("SECURITY-15: join usa POST, não GET", async () => {
  const spy = vi.spyOn(supabase, "rpc")
  
  await joinHousehold("ABC123")
  
  expect(spy).toHaveBeenCalledWith("join_household", { code: "ABC123" })
  // Supabase RPC usa POST por default
})

test("SECURITY-15: código não aparece na URL", async () => {
  render(<JoinHouseholdForm />)
  
  await userEvent.type(screen.getByLabelText(/código/i), "ABC123")
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }))
  
  expect(window.location.href).not.toContain("ABC123")
  expect(window.location.search).not.toContain("code=")
})

test("SECURITY-15: build sem source maps", async () => {
  await exec("pnpm build")
  const mapFiles = await glob("dist/**/*.map")
  
  expect(mapFiles.length).toBe(0)
})
```

**Evidência**:
- [ ] Formulário não usa `action="GET"` ou query params
- [ ] `vite.config.ts` com `build.sourcemap = false` (ou default)
- [ ] Testes acima passam

---

## Anti-padrões de Vibe Coding (A1-A10) — Verificação Específica

| # | Anti-padrão | Como evitar neste módulo | Testado por |
|---|-------------|--------------------------|-------------|
| **A1** | Segurança só no cliente | RLS em todas as tabelas. RPCs extraem identidade de `auth.uid()`. Client só faz UX. | Lei 1, 5, 7 |
| **A2** | Auth removido para "resolver bug" | Code review obrigatório. RLS policies não removidas sem justificativa documentada. | Lei 6 + code review |
| **A3** | Secrets hardcoded | Invite code gerado server-side. Grep automatizado. | Lei 11 |
| **A4** | RLS desabilitado | Migration explícita `ENABLE ROW LEVEL SECURITY`; teste SQL no `/sec-audit`. | Lei 7 |
| **A5** | Middleware fantasma | N/A (Supabase já é middleware). Rate-limit em RPC documentado. | Lei 4 |
| **A6** | Error swallowing | Logger wrapper + ESLint `no-empty-catch`. Erros de RPC propagados ao UI. | Lei 14 |
| **A7** | Permissões excessivas | Anon key apenas. Service role só em migrations. | Lei 11 |
| **A8** | Validação ausente em Server Actions | N/A (sem server actions; usa Supabase RPC com validação). | — |
| **A9** | Exposição de admin por default | Audit trail só visível para owner (RLS). Regenerar código só para owner. | Lei 6, 9 |
| **A10** | Paginação sem limite | Lista de membros: LIMIT 100. Audit: LIMIT 500 + paginação. | Lei 3 |

---

## Resumo: Conformidade com 15 Leis

| Lei | Aplicável? | Testada? | Evidência | Status |
|-----|------------|----------|-----------|--------|
| 1 — Nunca confie no cliente | ✅ SIM | [ ] | RPCs usam `auth.uid()` | ⏳ |
| 2 — Schema restrito | ✅ SIM | [ ] | Zod `.strict()` + RPCs explícitos | ⏳ |
| 3 — Limites de tamanho | ✅ SIM | [ ] | Constraints + LIMIT em queries | ⏳ |
| 4 — Proteção de perímetro | ✅ SIM | [ ] | Rate-limit em join (5/min) | ⏳ |
| 5 — Identidade extraída | ✅ SIM | [ ] | `get_user_household_id()` + RLS | ⏳ |
| 6 — Autorização em cada op | ✅ SIM | [ ] | Owner-only para regenerate, remove, audit | ⏳ |
| 7 — RLS e tenant isolation | ✅ SIM | [ ] | RLS em 3 tabelas + `FORCE RLS` | ⏳ |
| 8 — Atomicidade transacional | ✅ SIM | [ ] | RPCs transacionais | ⏳ |
| 9 — Exposição mínima | ✅ SIM | [ ] | Campos explícitos + erro genérico | ⏳ |
| 10 — Sanitização de output | ✅ SIM | [ ] | React escape + zero `dangerouslySetInnerHTML` | ⏳ |
| 11 — Segredos no bundle | ✅ SIM | [ ] | Code gerado server-side | ⏳ |
| 12 — Upload & SSRF | ⚠️ PARCIAL | [ ] | Sem upload neste módulo; expandir policy avatars | ⏳ |
| 13 — Supply chain | ✅ SIM | [ ] | `pnpm audit` limpo | ⏳ |
| 14 — Logging seguro | ✅ SIM | [ ] | Audit trail + logs sem código plain | ⏳ |
| 15 — Config por padrão | ✅ SIM | [ ] | HTTPS + POST + sem source maps | ⏳ |

**Conformidade Total**: ⏳ —% (Target: 100%)
**Score de Segurança**: ⏳ — (Target: ≥ B)
**Anti-padrões A1-A10**: ⏳ — detectados (Target: 0)

---

## Notas de Segurança Específicas

### Invite Code — Considerações de Brute-Force

- **Charset**: 32 caracteres (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, exclui 0/O, 1/I/L) → **32⁶ ≈ 1,07 bilhão** de combinações.
- **Entropia**: `log2(32⁶) = 30 bits` — adequado para códigos temporários (48h).
- **RNG**: `gen_random_bytes()` (CSPRNG via pgcrypto, RN-5.1). Não `random()`.
- **Rate-limit por usuário**: 5 tentativas/min = 300/hora = 7.200/dia (RN-15).
- **GC da tabela de rate-limit**: trigger apaga buckets > 1h (RN-15.4) — evita growth unbounded.
- **Tempo médio esperado para acertar sem rate-limit**: ~148.000 dias (405 anos) para 1 conta. Com rate-limit, inviável.
- **Mitigação pendente (RN-15.3)**: rate-limit por IP + captcha para caso de atacante com múltiplas contas — módulo futuro de segurança.
- **Mitigação pendente**: expiração mais curta opcional (24h), notificação de tentativas falhas.

### Audit Trail — Imutabilidade

- **RLS para audit**: INSERT permitido para authenticated, SELECT apenas para owner, UPDATE/DELETE bloqueados para todos
- **Verificação**: teste que confirma `pg_policy` não tem policy de UPDATE/DELETE
- **Backup**: registros de audit são críticos para compliance futuro (LGPD)

### Soft Delete — Privacidade

- **`left_at` preenchido**: member não aparece em queries normais (filter `left_at IS NULL`)
- **Dados permanecem**: contas fixas, despesas do member continuam no household (decisão de negócio)
- **Re-entry**: novo registro em `household_members`, histórico preservado
