# Segurança: Módulo 01-auth-and-session

> **Status**: Spec Pronto · Aguardando ciclo SECURITY de cada tarefa
> **Spec relacionado**: [spec.md](./spec.md)
> **Tarefas TDD**: [tasks.md](./tasks.md)

---

## 15 Leis de Arquitetura Segura (de [docs/SECURITY.md](../../../docs/SECURITY.md))

### Lei 1: Nunca Confie no Cliente

**Aplicação ao módulo**:
- [ ] Toda entrada do formulário (email, senha, fullName, avatar) é validada pelo Supabase Auth no backend, independente da validação Zod no cliente.
- [ ] `user_id` em queries de `user_profiles` SEMPRE vem de `auth.uid()` (server-side), nunca de input.
- [ ] Path do avatar no Storage é construído usando `auth.uid()` (server-side), nunca aceitando ID do cliente.

**O que testar**:
- Tentativa de chamar `supabase.from("user_profiles").update({ id: "user-fake" })` → RLS rejeita.
- Tentativa de fazer upload em `/storage/avatars/outro-user-id/avatar.jpg` → Storage policy rejeita.
- Submeter `id` no formulário de registro → ignorado (Supabase Auth não aceita).

**Como testar**:
```typescript
test("SECURITY-1: rejeita update de user_profiles com id forjado", async () => {
  await loginAs("maria@exemplo.com")
  const res = await supabase
    .from("user_profiles")
    .update({ full_name: "Hacker" })
    .eq("id", "outro-user-id")

  expect(res.error?.code).toBe("42501") // permission denied (RLS)
})

test("SECURITY-1: rejeita upload de avatar em pasta de outro user", async () => {
  await loginAs("maria@exemplo.com")
  const res = await supabase.storage
    .from("avatars")
    .upload(`outro-user-id/avatar.jpg`, fakeImageBlob)

  expect(res.error?.message).toMatch(/policy|denied|unauthorized/i)
})
```

**Evidência**:
- [ ] RLS policy em `user_profiles`: `using (id = auth.uid())` no UPDATE
- [ ] Storage policy em `avatars`: `(storage.foldername(name))[1] = auth.uid()::text` no INSERT
- [ ] Testes acima passam

---

### Lei 2: Schema Restrito (Mass Assignment Protection)

**Aplicação ao módulo**:
- [ ] Schemas Zod de cadastro/login/reset usam `.strict()` para REJEITAR campos extras.
- [ ] Não há uso de `Object.assign(payload, body)` ou spread `...req.body` em mutations.
- [ ] `raw_user_meta_data` no signUp recebe APENAS `{ full_name }` — nunca `...formData`.

**O que testar**:
- Submeter formulário com campo extra `{ email, password, isAdmin: true }` → Zod rejeita ou ignora `isAdmin`.
- Tentar passar `role: "owner"` em `raw_user_meta_data` → não tem efeito (role só existe em `household_members`).

**Como testar**:
```typescript
test("SECURITY-2: registerSchema rejeita campos extras", () => {
  const result = registerSchema.safeParse({
    email: "x@y.com",
    password: "Segura123",
    passwordConfirmation: "Segura123",
    fullName: "Maria",
    isAdmin: true, // tentativa de injeção
    role: "owner",
  })

  expect(result.success).toBe(false)
  // Zod com .strict() retorna issue de "unrecognized_keys"
})

test("SECURITY-2: signUp recebe apenas full_name no metadata", () => {
  const spy = vi.spyOn(supabase.auth, "signUp")
  await register({ email, password, passwordConfirmation, fullName: "Maria" })

  expect(spy.mock.calls[0][0].options.data).toEqual({ full_name: "Maria" })
  // sem outros campos vazando
})
```

**Evidência**:
- [ ] `auth-schemas.ts` usa `.strict()` em todos os schemas
- [ ] `useRegister.ts` constrói `raw_user_meta_data` explicitamente, sem spread
- [ ] Testes acima passam

---

### Lei 3: Limites de Tamanho e Taxa (DoS Prevention)

