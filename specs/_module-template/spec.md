# Especificação do Módulo: [NÚMERO-NOME]

> ⚠️ **INSTRUÇÃO**: Preencha este documento completamente ANTES de começar o desenvolvimento. Use este como contrato entre o designer (você) e o implementador (logic-engineer).

## 📋 Objetivo

Uma frase que resume o que este módulo entrega. Deve ser possível dizer "feito" quando o objetivo é atingido.

Exemplo (Módulo 04-Fixed-Bills):
> "Implementar CRUD completo de contas fixas com valor, vencimento, categoria, responsável, status e histórico de alterações de valor."

---

## 👥 Personas & Casos de Uso

### Personas Envolvidas
- **[Persona 1]**: Quem usa? Qual contexto? (ex: "Maria, dona da casa, quer registrar contas recorrentes")
- **[Persona 2]**: [descrição]

### Casos de Uso
- **UC-1**: [Actor] faz [ação] para [objetivo]. Resultado: [estado novo].
- **UC-2**: [...]

Exemplo (Módulo 04):
- **UC-1**: Maria (owner) cria uma conta fixa de aluguel R$2000 com vencimento no dia 1. Sistema registra e a torna visível em modo casal.
- **UC-2**: João (member) tenta editar a conta de Maria → sistema bloqueia com mensagem "apenas autor pode editar".

---

## ⚖️ Regras de Negócio

Cada regra deve ser testável (observável no comportamento).

- **RN-1**: [Regra]. Restrição/validação. [Exemplo].
- **RN-2**: [...]

Exemplo (Módulo 04):
- **RN-1**: Conta fixa obrigatoriamente tem: nome, valor, vencimento (dia do mês 1-31), categoria, responsável, status (ativa/pausada). Ausência = rejeição.
- **RN-2**: Valor deve ser positivo (>0). Negativo ou zero = rejeição com erro "Valor deve ser maior que zero".
- **RN-3**: Vencimento pausada não gera `bill_occurrences` (mesmo se pg_cron rodar).
- **RN-4**: Flag `shared` determina visibilidade em modo casal, independente de `author_id`.

---

## 🎯 Critérios de Aceite (Gherkin)

Formato: Dado/Quando/Então. Cada critério será traduzido para teste (Fase RED do TDD).

```gherkin
Funcionalidade: Listar contas fixas

  Cenário: Maria vê suas contas fixas em modo pessoal
    Dado que Maria está autenticada e no household "Casa Silva"
    Quando ela abre a página de contas fixas
    E seleciona modo "Pessoal"
    Então ela vê apenas as contas autorais dela
    E não vê contas de João (seu parceiro)

  Cenário: Maria vê contas compartilhadas em modo casal
    Dado que Maria está em modo "Casal"
    E há contas fixas authored por ela (shared=true) e por João
    Quando ela abre a página de contas fixas
    Então ela vê TODAS as contas do household (dela e de João)

  Cenário: Criar conta fixa com valor válido
    Dado que Maria está na página de criar conta fixa
    Quando ela preenche: nome="Internet", valor=150, vencimento=5, categoria="Utilidade"
    E clica "Salvar"
    Então a conta é criada com sucesso
    E um toast de sucesso é exibido
    E a lista é recarregada

  Cenário: Rejeição de valor inválido
    Dado que Maria está criando uma conta
    Quando ela tenta salvar com valor=0 ou valor=-50
    Então o campo é marcado como erro
    E mensagem "Valor deve ser maior que zero" aparece
    E o formulário não é enviado
```

---

## 📥 Entrada/Saída

### Dados de Entrada
- **Fonte**: UI form (create/edit modal), query string, local storage recovery.
- **Validação obrigatória**: Lista de campos + tipos + restrições. Cada rejeição deve ser testada.

Exemplo (Módulo 04):
```
Entrada (UI):
  - name: string, 1-255 chars, obrigatório
  - value: number > 0, decimal(12,2), obrigatório
  - dueDay: number 1-31, obrigatório
  - categoryId: uuid (FK), obrigatório, must belong to household
  - authorId: uuid (FK), auto-populated from auth context, NOT from user input
  - status: enum ["active", "paused"], default "active"
  - shared: boolean, default false
  - attachment?: file (image|PDF), max 10MB
```

### Dados de Saída
- **Para UI**: Estrutura JSON esperada, campos visíveis, formatações (dinheiro em R$, data em DD/MM, etc.).
- **Para BD**: Qual tabela(s)? Qual RPC/mutation? Side-effects (triggers, jobs)?

Exemplo (Módulo 04):
```
Saída (API/RPC):
  - fixed_bills table: INSERT/UPDATE/DELETE com RLS check
  - Trigger: set updated_at
  - Trigger: log value change to bill_value_history IF value changed
  - Side effect: Se status mudou de active→paused, NÃO apagar bill_occurrences (apenas deixar pending)
```

---

## 🔗 Dependências de Outros Módulos

Lista explícita de módulos que DEVEM estar completos antes de iniciar este.

- **Módulo 01 (auth-and-session)**: ✅ Obrigatório. Preciso de autenticação e `useAuthStore`.
- **Módulo 03 (categories)**: ✅ Obrigatório. Preciso que categorias existam e sejam carregáveis.
- **Módulo [?]**: ❌ Não dependência explícita, mas bom ter depois.

---

## 📝 Fora de Escopo

Coisas que explicitamente NÃO são parte deste módulo (evita scope creep).

- ❌ Geração automática de `bill_occurrences` (Módulo 05).
- ❌ Integração com APIs bancárias.
- ❌ Alertas por SMS/email (Módulo X).

---

## 🏗️ Sugestão de Estrutura de Arquivos

Apenas uma sugestão; logic-engineer pode propor melhor.

```
src/features/bills/
├── components/
│   ├── BillsList.tsx
│   ├── BillRow.tsx
│   ├── BillForm.tsx          # Modal de create/edit
│   ├── BillDialog.tsx
│   └── BillActions.tsx       # Botões de ação (delete, edit, etc)
├── api/
│   ├── hooks.ts              # useFixedBills(), useBill(), etc (React Query)
│   └── queries.ts            # fetchFixedBills(), etc
├── types/
│   └── index.ts              # interface FixedBill, etc
├── store/
│   └── billFilters.ts        # Zustand para filtros ativos (categoria, status, etc)
└── pages/
    └── BillsPage.tsx
```

---

## 📊 Métricas de Sucesso

- ✅ Todos os critérios Gherkin transformados em testes (Fase RED).
- ✅ Cobertura ≥ 80% statements + branches.
- ✅ `/sec-audit` sem vulnerabilidades CRÍTICA/ALTA.
- ✅ Ao menos 1 happy-path E2E (Playwright) + 1 sad-path (error case).
- ✅ Performance: lista com 1000 itens carrega < 500ms no cliente.

