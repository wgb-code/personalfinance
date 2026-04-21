---
description: "Roda toda a bateria de testes do módulo ativo (unit + integration + browser + e2e + db) e gera relatório consolidado"
agent: qa-validator
---

# /module-test [NN-slug]

Executa **todas as suítes** de teste relevantes ao módulo informado (ou ao módulo ativo, se omitido) em paralelo onde possível, coleta cobertura, roda axe-core para a11y, e gera o **Quality Scorecard parcial** em `specs/modules/<NN-slug>/quality-report.md`.

**Diferente de `/sec-audit`**: este comando foca em **funcionalidade + cobertura + a11y**. A auditoria das 15 Leis é responsabilidade de `/sec-audit`.

---

## Uso

```
/module-test                       # módulo ativo (lê _progress.md)
/module-test 01-auth-and-session   # explícito
/module-test 01-auth-and-session --watch    # modo watch (apenas vitest)
/module-test 01-auth-and-session --quick    # pula E2E (só unit + browser)
```

---

## Pipeline (executado em paralelo onde possível)

### 1. Pré-checagens (paralelo)
- `pnpm tsc --noEmit` — strict mode 0 erros
- `pnpm lint` — ESLint 0 warnings
- Confirmar branch == `feat/<NN-slug>`

### 2. Suítes de teste (paralelo)

| Suite | Comando | Escopo |
|-------|---------|--------|
| **Unit** | `pnpm vitest run --coverage` | `tests/unit/<slug>/**` + `src/features/<slug>/**/*.test.ts` |
| **Integration** | `pnpm vitest run` | `tests/integration/<slug>/**` (hooks + Supabase mockado via MSW) |
| **Component (browser)** | `pnpm vitest run --browser` | `tests/components/<slug>/**` (Playwright provider) |
| **E2E** | `pnpm playwright test` | `tests/e2e/<slug>/**` (browsers reais, fluxos completos) |
| **DB** | `psql ... -f tests/db/<slug>/*.test.sql` | pgTAP / scripts SQL |
| **A11y** | embutido nos testes de componente via `vitest-axe` | todos componentes da feature |

### 3. Coleta de evidências
- Resultados JSON em `.qa/<slug>/`
- Cobertura HTML em `coverage/`
- Screenshots/videos do Playwright em `test-results/`

### 4. Geração do relatório

`qa-validator` lê todas as evidências e gera/atualiza:
- `specs/modules/<NN-slug>/quality-report.md` (Scorecard parcial)
- `specs/modules/<NN-slug>/tasks.md` (marca ✅/❌ nos checkboxes RED/GREEN/REFACTOR)
- `specs/_progress.md` (atualiza coluna Cobertura)

---

## Saída esperada

```
## Module Test — Resultado

**Módulo**: 01-auth-and-session
**Branch**: feat/01-auth-and-session
**Duração**: 2m 14s

### Suítes
- Unit:        47/47 ✅
- Integration: 12/12 ✅
- Component:   18/18 ✅
- E2E:          6/6  ✅
- DB:           9/9  ✅

### Cobertura (alvo ≥ 80%)
- Statements: 87% ✅
- Branches:   78% ⚠️ (alvo 75%)
- Functions:  91% ✅
- Lines:      86% ✅

### A11y
- 0 violations critical/serious
- 0 violations moderate

### Bloqueios
- Nenhum 🎉

### Próximo passo
Rodar `/sec-audit 01-auth-and-session` para auditar as 15 Leis.
```

---

## Quando algum teste falha

`qa-validator` NÃO conserta — apenas reporta:
1. Lista o teste falho com path + nome + erro resumido
2. Sugere o subagent responsável (logic / layout / supabase)
3. Atualiza `tasks.md` com ❌ no checkbox correspondente
4. NÃO atualiza `_progress.md` para concluído

---

## Pré-requisitos

- Branch `feat/<NN-slug>` ativa
- `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou Supabase local rodando)
- `playwright install --with-deps` já executado pelo menos 1x
- `vitest.config.ts` configurado com `browser.provider: "playwright"`

---

## Próximo passo

`/sec-audit <NN-slug>` para auditoria das 15 Leis antes de `/module-complete`.