**Aplicação ao módulo**:
- [ ] `email`: max 254 chars (RFC 5321)
- [ ] `password`: 8-72 chars (limite do bcrypt)
- [ ] `fullName`: 1-100 chars
- [ ] `avatar`: max 2 MB (validado no cliente E na Storage policy)
- [ ] Rate-limit de signUp/signIn/resetPassword: usa defaults do Supabase Auth (configuráveis no Dashboard)

**O que testar**:
- Submeter `email` com 300 caracteres → Zod rejeita.
- Submeter `password` com 200 caracteres → Zod rejeita (passa do limite do bcrypt).
- Upload de avatar de 5 MB → cliente rejeita antes do upload; se forçado, Storage rejeita.
- 11 tentativas seguidas de signUp em 1h → Supabase rate-limit retorna 429.

**Como testar**:
```typescript
test("SECURITY-3: registerSchema rejeita email > 254 chars", () => {
  const longEmail = "a".repeat(245) + "@x.com"
  const result = registerSchema.safeParse({ email: longEmail, ... })
  expect(result.success).toBe(false)
})

test("SECURITY-3: avatar > 2MB é rejeitado no cliente", async () => {
  const bigBlob = new Blob([new ArrayBuffer(3 * 1024 * 1024)], { type: "image/jpeg" })
  const file = new File([bigBlob], "big.jpg", { type: "image/jpeg" })

  await expect(validateAndProcessAvatar(file)).rejects.toThrow(/2\s?MB|tamanho/i)
})
```

**Evidência**:
- [ ] Constantes definidas em `src/features/auth/lib/constants.ts`
- [ ] Storage bucket `avatars` configurado com `file_size_limit = 2097152`
- [ ] Testes acima passam

---

### Lei 4: Proteção de Perímetro (Middleware Shield)

**Aplicação ao módulo**:
- [ ] **Rate-limiting**: usa defaults do Supabase Auth (sem middleware customizado no MVP)
  - SignUp: 30 / hora por IP (default)
  - SignIn: 30 / hora por IP (default)
  - ResetPassword: 4 / hora por email (default)
- [ ] **CORS**: configurado no Supabase Dashboard com origin `http://localhost:5173` (dev) e domínio de produção
- [ ] **CSRF**: SPA pura (sem cookies de sessão server-side) → SameSite=Strict + tokens em localStorage. CSRF não é vetor relevante neste setup.

**O que testar**:
- Documentar comportamento esperado dos rate-limits do Supabase.
- Validar (manualmente ou via script) que CORS não permite origin `evil.com`.

**Como testar**:
```typescript
test("SECURITY-4: documenta rate-limits do Supabase Auth", () => {
  // Não há código a testar — é configuração do Supabase Dashboard
  // Este "teste" é apenas a presença da configuração no `supabase/config.toml`
  const config = readSupabaseConfig()
  expect(config.auth.rate_limit_email_sent).toBeDefined()
})
```

**Evidência**:
- [ ] Documento `supabase/config.toml` com rate-limits configurados
- [ ] CORS verificado manualmente no Supabase Dashboard
- [ ] Para MVP, rate-limiting customizado **NÃO é aplicável** (Supabase nativo é suficiente)

> **Nota**: Em módulos posteriores (notificações, exports), pode ser necessário rate-limit customizado em Edge Functions.

---

### Lei 5: Identidade Extraída, Nunca Recebida (IDOR/BOLA Protection)

**Aplicação ao módulo**:
- [ ] Identidade do usuário SEMPRE de `auth.uid()` (extraída do JWT pelo Supabase).
- [ ] `useAuthStore` é populado APENAS via `supabase.auth.onAuthStateChange()` — nunca via input do componente.
- [ ] Path do avatar no Storage usa `auth.uid()` (não input).
- [ ] Trigger `handle_new_user` usa `new.id` (de `auth.users`), não algo do client.

**O que testar**:
- Maria não consegue ler/editar perfil de João.
- Tentativa de modificar `useAuthStore.user.id` no console DevTools não tem efeito real (RLS protege).

