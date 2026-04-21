# Segurança: Módulo [NÚMERO-NOME]

> ⚠️ **INSTRUÇÃO**: Para cada uma das 15 Leis, descreva:
> 1. **O que testar** — qual comportamento está coberto.
> 2. **Como testar** — código/comando de teste.
> 3. **Evidência** — artefato que prova conformidade.
> 
> Todas as checkboxes devem estar ✅ antes de `/module-finish`.

---

## 15 Leis de Arquitetura Segura (da [docs/SECURITY.md](../../docs/SECURITY.md))

### Lei 1: Nunca Confie no Cliente

**Aplicação ao módulo**:
- [ ] Toda entrada de user (form, query param, header customizado) é validada no backend ANTES de usar.
- [ ] Cliente não determina `household_id`, `author_id`, ou qualquer discriminador de acesso.

**O que testar**:
- Enviar `householdId` forjado no body → API rejeita (extrai do JWT/session).
- Enviar `authorId` forjado → API rejeita (extrai de `auth.uid()`).

**Como testar**:
```typescript
test("SECURITY-1: rejeita householdId forjado no body", async () => {
  const res = await fetch("/api/bills", {
    method: "POST",
    body: JSON.stringify({
      name: "Conta",
      value: 100,
      householdId: "hh-fake", // forjado
      authorId: "user-fake",  // forjado
    }),
    headers: { Authorization: `Bearer ${validToken}` },
  })
  
  expect(res.status).toBe(403) // Forbidden, não 201
})
```

**Evidência**:
- [ ] RPC ou mutation extrai `household_id = get_user_household_id()` (função security definer).
- [ ] Teste passa no repositório.

---

### Lei 2: Schema Restrito (Mass Assignment Protection)

**Aplicação ao módulo**:
- [ ] Aceita APENAS campos explícitos: `name`, `value`, `dueDay`, `categoryId`, `shared`, `status`.
- [ ] Rejeita silenciosamente ou retorna erro se campos extras vêm no body (ex: `_internal_flag`).

**O que testar**:
- POST com campo extra → é ignorado ou erro claro (não aceito).

**Como testar**:
```typescript
test("SECURITY-2: ignora campos não-whitelisted no body", async () => {
  const res = await fetch("/api/bills", {
    method: "POST",
    body: JSON.stringify({
      name: "Conta",
      value: 100,
      dueDay: 5,
      categoryId: "cat-1",
      _internalFlag: true, // não existe no schema
    }),
    headers: { Authorization: `Bearer ${validToken}` },
  })
  
  const data = res.json()
  expect(data).not.toHaveProperty("_internalFlag")
})
```

**Evidência**:
- [ ] Schema Zod ou validation explícita define `.pick()` ou `.strip()`.
- [ ] Teste passa.

---

### Lei 3: Limites de Tamanho e Taxa (DoS Prevention)

**Aplicação ao módulo**:
- [ ] Campo `name`: max 255 chars.
- [ ] `value`: max numeric(12,2), sem limite prático.
- [ ] File attachment: max 10MB.
- [ ] List queries: `LIMIT` máximo (ex: 1000), paginação obrigatória.

**O que testar**:
- POST com `name` > 255 chars → rejeição.
- GET `/bills?limit=999999` → capped a 1000 (ou retorna erro).
- Upload arquivo > 10MB → rejeição no cliente + backend.

**Como testar**:
```typescript
test("SECURITY-3: rejeita name > 255 chars", async () => {
  const res = await fetch("/api/bills", {
    method: "POST",
    body: JSON.stringify({
      name: "a".repeat(256),
      value: 100,
      dueDay: 5,
      categoryId: "cat-1",
    }),
    headers: { Authorization: `Bearer ${validToken}` },
  })
  
  expect(res.status).toBe(400)
})

test("SECURITY-3: GET /bills limita a 1000 itens", async () => {
  const res = await fetch("/api/bills?limit=999999", {
    headers: { Authorization: `Bearer ${validToken}` },
  })
  
  const { data } = await res.json()
  expect(data.length).toBeLessThanOrEqual(1000)
})
```

