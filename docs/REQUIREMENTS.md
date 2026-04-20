# 📋 Requisitos Funcionais — Organizador Financeiro Pessoal

> Leia também `STACK.md` para entender as decisões técnicas que sustentam estes requisitos.

---

## 🔐 Autenticação & Usuários

- Cadastro com e-mail e senha (aberto — qualquer pessoa pode criar uma conta)
- Login com e-mail e senha
- Sessão persistente com possibilidade de logout
- Recuperação de senha via e-mail (fluxo nativo do Supabase Auth)
- Alternância de modo de visualização no header: `Pessoal ↔ Casal`
- Cada entidade cadastrada carrega: `author_id`, `household_id`, `created_at`, `updated_at`

---

## 🏠 Household (Multi-tenancy)

O **household** é a unidade central de isolamento de dados. Todo usuário precisa pertencer a um household para acessar a aplicação.

### Criação de Household
- Após o cadastro, o usuário é direcionado ao **onboarding**
- No onboarding, ele escolhe entre:
  - **Criar um novo household**: define o nome do núcleo (ex: "Família Silva") e recebe um `invite_code` único
  - **Entrar em um household existente**: informa o `invite_code` recebido do parceiro

### Regras do Household
- Máximo de **2 membros** por household (owner + member)
- O `invite_code` tem validade configurável (padrão: 7 dias) e é de **uso único**
- Após o segundo membro entrar, o code é invalidado automaticamente
- Um usuário pertence a **apenas um household** por vez
- O owner pode regenerar o `invite_code` e remover o member se necessário

### Tela de Gerenciamento do Household
- Visualizar membros do household (nome, e-mail, data de entrada)
- Ver e copiar o `invite_code` atual (se o segundo slot estiver vazio)
- Regenerar `invite_code` (invalida o anterior)
- Owner pode remover o member do household

---

## 💸 Contas Fixas

- CRUD completo com os campos:
  - Nome
  - Valor
  - Vencimento (dia do mês)
  - Categoria
  - Responsável / Autor (populado automaticamente pelo usuário logado)
  - Status (`ativa` / `pausada`)
  - Flag `shared` → aparece no modo casal mesmo sendo de autoria individual
  - Anexo de comprovante (imagem ou PDF)

- **Recorrência automática**: ao virar o mês, o sistema gera os lançamentos do mês seguinte para todas as contas fixas ativas
- **Marcar como paga**: registra a data real do pagamento (permite comparar com o vencimento e identificar atrasos)
- **Histórico de alterações de valor**: registra toda vez que o valor da conta é alterado (ex: reajuste do plano de internet)
- **Alerta visual**: destaca contas com vencimento nos próximos X dias (X configurável nas preferências)

---

## 📊 Contas Variadas

- CRUD com os campos: descrição, valor, data, categoria, autor, modo (pessoal / casal), tags livres
- **Parcelamento**: ao cadastrar uma despesa parcelada (ex: 12x R$150), o sistema gera N lançamentos futuros vinculados por `installment_group_id`
- **Anexo de comprovante** (imagem ou PDF)
- **Lançamento rápido**: entrada simplificada com descrição + valor + categoria em um único passo, sem modal completo
- **Duplicar lançamento**: botão para duplicar despesas recorrentes que não são fixas (ex: academia avulsa)
- **Tags livres**: campo de texto livre para busca rápida (ex: `mercado`, `lazer`, `saúde`)

---

## 💰 Renda

- CRUD de fontes de renda: nome, valor esperado, recorrência, autor
- **Lançamento do valor real recebido** por mês (pode diferir do esperado — ex: freelance variável)
- **Indicador de variação** entre o valor esperado e o efetivamente recebido
- Suporte a **renda extra pontual** (bônus, freelance, venda de item) sem vínculo com uma fonte recorrente
- No modo casal, a renda de todos os membros do household é somada para os cálculos gerais

---

## 🗓️ Planejamento (Metas & Eventos)

### Metas Financeiras
- CRUD com: nome, valor alvo, prazo, valor já guardado, escopo (pessoal / casal)
- Barra de progresso visual por meta
- Possibilidade de vincular **aportes mensais** a uma meta (ex: "guardar R$500/mês para a viagem")
- Estimativa automática de **quanto falta guardar por mês** para atingir o valor alvo no prazo

### Eventos Planejados
- CRUD com: nome, tipo (viagem, mudança, compra grande, outro), orçamento estimado, data prevista
- Possibilidade de **associar gastos variados a um evento** (ex: todas as compras da viagem ficam agrupadas)
- Visão de orçamento do evento: estimado × realizado

---

## 📈 Dashboard & Widgets

### Widgets Informativos (configuráveis e reordenáveis)
- Saldo do mês atual (renda − despesas)
- Total de contas fixas do mês
- Total de gastos variados do mês
- Contas a vencer nos próximos 7 dias
- Progresso das metas ativas
- Último lançamento registrado
- Comparativo mês atual × mês anterior

### Gráficos
- Entradas × Saídas por mês (barras agrupadas — últimos 6 ou 12 meses)
- Distribuição de gastos por categoria (pizza / donut)
- Evolução do saldo ao longo do ano (linha)
- Gastos por autor no modo casal (barras empilhadas)
- Progresso de parcelas em aberto

---

## 🗂️ Categorias

- CRUD de categorias customizáveis: nome, ícone, cor
- Categorias padrão pré-criadas: Moradia, Alimentação, Saúde, Transporte, Lazer, Educação, entre outras
- Cada categoria é definida no escopo do household (não compartilhada entre households)
- Categoria aplicável a: despesas fixas, variadas ou ambas

---

## 🔎 Filtros & Relatórios

- Filtro global por: período, categoria, autor, tag, modo (pessoal / casal), status
- Exportação de relatório em **PDF** (client-side) ou **CSV** com os filtros aplicados
- Relatório mensal resumido gerado automaticamente ao final do mês
- Busca textual global em descrições e tags

---

## ⚙️ Configurações

- Definir **dia de início do mês financeiro** (ex: dia 5 — útil para quem recebe no começo do mês)
- Configurar **quantos dias antes** do vencimento o alerta visual é exibido
- Gerenciamento de categorias e tags do household
- Tema claro / escuro
- Gerenciamento do household (membros, invite_code)

---

## ✨ Funcionalidades Extras

| Funcionalidade | Descrição |
|---|---|
| **Lançamento rápido** | Atalho de teclado global para registrar um gasto sem perder o foco na tela atual |
| **Duplicar lançamento** | Reaproveita um gasto variado não-fixo com um clique (ex: academia avulsa) |
| **Notas por mês** | Campo livre para anotar contexto do mês (ex: "mês pesado por causa da viagem") |
| **Score de saúde financeira** | Indicador 0–100 baseado em: saldo positivo, metas em dia, contas pagas no prazo |
| **Modo de revisão mensal** | Tela guiada para fechar o mês: confirmar rendas recebidas, checar contas pagas, ver saldo final |

---

## 🚫 Fora do Escopo

- Integração com APIs bancárias (Open Finance, Plaid etc.)
- Mais de 2 membros por household
- Múltiplos households por usuário