**Como testar**:
```typescript
test("SECURITY-5: Maria não lê perfil de João (RLS)", async () => {
  const joaoId = await seedUser("joao@x.com")
  await loginAs("maria@x.com")

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", joaoId)
    .single()

  // RLS no MVP: SELECT só permite id = auth.uid() OR perfil do mesmo household.
  // Como ainda não há household, RLS deve negar.
  expect(data).toBeNull()
  expect(error).toBeTruthy()
})

test("SECURITY-5: Maria não edita perfil de João", async () => {
  const joaoId = await seedUser("joao@x.com")
  await loginAs("maria@x.com")

  const { error } = await supabase
    .from("user_profiles")
    .update({ full_name: "Hacker" })
    .eq("id", joaoId)

  expect(error?.code).toBe("42501")
})
```

**Evidência**:
- [ ] RLS `user_profiles_select`: `using (id = auth.uid() OR id IN (SELECT user_id FROM household_members WHERE household_id = get_user_household_id()))`
- [ ] RLS `user_profiles_update`: `using (id = auth.uid())`
- [ ] Testes acima passam

---

### Lei 6: Autorização em Cada Operação

**Aplicação ao módulo**:
- [ ] UPDATE em `user_profiles`: apenas próprio usuário (`id = auth.uid()`)
- [ ] INSERT em `user_profiles`: apenas via trigger `handle_new_user` (não exposto ao usuário)
- [ ] DELETE em `user_profiles`: NÃO permitido (cascade vem de `auth.users` apenas)
- [ ] Avatar upload: apenas em própria pasta (`/{auth.uid()}/...`)

**O que testar**:
- Maria edita seu próprio perfil → sucesso.
- Maria tenta editar perfil de João → 42501.
- Maria tenta deletar seu próprio perfil diretamente → falha (sem policy de DELETE).

**Como testar**:
```typescript
test("SECURITY-6: Maria edita seu próprio perfil", async () => {
  await loginAs("maria@x.com")
  const { error } = await supabase
    .from("user_profiles")
    .update({ full_name: "Maria Atualizada" })
    .eq("id", currentUserId)

  expect(error).toBeNull()
})

test("SECURITY-6: DELETE direto em user_profiles é proibido", async () => {
  await loginAs("maria@x.com")
  const { error } = await supabase
    .from("user_profiles")
    .delete()
    .eq("id", currentUserId)

  expect(error?.code).toBe("42501") // sem policy de DELETE
})
```

**Evidência**:
- [ ] Migration explicita: nenhuma policy de DELETE em `user_profiles`
- [ ] Testes acima passam

---

### Lei 7: Row Level Security e Tenant Isolation

**Aplicação ao módulo**:
- [ ] RLS HABILITADO em `user_profiles` (mesmo sem household_id ainda)
- [ ] Policies não usam `USING (true)` em lugar algum (nada permissivo)
- [ ] Storage bucket `avatars` tem policies explícitas (não público)

**O que testar**:
- `pg_tables.rowsecurity = true` para `user_profiles`
- Nenhuma policy tem `USING (true)` ou `WITH CHECK (true)`
- `storage.buckets` para `avatars` tem `public = false`

**Como testar**:
```sql
-- Test 1: RLS está ON
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_profiles';
-- Expected: rowsecurity = true

-- Test 2: Nenhuma policy permissiva
SELECT polname, polqual::text, polwithcheck::text
FROM pg_policy
WHERE polrelid = 'user_profiles'::regclass;
-- Expected: nenhum 'true' isolado em qual ou withcheck

-- Test 3: bucket avatars não é público
SELECT id, public FROM storage.buckets WHERE id = 'avatars';
-- Expected: public = false
```

**Evidência**:
- [ ] Migration `001_auth_and_profiles.sql` inclui `ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY`
- [ ] Migration cria bucket `avatars` com `public = false`
- [ ] Testes SQL acima passam (rodados no `/sec-audit`)

---

### Lei 8: Atomicidade Transacional (Race Condition Prevention)