**Evidência**:
- [ ] Schema + RPC com `LIMIT 1000`.
- [ ] Testes passam.
- [ ] File upload rejeita > 10MB no Edge Function.

---

### Lei 4: Proteção de Perímetro (Middleware Shield)

**Aplicação ao módulo**:
- [ ] CORS: aceita apenas origin esperado (localhost:5173 dev, production URL prod).
- [ ] Rate limiting: endpoint de create/update limita a X requests/min.
- [ ] Anti-CSRF: se não usar SameSite=Strict, valida token CSRF (improvável em SPA pura).

**O que testar**:
- Request de origin desconhecida → CORS error (browser bloqueia).
- 100 requests/min para POST /bills → 101º é rate-limited.

**Como testar**:
```typescript
test("SECURITY-4: rate-limiting em POST /bills", async () => {
  for (let i = 0; i < 100; i++) {
    await fetch("/api/bills", { method: "POST", ... })
  }
  
  const res = await fetch("/api/bills", { method: "POST", ... })
  expect(res.status).toBe(429) // Too Many Requests
})
```

**Evidência**:
- [ ] API Gateway ou middleware com rate-limiting ativado.
- [ ] Teste passa (ou monitora comportamento em staging).

---

### Lei 5: Identidade Extraída, Nunca Recebida (IDOR/BOLA Protection)

**Aplicação ao módulo**:
- [ ] Usuário A não consegue ler/editar/deletar bill de usuário B passando `billId`.
- [ ] `author_id` extraído de JWT/session, NUNCA de input.

**O que testar**:
- Usuário B pede `GET /bills/{billIdDaMaria}` → 403 Forbidden (RLS nega).
- Usuário B pede `PUT /bills/{billIdDaMaria}` com dados → 403.

**Como testar**:
```typescript
test("SECURITY-5: usuário A não lê bill de usuário B (RLS)", async () => {
  const billFromMaria = await createBill({ author: "maria", householdId: "hh-1" })
  
  const res = await fetch(`/api/bills/${billFromMaria.id}`, {
    headers: { Authorization: `Bearer ${johnToken}` }, // John tenta
  })
  
  expect(res.status).toBe(403) // ou 404 (mais seguro)
})
```

**Evidência**:
- [ ] RLS policy em `fixed_bills` table: `USING (household_id = get_user_household_id())`.
- [ ] Se mesmo household, usuário vê (depende de `view_mode`); se outro household, RLS nega 100%.
- [ ] Teste E2E passa.

---

### Lei 6: Autorização em Cada Operação

**Aplicação ao módulo**:
- [ ] DELETE bill → apenas `author_id` ou household owner podem deletar.
- [ ] EDIT bill → apenas `author_id` ou household owner.
- [ ] Admin endpoint (se houver) → apenas role=owner.

**O que testar**:
- Maria (author) deleta sua bill → sucesso.
- Maria (não-author, member) tenta deletar bill de João → rejeição.
- João (owner, member) tenta deletar bill de Maria (outro member) → rejeição (não é admin).

