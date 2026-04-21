---
description: "Auditoria das 15 Leis Imutáveis de Segurança contra o módulo informado. Gera Security Scorecard."
agent: qa-validator
---

# /sec-audit [NN-slug]

Audita o módulo contra as **15 Leis Imutáveis de Segurança** documentadas em `docs/SECURITY.md` e mapeadas em `specs/modules/<NN-slug>/security.md`. Para cada Lei, verifica se a evidência prometida existe e o teste correspondente passa.

**Diferente de `/module-test`**: aqui o foco é **postura de segurança**, não funcionalidade. Roda OWASP-grade checks (RLS, IDOR/BOLA, mass assignment, upload bypass, supply chain etc.).

---

## Uso

```
/sec-audit                            # módulo ativo
/sec-audit 01-auth-and-session        # explícito
/sec-audit 01-auth-and-session --fix  # gera tasks corretivas em tasks.md (sem aplicar fix)
```

---

## Pipeline (paralelo onde possível)

### 1. Conformidade documental
- Ler `specs/modules/<NN-slug>/security.md`
- Para cada Lei, conferir se há `Evidência` apontando para arquivo/teste real
- Marcar Leis sem evidência como **DOC-MISS** (bloqueante)

### 2. Verificações estáticas (grep/AST)

| Lei | Check | Comando aproximado |
|-----|-------|-------------------|
| 1 | Nenhum `author_id` ou `household_id` no body de mutation | `rg "author_id\|household_id" src/features/<slug>/hooks` (deve estar ausente) |
| 2 | Schemas Zod com `.strict()` ou whitelist explícita | `rg "z.object\(\{" src/features/<slug>/schemas` |
| 3 | `.max()` em strings críticas, `file_size_limit` no bucket | grep nas migrations + schemas |
| 7 | `ENABLE ROW LEVEL SECURITY` em toda tabela do módulo | grep nas migrations |
| 10 | Sem `dangerouslySetInnerHTML`, sem `eval`, sem `new Function` | `rg "dangerouslySetInnerHTML\|eval\(\|new Function"` |
| 11 | `.env*` no `.gitignore`; só `VITE_*` no `import.meta.env` no client | grep |
| 14 | Logs sem `password`, `token`, `refresh_token`, `secret` | `rg "console\.\w+.*password\|token\|secret" src` |

### 3. Verificações dinâmicas (testes dedicados)

Roda `tests/security/<slug>/**/*.test.ts` e `tests/db/<slug>/*-rls.test.sql`:

| Lei | Teste obrigatório |
|-----|-------------------|
| 5 | `cross-tenant-read.test.sql` — usuário A não lê dado de B |
| 5 | `cross-tenant-write.test.sql` — usuário A não escreve em recurso de B |
| 8 | `transaction-atomicity.test.sql` — falha parcial faz rollback completo |
| 12 | `upload-magic-bytes.test.ts` — `.exe` renomeado pra `.jpg` é rejeitado |
| 12 | `upload-path-traversal.test.ts` — `../` no nome é rejeitado |

### 4. Supply chain

```bash
pnpm audit --prod --json > .qa/audit.json
```

Bloqueia se houver qualquer **HIGH** ou **CRITICAL**.

### 5. Geração do Security Scorecard

Atualiza `specs/modules/<NN-slug>/quality-report.md` (cria se não existir) com a seção `## Segurança`:

```markdown
## Segurança — 15 Leis Imutáveis

| # | Lei | Aplicável | Evidência | Status |
|---|-----|-----------|-----------|--------|
| 1 | Never trust client | ✅ | tests/integration/auth/use-sign-up.test.tsx:42 | ✅ |
| 2 | Mass assignment | ✅ | src/features/auth/schemas/sign-up.schema.ts | ✅ |
| 3 | Size limits | ✅ | bucket avatars 2MB + Zod max | ✅ |
| 4 | Rate limit | ⚠️ | MVP: Supabase default | ⚠️ documentado |
| 5 | IDOR/BOLA | ✅ | tests/db/01-auth-and-session/cross-tenant.test.sql | ✅ |
| 6 | Authz por op | N/A | módulo single-user | — |
| 7 | RLS + tenant | ✅ | migration 0002 + tests/db/rls.test.sql | ✅ |
| ... | ... | ... | ... | ... |

**Score**: A (14 ✅, 1 ⚠️ documentada, 0 ❌)
**Bloqueios**: nenhum
```

---

## Critérios de aprovação

| Score | Condição |
|-------|----------|
| **A** | Todas Leis aplicáveis ✅, ou ⚠️ com documentação no `security.md` justificando MVP |
| **B** | 1 Lei aplicável em ⚠️ sem documentação completa (precisa documentar) |
| **C** | 1 Lei aplicável em ❌ ou supply chain HIGH (BLOQUEIA merge) |
| **F** | 2+ Leis aplicáveis em ❌ ou supply chain CRITICAL (BLOQUEIA merge) |

`/module-complete` exige **score ≥ B**.

---

## Saída esperada

```
## Sec Audit — 01-auth-and-session

**Score**: A ✅
**Leis aplicáveis**: 14/15
**Status**: 14 ✅, 1 ⚠️ documentada, 0 ❌

### Detalhe de bloqueios
- Nenhum

### Documentadas como MVP (não bloqueiam, revisar pós-MVP)
- Lei 4 (rate-limit): rate-limit completo via Edge Function planejado para módulo "rate-limiter" futuro

### Próximo passo
`/module-complete 01-auth-and-session` para fechar o módulo e desbloquear o próximo.
```

---

## Quando o score é < B

`qa-validator`:
1. Lista cada Lei em ❌ com path do arquivo problemático
2. Cria task corretiva em `tasks.md` (`### SEC-FIX-<lei>`) se `--fix` foi passado
3. Sugere subagent responsável
4. NÃO permite `/module-complete`

---

## Próximo passo

Score ≥ B → `/module-complete <NN-slug>`
Score < B → corrigir bloqueios e rodar `/sec-audit` novamente