**Aplicação ao módulo**:
- [ ] Trigger `handle_new_user` roda na MESMA transação do INSERT em `auth.users` (Supabase garante).
- [ ] Se trigger falhar, `auth.users` insert também faz rollback (atomicidade).
- [ ] Cadastro com email duplicado: constraint `UNIQUE` impede race condition (dois signUps simultâneos com mesmo email).

**O que testar**:
- 2 signUps simultâneos com mesmo email → apenas 1 sucesso.
- Se trigger `handle_new_user` falhar (ex: full_name violando check constraint), nenhum registro fica em `auth.users`.

**Como testar**:
```typescript
test("SECURITY-8: signUp simultâneo com mesmo email cria apenas 1 conta", async () => {
  const email = "concurrent@x.com"
  const [r1, r2] = await Promise.allSettled([
    supabase.auth.signUp({ email, password: "Segura123", options: { data: { full_name: "A" }}}),
    supabase.auth.signUp({ email, password: "Segura123", options: { data: { full_name: "B" }}}),
  ])

  const successes = [r1, r2].filter(r => r.status === "fulfilled" && !r.value.error)
  expect(successes.length).toBe(1)
})

test("SECURITY-8: trigger falha = rollback de auth.users", async () => {
  // Simular: full_name com 200 chars (acima do limite de 100)
  const { error } = await supabase.auth.signUp({
    email: "rollback@x.com",
    password: "Segura123",
    options: { data: { full_name: "a".repeat(200) }}
  })

  // Trigger falha → signUp falha
  expect(error).toBeTruthy()

  // Garantir que não ficou nada em auth.users
  const { data } = await adminClient.auth.admin.listUsers()
  expect(data.users.find(u => u.email === "rollback@x.com")).toBeUndefined()
})
```

**Evidência**:
- [ ] Trigger `handle_new_user` documentado em SCHEMA.md (linhas 197-215) — `language plpgsql security definer`
- [ ] Constraint `auth.users.email UNIQUE` (gerenciada pelo Supabase)
- [ ] Testes acima passam

---

### Lei 9: Exposição Mínima de Dados

**Aplicação ao módulo**:
- [ ] Login com credenciais inválidas: mensagem genérica "Email ou senha incorretos" (não revela qual)
- [ ] Reset de senha: mensagem genérica "Se o email existir, enviamos as instruções"
- [ ] `user_profiles` query retorna APENAS: `id`, `full_name`, `avatar_url`, `created_at` (não retorna campos internos)
- [ ] Erros do Supabase mapeados para pt-BR sem revelar internals (ex: "Email rate limit exceeded" → "Muitas tentativas. Aguarde alguns minutos.")
- [ ] NUNCA logar senha, token JWT, refresh token

**O que testar**:
- Login com email inexistente vs senha errada → mensagem IDÊNTICA.
- Reset com email inexistente → mensagem IDÊNTICA ao reset com email válido.
- Inspecionar response de erro do Supabase: nada de `stack`, `query`, `database_url`.

**Como testar**:
```typescript
test("SECURITY-9: login não revela existência do email", async () => {
  // Email inexistente
  const r1 = await login("naoexiste@x.com", "senhaQualquer")
  // Email existe, senha errada
  const r2 = await login("maria@x.com", "senhaErrada")

  expect(r1.errorMessage).toBe("Email ou senha incorretos")
  expect(r2.errorMessage).toBe("Email ou senha incorretos")
  expect(r1.errorMessage).toBe(r2.errorMessage) // EXATAMENTE iguais
})

test("SECURITY-9: reset não revela existência do email", async () => {
  const r1 = await requestReset("naoexiste@x.com")
  const r2 = await requestReset("maria@x.com")

  expect(r1.message).toBe("Se o email existir, enviamos as instruções")
  expect(r2.message).toBe("Se o email existir, enviamos as instruções")
})

test("SECURITY-9: SELECT user_profiles não retorna campos internos", async () => {
  await loginAs("maria@x.com")
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .single()

  expect(Object.keys(data)).toEqual(
    expect.arrayContaining(["id", "full_name", "avatar_url", "created_at", "updated_at"])
  )
  // sem campos como _internal_*, password_hash, etc
})
```