**Como testar**:
```typescript
test("SECURITY-6: member não deleta bill de outro member", async () => {
  const mariasBill = await createBill({ author: "maria", householdId: "hh-1" })
  
  const res = await fetch(`/api/bills/${mariasBill.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${joãoMemberToken}` },
  })
  
  expect(res.status).toBe(403)
})
```

**Evidência**:
- [ ] RLS policy DELETE: `USING (author_id = auth.uid())`.
- [ ] Se owner deveria poder deletar any bill, adicionar: `OR is_household_owner()`.
- [ ] Teste passa.

---

### Lei 7: Row Level Security e Tenant Isolation

**Aplicação ao módulo**:
- [ ] RLS ENABLED em `fixed_bills`, `bill_value_history`.
- [ ] Policy em SELECT, INSERT, UPDATE, DELETE.
- [ ] Teste de isolamento: dois households, dados não vazam.

**O que testar**:
- Household A criou bill → Household B não vê.
- Query sem filtro deliberado de `household_id` → RLS bloqueia.
- RLS não está `USING (true)` (permissivo).

**Como testar**:
```sql
-- Verificar RLS está ON
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'fixed_bills';
-- Resultado: rowsecurity = true

-- Testar isolamento
SELECT * FROM fixed_bills WHERE household_id != get_user_household_id();
-- Resultado: 0 rows (RLS nega)
```

**Evidência**:
- [ ] `ALTER TABLE fixed_bills ENABLE ROW LEVEL SECURITY;` no migrations.
- [ ] Policy test: `src/features/bills/__tests__/rls-isolation.test.ts` (Playwright + SQL).
- [ ] Teste passa.

---

### Lei 8: Atomicidade Transacional (Race Condition Prevention)

**Aplicação ao módulo**:
- [ ] CREATE bill: não duplica mesmo se request retried 2x.
- [ ] UPDATE bill value: registra em `bill_value_history` na mesma transação, ou jamais.

**O que testar**:
- 2 requests simultâneos de CREATE bill idêntica → apenas 1 é criado.
- Falha na transação → nenhuma row fica orphaned.

**Como testar**:
```typescript
test("SECURITY-8: CREATE bill idempotente (mesma request 2x = 1 bill)", async () => {
  const payload = { name: "Internet", value: 150, dueDay: 5, categoryId: "cat-1" }
  
  const [res1, res2] = await Promise.all([
    fetch("/api/bills", { method: "POST", body: JSON.stringify(payload), ... }),
    fetch("/api/bills", { method: "POST", body: JSON.stringify(payload), ... }),
  ])
  
  expect(res1.status).toBe(201)
  expect(res2.status).toBe(201) // ou 409 se unique constraint
  
  const bills = await db.query("SELECT * FROM fixed_bills WHERE name=$1", ["Internet"])
  expect(bills.length).toBe(1) // somente 1
})
```

**Evidência**:
- [ ] Migration usa `BEGIN; ... COMMIT;` ou RPC com `BEGIN ... COMMIT`.
- [ ] Trigger `log_bill_value_change()` roda within transaction.
- [ ] Teste passa.

---

### Lei 9: Exposição Mínima de Dados

**Aplicação ao módulo**:
- [ ] GET `/bills` retorna APENAS: id, name, value, dueDay, categoryId, status, shared, authorId, created_at.
- [ ] NUNCA retorna internals: `_internal_*`, service role keys, raw email de outros users.
- [ ] Attachment URLs são presigned (temporários), não públicos.

**O que testar**:
- GET `/bills` response não inclui `bill_value_history` (separado).
- Attachment URL é presigned (expira).

**Como testar**:
```typescript
test("SECURITY-9: GET /bills não expõe bill_value_history", async () => {
  const res = await fetch("/api/bills", {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  const bills = await res.json()
  expect(bills[0]).toHaveProperty("id")
  expect(bills[0]).not.toHaveProperty("_valueHistory")
})

test("SECURITY-9: attachment URL é presigned com expiração", async () => {
  const res = await fetch(`/api/bills/${billId}/attachment`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  const { url, expiresIn } = await res.json()
  expect(url).toContain("?token=") // presigned
  expect(expiresIn).toBeLessThan(3600) // < 1h
})
```

**Evidência**:
- [ ] API response schema documentado (Zod).
- [ ] Testes passam.

---

### Lei 10: Sanitização de Output (XSS/Injection Prevention)

**Aplicação ao módulo**:
- [ ] Bill `name` exibida no HTML — é escapada pelo React (default).
- [ ] NUNCA `dangerouslySetInnerHTML` em nome.
- [ ] Se salvar HTML intent, sanitize na saída.

**O que testar**:
- Criar bill com `name: "<script>alert('xss')</script>"` → renderiza como texto, não executa script.

**Como testar**:
```typescript
test("SECURITY-10: bill name com XSS payload é escapado no HTML", async () => {
  const bill = await createBill({
    name: "<img src=x onerror='alert(\"xss\")'>",
    value: 100,
    dueDay: 5,
    categoryId: "cat-1",
  })
  
  render(<BillsList />)
  const billNameEl = screen.getByText(/img src=x/i) // texto, não HTML tag
  expect(billNameEl.outerHTML).not.toContain("onerror")
})
```

**Evidência**:
- [ ] React renderiza com `{}` (safe default).
- [ ] Teste passa.
- [ ] Se usar `@react-pdf/renderer`, verifica que sanitiza também.

---

### Lei 11: Segredos Nunca no Bundle

**Aplicação ao módulo**:
- [ ] NUNCA: API keys, `service_role` key, JWT secrets em `src/`.
- [ ] VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY são OK (públicas).
- [ ] Edge Functions: use env vars (Supabase secrets), não hardcode.

**O que testar**:
- Grep por `supabase_key`, `apiKey`, `secret` em `src/` → zero matches.
- Build output (`dist/`) não contém secrets.

**Como testar**:
```bash
# Command: /sec-secrets-scan (já definido em commands)
grep -r "supabase_key\|service_role\|secret" src/ \
  && echo "❌ Secrets found!" \
  || echo "✅ No hardcoded secrets"

# Verificar .env.example documenta apenas vars públicas
cat .env.example
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# (sem secret_key ou service_role)
```

**Evidência**:
- [ ] `.env.example` listado no repositório (sem valores reais).
- [ ] `.env` em `.gitignore`.
- [ ] Scan `/sec-secrets-scan` passou em staging.

---

### Lei 12: Upload e SSRF Zero-Trust

**Aplicação ao módulo**:
- [ ] Upload de attachment: validar magic bytes (não extensão).
- [ ] Max file size: 10MB.
- [ ] Salvo em: `/{household_id}/{user_id}/{filename}` com RLS.

**O que testar**:
- Upload .exe com extensão .jpg → rejeição (magic byte).
- Upload .jpg > 10MB → rejeição.
- File URL acessível apenas por household member.

**Como testar**:
```typescript
test("SECURITY-12: rejeita file com magic byte inválido", async () => {
  const exeFile = await fetch("/archive/bin.exe").then(r => r.blob())
  const formData = new FormData()
  formData.append("attachment", exeFile, "image.jpg") // falso .jpg
  
  const res = await fetch("/api/bills/upload", {
    method: "POST",
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
  })
  
  expect(res.status).toBe(400) // Bad format
})
```

**Evidência**:
- [ ] Edge Function valida magic bytes antes de aceitar.
- [ ] Teste passa.
- [ ] File stored em `supabase/storage/household-docs` com RLS.

---

### Lei 13: Dependency e Supply Chain Awareness

**Aplicação ao módulo**:
- [ ] Nenhuma dependency com CVE conhecido.
- [ ] Nenhuma dependency abandonada (sem commit > 12 meses).
- [ ] `pnpm audit` limpo.

**O que testar**:
- `pnpm audit` → 0 vulnerabilidades críticas/altas.
- Dependências com manutenção ativa (commit recent).

**Como testar**:
```bash
# Command: /sec-deps-audit (já definido em commands)
pnpm audit --prod
npm outdated
```

**Evidência**:
- [ ] `pnpm audit` output mostrado (0 vulns).
- [ ] Relatório no PR ou em `specs/modules/NN/security.md`.

---

### Lei 14: Logging Seguro e Observável

**Aplicação ao módulo**:
- [ ] Erro de validação: log com contexto (IP, user, action, timestamp).
- [ ] Senhas, tokens, números de cartão: NUNCA logados.
- [ ] Stack trace: genérico ao cliente, full ao log interno.

**O que testar**:
- Criar bill com dados inválidos → log mostra "user X attempted POST /bills at Y" (sem dados sensíveis).
- Erro inteiro → log contém stack trace, cliente vê apenas "Erro ao salvar".

**Como testar**:
```typescript
test("SECURITY-14: erro de validação logado com contexto (sem dados sensíveis)", () => {
  const logs: string[] = []
  const originalLog = console.log
  console.log = (msg) => logs.push(msg)
  
  // Trigger erro
  try {
    createBill({ name: "", value: -50 })
  } catch (e) {
    logSecurityEvent("bill_create_failed", { userId, householdId, error: e.message })
  }
  
  console.log = originalLog
  
  const lastLog = logs[logs.length - 1]
  expect(lastLog).toContain("bill_create_failed")
  expect(lastLog).toContain(userId)
  expect(lastLog).not.toContain("password") // never
})
```

**Evidência**:
- [ ] Logger wrapper em `src/lib/logger.ts` sanitiza sensitive fields.
- [ ] Teste passa.

---

### Lei 15: Configuração Segura por Padrão

**Aplicação ao módulo**:
- [ ] Headers de segurança: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy` (se aplicável).
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=Strict`.
- [ ] Source maps: não expostos em produção.

**O que testar**:
- Resposta HTTP contém headers de segurança.
- Cookies session têm `HttpOnly` flag.

**Como testar**:
```typescript
test("SECURITY-15: response headers seguem padrão seguro", async () => {
  const res = await fetch("/api/bills", {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
  expect(res.headers.get("X-Frame-Options")).toBe("DENY")
})
```

**Evidência**:
- [ ] Middleware ou API gateway adiciona headers (ex: Vercel ou Supabase Edge Function).
- [ ] Teste passa.

---

## Resumo: Conformidade com 15 Leis

| Lei | Aplicável? | Testada? | Evidência | Status |
|-----|-----------|----------|----------|--------|
| 1 — Nunca confie no cliente | ✅ | [ ] | RPC extrai identidade | ⏳ |
| 2 — Schema restrito | ✅ | [ ] | Zod `.pick()` | ⏳ |
| 3 — Limites de tamanho | ✅ | [ ] | Validação + LIMIT | ⏳ |
| 4 — Proteção de perímetro | ⚠️ | [ ] | Rate-limiting (se aplicável) | ⏳ |
| 5 — Identidade extraída | ✅ | [ ] | RLS + JWT | ⏳ |
| 6 — Autorização em cada op | ✅ | [ ] | RLS policy DELETE | ⏳ |
| 7 — RLS e tenant isolation | ✅ | [ ] | RLS ON + policy test | ⏳ |
| 8 — Atomicidade transacional | ✅ | [ ] | BEGIN...COMMIT | ⏳ |
| 9 — Exposição mínima | ✅ | [ ] | Schema resposta | ⏳ |
| 10 — Sanitização de output | ✅ | [ ] | React default escape | ⏳ |
| 11 — Segredos no bundle | ✅ | [ ] | Grep + build check | ⏳ |
| 12 — Upload & SSRF | ✅ | [ ] | Magic bytes + path | ⏳ |
| 13 — Supply chain | ✅ | [ ] | pnpm audit | ⏳ |
| 14 — Logging seguro | ✅ | [ ] | Logger sanitizado | ⏳ |
| 15 — Config por padrão | ✅ | [ ] | Headers + cookies | ⏳ |

**Conformidade Total**: [XX]% (Target: 100%)
**Score de Segurança**: [—] (A/B/C, Target: A)

---

## Notes

- Adicione descobertas, mitigações, ou decisões de design aqui.
- Se descobrir que Lei X não é aplicável (ex: Lei 4 rate-limiting em MVP), explique por quê.

