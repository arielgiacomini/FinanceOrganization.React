<div align="center">

<img src="https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js" />
<img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" />
<img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss" />
<img src="https://img.shields.io/badge/Status-Em%20Produção-22c55e?style=for-the-badge" />

<br/><br/>

# 💰 Finance Organization — Web

**Sistema de controle financeiro pessoal com suporte a múltiplos países.**  
Versão web do [FinanceOrganization.WindowsForms](https://github.com/arielgiacomini/FinanceOrganization.WindowsForms), acessível de qualquer dispositivo.

</div>

---

## 🖥️ Preview do Sistema

### Dashboard — Visão Geral por País

```
┌─────────────────────────────────────────────────────────────────┐
│  Finance Org          Dashboard          Maio / 2026            │
├──────────┬──────────────────────────────────────────────────────┤
│          │  Resumo Geral                                         │
│ Dashboard│  96 lançamentos · 12 pendentes · 6 contas a receber  │
│          ├──────────────────────┬───────────────────────────────┤
│ Contas   │  🇧🇷 Brasil           │  🇪🇸 Espanha                   │
│ a Pagar  │  ─────────────────── │  ─────────────────────────── │
│          │  A Pagar  R$46.396   │  A Pagar       €1.240,00     │
│ Contas   │  A Receber R$28.441  │  A Receber        €950,00    │
│ a Receber│  Saldo   -R$17.955   │  Saldo           -€290,00    │
│          │  Pagos      82/94    │  Pendentes              2    │
│ Contas   │  ─────────────────── │  ─────────────────────────── │
│ Bancárias│  Pendentes a Pagar   │  A Receber                   │
│          │  Conta de Luz R$310  │  Salário ES  €950,00        │
│ Análise  │  Internet    R$120   │                              │
│          │  Aluguel   R$2.500   │                              │
└──────────┴──────────────────────┴───────────────────────────────┘
```

---

### 💸 Contas a Pagar — Listagem Mensal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Contas a Pagar         Maio / 2026          [< Maio/2026 >]  [+ Nova conta]│
├─────────────────┬────────────────┬───────────────────────────────────────────┤
│  Total do mês   │     Pago        │         Pendente                         │
│  R$ 46.396,79  │  R$ 20.650,61  │       R$ 25.746,18                       │
├─────────────────┴────────────────┴───────────────────────────────────────────┤
│  🌎 Todos 96   🇧🇷 Brasil 94   🇪🇸 Espanha 2     [v Mostrar detalhes]  94 reg │
├──────┬──────────────────────┬──────────┬──────────────┬──────────┬──────────┤
│      │ Nome                 │ País     │ Conta        │ Valor    │ Status   │
├──────┼──────────────────────┼──────────┼──────────────┼──────────┼──────────┤
│  ○   │ Conta de Luz         │ 🇧🇷 Brasil│ ● Itaú CC   │ R$310,00 │⚡Pendente│
│  ○   │ Internet Vivo        │ 🇧🇷 Brasil│ ● Itaú CC   │ R$120,00 │⚡Pendente│
│  ○   │ Aluguel              │ 🇧🇷 Brasil│ ● Nubank    │ R$2.500  │⚡Pendente│
│  ○   │ Netflix              │ 🇪🇸 Espanh│ ● Revolut   │  €15,99  │⚡Pendente│
│  ✓   │ Supermercado Extra   │ 🇧🇷 Brasil│ ● Itaú CC   │ R$890,00 │✅ Pago  │
│  ✓   │ Farmácia             │ 🇧🇷 Brasil│ ● Nubank    │ R$45,00  │✅ Pago  │
└──────┴──────────────────────┴──────────┴──────────────┴──────────┴──────────┘
```

> 🎨 As cores de fundo de cada linha refletem a **cor da conta bancária** cadastrada na API.

---

### 📋 Drawer de Histórico — Todas as Ocorrências

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ←  Conta de Luz Enel                                                    [X]│
│     Itaú Personnalité · Moradia:Energia · Mensal · ID #42                  │
├──────────────┬─────────────────┬───────────────┬─────────────────────────────┤
│  Parcelas    │   Total Geral   │   Total Pago  │   Pendente                  │
│  11/14 pagas │   R$ 4.340,00   │  R$ 3.410,00  │   R$ 930,00                 │
├──────────────┴─────────────────┴───────────────┴─────────────────────────────┤
│  [□ Sel.todos]  14 registro(s)                    [v Mostrar detalhes]       │
├──────┬─────────────────┬──────────┬──────────┬──────────┬──────────┬────────┤
│  □   │ Mês/Ano         │ País     │ Valor    │Vencimento│  Status  │ Ações  │
├──────┼─────────────────┼──────────┼──────────┼──────────┼──────────┼────────┤
│  □   │ Fevereiro/2026  │ 🇧🇷 Brasil│ R$310,00 │ 10/02    │ ✅ Pago  │ ✏ 🗑  │
│  □   │ Março/2026      │ 🇧🇷 Brasil│ R$310,00 │ 10/03    │ ✅ Pago  │ ✏ 🗑  │
│  □   │ Abril/2026      │ 🇧🇷 Brasil│ R$310,00 │ 10/04    │ ✅ Pago  │ ✏ 🗑  │
│  □   │ Maio/2026 [Atual]│ 🇧🇷 Brasil│ R$310,00│ 10/05    │⚡Pendente│ 💰✏🗑 │
│  □   │ Junho/2026      │ 🇧🇷 Brasil│ R$310,00 │ 10/06    │⚡Pendente│ 💰✏🗑 │
│  □   │ Julho/2026      │ 🇧🇷 Brasil│ R$310,00 │ 10/07    │⚡Pendente│ 💰✏🗑 │
└──────┴─────────────────┴──────────┴──────────┴──────────┴──────────┴────────┘
  [Editar 3 registro(s)]  [Excluir 3 registro(s)]
```

---

### 📊 Análise — Média Mensal de Gastos

```
┌─────────────────────────────────────────────────────────────────┐
│  Análise Financeira            [< Maio/2026 >]                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fevereiro/2026  R$ 38.210,00  ↓ -R$4.120,00                  │
│  ████████████████████████████████▌                              │
│                                                                 │
│  Março/2026      R$ 42.330,00  ↑ +R$4.120,00                  │
│  ███████████████████████████████████████▌                       │
│                                                                 │
│  Abril/2026      R$ 44.890,00  ↑ +R$2.560,00                  │
│  █████████████████████████████████████████████▌                 │
│                                                                 │
│  Maio/2026       R$ 46.396,79  ↑ +R$1.506,79                  │
│  ████████████████████████████████████████████████▌              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🏦 Contas Bancárias

```
┌─────────────────────────┐  ┌─────────────────────────┐
│  🏦 Itaú Personnalité   │  │  💳 Nubank Roxo         │
│  ─────────────────────  │  │  ─────────────────────  │
│  Agência    0042        │  │  Cartão  •••• 4521      │
│  Conta   12345-6        │  │  Fechamento   Dia 15    │
│  ✓ Ativa                │  │  Vencimento   Dia 22    │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐
│  💳 Revolut ES          │  │  🏦 Santander ES         │
│  ─────────────────────  │  │  ─────────────────────  │
│  Cartão  •••• 7893      │  │  Agência    0001        │
│  Fechamento   Dia 28    │  │  Conta   98765-4        │
│  Vencimento   Dia 5     │  │  ✓ Ativa                │
└─────────────────────────┘  └─────────────────────────┘
```

---

## ✨ Funcionalidades

### 🏠 Dashboard
- Resumo financeiro do mês atual separado por **país** (🇧🇷 Brasil e 🇪🇸 Espanha)
- Totais de contas a pagar e a receber por país, com moedas corretas (R$ e €)
- Lista de contas pendentes e entradas a receber por país

### 💸 Contas a Pagar
- Listagem mensal com filtro por mês/ano e por país
- Cores de fundo das linhas baseadas na **cor da conta bancária** cadastrada na API
- Ordenação: pendentes por vencimento → pagas ao final
- Ações por linha: **💰 Pagar**, **📋 Histórico**, **✏️ Editar**, **🗑️ Excluir**
- Lógica de **pagamento adiantado** (código `[34]`) com confirmação do usuário
- Botão Mostrar/Ocultar detalhes (observações)
- Cards de resumo separados por país quando filtro "Todos" está ativo

### 💚 Contas a Receber
- Mesma estrutura das Contas a Pagar
- Ações: **💰 Receber**, **📋 Histórico**, **✏️ Editar**, **🗑️ Excluir**
- Saldo (valor manipulado) exibido em coluna separada

### 📋 Drawer de Histórico
- Painel lateral deslizante com **todas as ocorrências** do registro
- Ordenação: últimos 3 meses → mês atual destacado → próximos meses
- **Seleção múltipla** com checkbox + "Selecionar todos"
- **Edição em lote** e **exclusão em lote** com confirmação
- Todas as ações individuais disponíveis por linha

### 🏦 Contas Bancárias
- Cards com cor personalizada de cada conta/cartão
- Agência, número, dia de vencimento/fechamento

### 📊 Análise Mensal
- Histórico de gastos com barras comparativas
- Variação em relação ao mês anterior (↑ ↓)

---

## 🌍 Suporte a Múltiplos Países

| | 🇧🇷 Brasil | 🇪🇸 Espanha |
|---|---|---|
| Moeda | R$ (BRL) | € (EUR) |
| Filtro | ✅ | ✅ |
| Dashboard | ✅ | ✅ |
| Histórico | ✅ | ✅ |

---

## 🗂️ Estrutura do Projeto

```
src/
├── app/                              # Páginas (Next.js App Router)
│   ├── page.tsx                      # Dashboard (/)
│   ├── contas-a-pagar/page.tsx       # Contas a Pagar
│   ├── contas-a-receber/page.tsx     # Contas a Receber
│   ├── contas/page.tsx               # Contas Bancárias
│   ├── analise/page.tsx              # Análise Mensal
│   ├── layout.tsx                    # Layout principal com sidebar
│   └── globals.css                   # Design system e estilos globais
│
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx               # Menu lateral + hamburguer mobile
│   ├── ui/
│   │   ├── index.tsx                 # Modal, Table, TRow, StatCard...
│   │   ├── BillToPayHistory.tsx      # Drawer histórico — Contas a Pagar
│   │   ├── CashReceivableHistory.tsx # Drawer histórico — Contas a Receber
│   │   ├── CountryTabs.tsx           # Abas de filtro por país
│   │   ├── Flags.tsx                 # Bandeiras SVG
│   │   ├── PayBillModal.tsx          # Modal pagamento (com adiantamento)
│   │   ├── ReceiveModal.tsx          # Modal recebimento
│   │   ├── SummaryCards.tsx          # Cards de resumo por país
│   │   └── YearMonthSelector.tsx     # Seletor mês/ano com dados da API
│   └── forms/
│       ├── BillToPayForm.tsx         # Formulário Conta a Pagar
│       └── CashReceivableForm.tsx    # Formulário Conta a Receber
│
├── lib/
│   ├── api.ts                        # Cliente HTTP — todos os endpoints
│   └── utils.ts                      # Formatação de moeda, datas, utilitários
│
└── types/
    └── index.ts                      # Tipos TypeScript espelhando as entidades C#
```

---

## 🚀 Como rodar localmente

```bash
# 1. Clonar
git clone https://github.com/arielgiacomini/finance-web.git
cd finance-web

# 2. Instalar dependências
npm install

# 3. Configurar ambiente
cp .env.local.example .env.local
# Edite .env.local com a URL da API se necessário

# 4. Iniciar
npm run dev
# Acesse http://localhost:3000
```

### Build para produção

```bash
npm run build
npm start
```

---

## 🌐 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/v1/bills-to-pay/search` | Busca contas a pagar |
| `POST` | `/v1/bills-to-pay/register` | Cadastra conta a pagar |
| `PUT`  | `/v1/bills-to-pay/edit` | Edita conta a pagar |
| `PUT`  | `/v1/bills-to-pay/edit-basket` | Edição em lote |
| `PATCH`| `/v1/bills-to-pay/pay` | Registra pagamento |
| `DELETE`| `/v1/bills-to-pay/delete` | Exclui conta a pagar |
| `POST` | `/v1/cash-receivable/search` | Busca contas a receber |
| `POST` | `/v1/cash-receivable/register` | Cadastra conta a receber |
| `PUT`  | `/v1/cash-receivable/edit` | Edita conta a receber |
| `PUT`  | `/v1/cash-receivable/edit-basket` | Edição em lote |
| `PATCH`| `/v1/cash-receivable/receive` | Registra recebimento |
| `DELETE`| `/v1/cash-receivable/delete` | Exclui conta a receber |
| `GET`  | `/v1/account/search-all` | Lista contas bancárias |
| `GET`  | `/v1/category/search` | Lista categorias |
| `GET`  | `/v1/date/month-year-all` | Lista meses disponíveis |

### Configuração de CORS na API (`Startup.cs`)

```csharp
services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy
            .SetIsOriginAllowed(_ => true)
            .AllowAnyMethod()
            .AllowAnyHeader()
    );
});

// em Configure(), antes de app.UseMvc():
app.UseCors("AllowFrontend");
```

---

## 🛠️ Tecnologias

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| [Next.js](https://nextjs.org/) | 14.2 | Framework React com App Router |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Tipagem estática |
| [Tailwind CSS](https://tailwindcss.com/) | 3.4 | Utilitários de estilo |
| [date-fns](https://date-fns.org/) | 3.6 | Manipulação de datas |
| [lucide-react](https://lucide.dev/) | 0.400 | Ícones |

---

## 📁 Projetos relacionados

| Projeto | Tecnologia | Descrição |
|---------|-----------|-----------|
| [FinanceOrganization.WebAPI](https://github.com/arielgiacomini/FinanceOrganization.WebAPI) | C# / ASP.NET Core | Backend REST API |
| [FinanceOrganization.WindowsForms](https://github.com/arielgiacomini/FinanceOrganization.WindowsForms) | C# / Windows Forms | Versão desktop original |

---

## 👤 Autor

**Ariel Giacomini da Silva**  
📧 contato@arielgiacomini.com.br  
🐙 [@arielgiacomini](https://github.com/arielgiacomini)

---

<div align="center">
<sub>Finance Organization Web — Controle financeiro pessoal acessível de qualquer dispositivo.</sub>
</div>