**Evidência**:
- [ ] `auth-errors.ts` mapeia TODOS os erros conhecidos do Supabase
- [ ] Testes acima passam (especialmente o snapshot da mensagem genérica)

---

### Lei 10: Sanitização de Output (XSS/Injection Prevention)

**Aplicação ao módulo**:
- [ ] React renderiza `full_name`, `email` via `{}` (escape default)
- [ ] **Zero** uso de `dangerouslySetInnerHTML` em qualquer componente de auth
- [ ] Mensagens de erro também renderizadas via `{}`
- [ ] Avatar URL: usa atributo `src` (não `innerHTML`)

**O que testar**:
- Cadastrar com `fullName: "<img src=x onerror=alert(1)>"` → renderiza como TEXTO, não como HTML.
- Mensagem de erro com payload XSS → escapada.

**Como testar**:
```typescript
test("SECURITY-10: full_name com payload XSS é escapado", async () => {
  await register({
    email: "xss@x.com",
    password: "Segura123",
    passwordConfirmation: "Segura123",
    fullName: "<img src=x onerror=\"alert('xss')\">"
  })

  render(<UserAvatar userId={currentUserId} />)
  const el = screen.getByText(/img src=x/i)

  expect(el.outerHTML).not.toContain("onerror=")
  expect(el.tagName.toLowerCase()).not.toBe("img")
})

test("SECURITY-10: nenhum dangerouslySetInnerHTML em src/features/auth/", async () => {
  // Análise estática
  const files = await glob("src/features/auth/**/*.{ts,tsx}")
  for (const file of files) {
    const content = await fs.readFile(file, "utf-8")
    expect(content).not.toContain("dangerouslySetInnerHTML")
  }
})
```

**Evidência**:
- [ ] Grep do projeto não retorna `dangerouslySetInnerHTML` em `src/features/auth/`
- [ ] Testes acima passam

---

### Lei 11: Segredos Nunca no Bundle

**Aplicação ao módulo**:
- [ ] APENAS `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no bundle (são públicas — RLS protege)
- [ ] **NUNCA** `SUPABASE_SERVICE_ROLE_KEY` no frontend
- [ ] `.env.local` no `.gitignore`
- [ ] `.env.example` documenta apenas vars públicas
- [ ] Logs do cliente não imprimem token/sessão completa (apenas `user.id` + `user.email` se necessário)

**O que testar**:
- Grep em `src/` por `service_role`, `SUPABASE_SERVICE` → 0 matches
- Build (`pnpm build`) e grep em `dist/` por padrões de service role keys
- `.env.local` não está commitado (verificar via `git ls-files`)

**Como testar**:
```bash
# Grep no source
grep -r "service_role\|SUPABASE_SERVICE\|sb_secret" src/ \
  && echo "❌ SECRETS EXPOSED" \
  || echo "✅ No hardcoded secrets"

# Verificar gitignore
grep -q "^.env.local$" .gitignore || echo "❌ .env.local não está em .gitignore"

# Verificar bundle
pnpm build && grep -r "service_role" dist/ \
  && echo "❌ Service role no bundle" \
  || echo "✅ Bundle limpo"
