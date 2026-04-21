---
description: "Fecha o módulo: valida gates, atualiza progresso, gera commit final e libera próximo módulo"
agent: qa-validator
---

# /module-complete <NN-slug>

Encerra oficialmente o módulo, desde que **TODOS os gates** estejam ✅. Atualiza `_progress.md`, gera commit final assinado pelos artefatos, e **desbloqueia o próximo módulo** para `/spec-draft`.

---

## Uso

```
/module-complete 01-auth-and-session
/module-complete 01-auth-and-session --dry-run   # apenas relata, não muda nada
```

---

## Gates obrigatórios (TODOS bloqueantes)

Antes de aceitar o complete, valida:

| # | Gate | Como verifica |
|---|------|---------------|
| 1 | Branch == `feat/<NN-slug>` | `git rev-parse --abbrev-ref HEAD` |
| 2 | Working tree limpa | `git status --porcelain` vazio |
| 3 | Todos checkboxes RED+GREEN+REFACTOR+SECURITY ✅ no `tasks.md` | grep `\[ \]` deve retornar 0 |
| 4 | `quality-report.md` existe e Scorecard ≥ B | leitura do arquivo |
| 5 | `pnpm tsc --noEmit` passa limpo | comando direto |
| 6 | `pnpm lint` passa limpo | comando direto |
| 7 | Cobertura ≥ 80% statements | leitura de `quality-report.md` |
| 8 | A11y axe: 0 violations critical/serious | leitura de `quality-report.md` |
| 9 | Sec audit ≥ B (todas Leis aplicáveis ✅ ou ⚠️ documentada) | leitura de `quality-report.md` |
| 10 | Branch sincronizada com `main` (rebase OK) | `git fetch && git log main..HEAD` |

Se **qualquer** gate falhar: aborta com lista numerada de bloqueios. NÃO modifica nada.

---

## Pipeline de fechamento

### 1. Validar todos os gates (acima)

### 2. Atualizar `specs/_progress.md`

```diff
- | 01 | auth-and-session | 🔄 Em Progresso | ✅ Pronto | 2026-04-19 | — | —% | — | **MÓDULO ATIVO** ... |
+ | 01 | auth-and-session | ✅ Concluído    | ✅ Pronto | 2026-04-19 | 2026-04-30 | 87% | A | 14 ACs · 92 testes · merged |
```

E na seção `Resumo Executivo`:
```diff
- **Módulo Ativo**: 🔄 01-auth-and-session
+ **Módulo Ativo**: [Nenhum — pronto para `/spec-draft` do próximo módulo]
- **Módulos Completos**: 0/15
+ **Módulos Completos**: 1/15
```

### 3. Gerar arquivo `specs/modules/<NN-slug>/CHANGELOG.md`

Lista resumida do que entrou neste módulo:
```markdown
# Changelog — 01-auth-and-session

**Período**: 2026-04-19 → 2026-04-30 (11 dias)
**Branch**: feat/01-auth-and-session
**Scorecard**: A

## Entregue
- 14 ACs implementados (lista resumida)
- 4 componentes UI (SignUpForm, LoginForm, AvatarUploader, SessionExpiredModal)
- Migrations: 0002_create_user_profiles, 0003_avatars_bucket
- 92 testes (47 unit, 12 integration, 18 component, 6 e2e, 9 db)

## Cobertura
- Statements 87% / Branches 78% / Functions 91%

## Decisões importantes (link para ADRs se houver)
- Email confirmation OFF no MVP (RN-4)
- Auto-logout 4h inatividade (RN-10)
- Avatar via magic byte validation (RN-13)

## Postergado para módulos futuros
- Rate-limit completo → módulo "rate-limiter"
- Invite code → módulo 02-household-onboarding
- 2FA → backlog pós-MVP
```

### 4. Commit final

Mensagem padronizada (NÃO push):
```
feat(<NN-slug>): conclui módulo <slug>

- <X> ACs implementados
- Cobertura <Y>%, Sec Score <letra>
- Testes: <total> (<unit> unit, <int> integration, <comp> component, <e2e> e2e, <db> db)

Refs: specs/modules/<NN-slug>/spec.md
Quality: specs/modules/<NN-slug>/quality-report.md
```

(USUÁRIO faz o push e abre o PR — comando NUNCA empurra automaticamente.)

### 5. Desbloquear próximo módulo

Identifica próximo da fila em `_progress.md` (próximo Status `⏳ Pendente`) e exibe:
```
## Módulo concluído ✅

**01-auth-and-session** está fechado. Branch `feat/01-auth-and-session` pronta para PR.

### Próximos passos
1. `git push -u origin feat/01-auth-and-session`
2. Abrir PR e mergear
3. Voltar para `main`: `git checkout main && git pull`
4. Iniciar próximo módulo:
   `/spec-draft "Onboarding de household + invite code"`
   (vai gerar 02-household-onboarding)
```

---

## Saída em caso de bloqueio

```
## Module Complete — BLOQUEADO ❌

**Módulo**: 01-auth-and-session
**Bloqueios** (4):

1. ❌ Gate 3 (tasks.md): 2 checkboxes RED ainda abertos
   - tests/unit/auth/sign-up-schema.test.ts (AC-02)
   - tests/integration/auth/use-sign-up.test.tsx (AC-01)

2. ❌ Gate 7 (cobertura): 73% (alvo ≥ 80%)
   - src/features/auth/lib/auth-errors.ts: 45%

3. ❌ Gate 9 (sec audit): Lei 12 em ❌
   - upload-magic-bytes.test.ts não existe

4. ❌ Gate 10 (sync com main): branch atrás de main em 3 commits

### Como destravar
- (1) Acionar logic-engineer para AC-01 e AC-02
- (2) Acionar logic-engineer para cobrir auth-errors.ts
- (3) Acionar logic-engineer para criar teste de magic bytes
- (4) `git fetch && git rebase main`

Rodar `/module-test` e `/sec-audit` após corrigir.
```

NÃO modifica `_progress.md` quando bloqueia.

---

## Princípios

1. **Gates não-negociáveis**: nem 90% serve. É 100% ou bloqueia.
2. **Não faz push**: humano controla quando o código sai do laptop.
3. **Histórico imutável**: `CHANGELOG.md` por módulo é a memória institucional.
4. **Próximo só desbloqueia se anterior passar**: princípio "One Module at a Time".