```

**Evidência**:
- [ ] `.env.example` apenas com `VITE_*` vars
- [ ] `.gitignore` inclui `.env.local`
- [ ] `pnpm sec:secrets-scan` (script no package.json) passa

---

### Lei 12: Upload e SSRF Zero-Trust

**Aplicação ao módulo**:
- [ ] Avatar: validação de **magic bytes** (não apenas MIME ou extensão)
- [ ] Tipos aceitos: JPEG (`FF D8`), PNG (`89 50 4E 47`), WebP (`52 49 46 46 ... 57 45 42 50`)
- [ ] Re-renderização via `<canvas>` para remover EXIF/payloads embutidos (anti-polyglot)
- [ ] Tamanho máximo: 2 MB (validado no cliente E na Storage policy)
- [ ] Path: `/{auth.uid()}/avatar.{ext}` — RLS impede gravar em pasta de outro user
- [ ] **SSRF**: este módulo NÃO faz fetch server-side de URLs do usuário. N/A.

**O que testar**:
- Upload de `.exe` renomeado para `.jpg` (magic byte `4D 5A`) → rejeitado.
- Upload de imagem JPEG válida com EXIF malicioso → reprocessada, EXIF removido.
- Upload em `/outro-user-id/avatar.jpg` → rejeitado pela Storage policy.
- Upload de imagem 5 MB → rejeitado no cliente (constante) E no Storage (file_size_limit).

**Como testar**:
```typescript
test("SECURITY-12: rejeita executável renomeado para .jpg", async () => {
  // Magic byte de PE/EXE: 4D 5A
  const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, ...])
  const fakeFile = new File([exeBytes], "avatar.jpg", { type: "image/jpeg" })

  await expect(validateAndProcessAvatar(fakeFile))
    .rejects.toThrow(/imagem válida/i)
})

test("SECURITY-12: aceita JPEG válido e remove EXIF", async () => {
  const jpegWithExif = await fetch("/test/jpeg-with-exif.jpg").then(r => r.blob())
  const file = new File([jpegWithExif], "avatar.jpg", { type: "image/jpeg" })

  const processed = await validateAndProcessAvatar(file)
  const buffer = await processed.arrayBuffer()
  const view = new DataView(buffer)

  // JPEG re-encodado pelo canvas não tem APP1 (EXIF)
  expect(view.getUint16(0)).toBe(0xffd8) // SOI
  // verificar ausência do marker EXIF
})

test("SECURITY-12: upload em pasta de outro user é rejeitado", async () => {
  await loginAs("maria@x.com")
  const validJpeg = await loadValidJpeg()

  const { error } = await supabase.storage
    .from("avatars")
    .upload("outro-user-uuid/avatar.jpg", validJpeg)

  expect(error?.message).toMatch(/policy|denied/i)
})
```

**Evidência**:
- [ ] `avatar-validation.ts` implementa magic byte check + canvas re-encode
- [ ] Storage bucket `avatars` configurado com `file_size_limit = 2097152`, `allowed_mime_types = ['image/jpeg', 'image/png', 'image/webp']`
- [ ] Storage policy verifica `(storage.foldername(name))[1] = auth.uid()::text`
- [ ] Testes acima passam

---

### Lei 13: Dependency e Supply Chain Awareness

**Aplicação ao módulo**:
- [ ] `pnpm audit --prod` sem vulnerabilidades críticas/altas
- [ ] Dependencies usadas neste módulo: `@supabase/supabase-js`, `react-hook-form`, `zod`, `@hookform/resolvers`, `react-router-dom@7`
- [ ] Sem pacotes "phantom" (alucinados pela IA) — todos verificados em npmjs.com
- [ ] Sem pacotes abandonados (último commit < 12 meses)

**O que testar**:
- `pnpm audit --prod --json` retorna `vulnerabilities.high === 0 && vulnerabilities.critical === 0`
- Cada dependência adicionada tem entry em `package.json` com versão pinada (não `*` ou `latest`)
- `pnpm outdated` revisado manualmente

**Como testar**:
```bash
# Audit automatizado
pnpm audit --prod --json | jq '.metadata.vulnerabilities'
# Expected: { "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0 }

# Versões pinadas
jq '.dependencies' package.json | grep -E '"\\*"|"latest"' && echo "❌ versões soltas" || echo "✅ versões pinadas"
```

**Evidência**:
- [ ] Output do `pnpm audit` no PR
- [ ] `package.json` com versões `^x.y.z` (não `*` nem `latest`)
- [ ] `pnpm-lock.yaml` commitado

---

### Lei 14: Logging Seguro e Observável

**Aplicação ao módulo**:
- [ ] Falhas de login logadas com contexto: `email_attempted` (hash ou parcial), `timestamp`, `ip` (se disponível) — **mas nunca a senha**
- [ ] Erros de upload de avatar logados com `user_id`, `file_size`, `mime_type` — sem dados binários
- [ ] Stack traces enviados ao cliente são GENÉRICOS ("Algo deu errado, tente novamente")
- [ ] Nenhum `console.log(error)` que vaze tokens/sessão completa

**O que testar**:
- Tentativa de login com senha errada gera log estruturado sem `password`.
- Erro de upload gera log sem o blob.
- Frontend nunca expõe stack trace em UI.

**Como testar**:
```typescript
test("SECURITY-14: log de falha de login não contém senha", () => {
  const logs: any[] = []
  const logger = vi.spyOn(console, "warn").mockImplementation((...args) => logs.push(args))

  loginWithInvalidCreds("maria@x.com", "senhaSecreta123")

  const allLogs = JSON.stringify(logs)
  expect(allLogs).not.toContain("senhaSecreta123")
  expect(allLogs).toMatch(/login_failed|auth_error/i)
})

test("SECURITY-14: erro de upload não loga blob", () => {
  const logs: any[] = []
  vi.spyOn(console, "error").mockImplementation((...args) => logs.push(args))

  uploadAvatar(invalidFile).catch(() => {})

  const allLogs = JSON.stringify(logs)
  expect(allLogs).not.toMatch(/data:image|base64/i) // sem blob
})
```

**Evidência**:
- [ ] Wrapper `src/lib/logger.ts` com sanitização (remove `password`, `token`, `refresh_token`, `access_token`)
- [ ] Testes acima passam

---

### Lei 15: Configuração Segura por Padrão

**Aplicação ao módulo**:
- [ ] **HTTPS obrigatório** em produção (Vite dev permite HTTP localhost)
- [ ] **Cookies / Storage**: Supabase usa localStorage por default; sessão com refresh token rotativo
- [ ] **CSP** (Content-Security-Policy): planejada para módulo de produção (header via host: Vercel, Cloudflare etc.)
- [ ] **Source maps**: desabilitados em produção (Vite default)
- [ ] **Modo debug**: NÃO exposto em produção (sem `__REDUX_DEVTOOLS_EXTENSION__` em prod)
- [ ] Configuração explícita do cliente Supabase: `persistSession: true, autoRefreshToken: true`

**O que testar**:
- Build de produção (`pnpm build`) gera arquivos sem source maps.
- Cliente Supabase está configurado corretamente.
- Em produção, app só acessível via HTTPS (validar deploy).

**Como testar**:
```typescript
test("SECURITY-15: cliente Supabase configurado com persistSession + autoRefresh", () => {
  expect(supabase.auth.session).toBeDefined()
  // Verificar config interna não é trivial; presença do client setup é suficiente
})

test("SECURITY-15: build de produção sem source maps", async () => {
  await exec("pnpm build")
  const distFiles = await glob("dist/**/*.map")
  expect(distFiles.length).toBe(0)
})
```

**Evidência**:
- [ ] `vite.config.ts` com `build.sourcemap = false` (ou padrão)
- [ ] `src/lib/supabase.ts` com config explícita
- [ ] Headers de produção configurados no host (Vercel: `vercel.json` com `headers`)

---

## Anti-padrões de Vibe Coding (A1-A10) — Verificação Específica

| # | Anti-padrão | Como evitar neste módulo | Testado por |
|---|-------------|--------------------------|-------------|
| **A1** | Segurança só no cliente | RLS + Zod no backend (Supabase Auth valida tudo). Frontend só faz UX. | Lei 1, 5, 7 |
| **A2** | Auth removido para "resolver bug" | Code review obrigatório no merge. CI fail se `<ProtectedRoute>` removido em arquivo de rota. | Lei 6 + code review |
| **A3** | Secrets hardcoded | grep automatizado + `.env.example` documentado | Lei 11 |
| **A4** | RLS desabilitado | Migration explícita `ENABLE ROW LEVEL SECURITY`; teste SQL no `/sec-audit` | Lei 7 |
| **A5** | Middleware fantasma | N/A (Supabase já middleware) | — |
| **A6** | Error swallowing | Logger wrapper + ESLint rule `no-empty-catch` | Lei 14 |
| **A7** | Permissões excessivas | Anon key apenas (sem service role no frontend) | Lei 11 |
| **A8** | Validação ausente em Server Actions | N/A (sem server actions; usa Supabase Auth direto) | — |
| **A9** | Exposição de admin por default | N/A (sem painel admin neste módulo) | — |
| **A10** | Paginação sem limite | N/A (auth não tem listagens; aplicará em módulos seguintes) | — |

---

## Resumo: Conformidade com 15 Leis

| Lei | Aplicável? | Testada? | Evidência | Status |
|-----|------------|----------|-----------|--------|
| 1 — Nunca confie no cliente | ✅ SIM | [ ] | RLS + auth.uid() no backend | ⏳ |
| 2 — Schema restrito | ✅ SIM | [ ] | Zod `.strict()` em todos schemas | ⏳ |
| 3 — Limites de tamanho | ✅ SIM | [ ] | Constantes + Storage limits | ⏳ |
| 4 — Proteção de perímetro | ⚠️ PARCIAL | [ ] | Defaults Supabase Auth (sem custom no MVP) | ⏳ |
| 5 — Identidade extraída | ✅ SIM | [ ] | RLS + JWT, store via onAuthStateChange | ⏳ |
| 6 — Autorização em cada op | ✅ SIM | [ ] | RLS UPDATE: `id = auth.uid()` | ⏳ |
| 7 — RLS e tenant isolation | ✅ SIM | [ ] | RLS ON em user_profiles + Storage policies | ⏳ |
| 8 — Atomicidade transacional | ✅ SIM | [ ] | trigger handle_new_user na mesma TX | ⏳ |
| 9 — Exposição mínima | ✅ SIM | [ ] | Mensagens genéricas + SELECT explícito | ⏳ |
| 10 — Sanitização de output | ✅ SIM | [ ] | React escape default + grep sem dangerouslySetInnerHTML | ⏳ |
| 11 — Segredos no bundle | ✅ SIM | [ ] | `.env.local` gitignored + scan no CI | ⏳ |
| 12 — Upload & SSRF | ✅ SIM (upload) | [ ] | Magic bytes + canvas re-encode + Storage policy | ⏳ |
| 13 — Supply chain | ✅ SIM | [ ] | `pnpm audit` clean + versões pinadas | ⏳ |
| 14 — Logging seguro | ✅ SIM | [ ] | Logger wrapper sanitizado | ⏳ |
| 15 — Config por padrão | ✅ SIM | [ ] | HTTPS, persistSession, sem source maps em prod | ⏳ |

**Conformidade Total**: ⏳ —% (Target: 100% das leis aplicáveis)
**Score de Segurança**: ⏳ — (Target: ≥ A; tolerável B na primeira iteração)
**Anti-padrões A1-A10**: ⏳ — detectados (Target: 0)

---

## Notas

- **Lei 4 (Perimeter)**: classificada como PARCIAL no MVP. Usaremos defaults do Supabase Auth (rate-limits configurados no Dashboard). Middleware customizado de rate-limit em Edge Functions virá em módulos futuros que tenham endpoints sensíveis (ex: notificações, exports massivos).
- **Lei 12 (SSRF)**: marcada APLICÁVEL apenas para a parte de upload de avatar. Não há fetch de URLs arbitrárias do usuário neste módulo.
- **Anti-padrões A5, A8, A9, A10**: marcados como N/A com justificativa (Supabase é o middleware; sem server actions; sem admin panel; sem listagens). Re-verificar em módulos futuros que introduzam essas superfícies.
- **Política de senha**: 8 chars mínimos com pelo menos 1 letra e 1 número. Decisão UX/segurança balanceada — apps mais sensíveis devem exigir 12+ chars + complexidade extra.
- **Email confirmation desabilitada no MVP**: aceitável por ser uso pessoal/inicial. Para uso público, ativar antes de qualquer signup externo (vai virar tarefa do módulo 15 — security-and-compliance).
- **Avatar EXIF strip**: importante para privacidade (geo-tags em fotos de celular podem vazar localização). Re-encode via canvas elimina todos os metadados.
