# FinanceOrganization.React — Contexto do Projeto

Leia este arquivo antes de qualquer alteração no código.

---

## Stack

| Item | Valor |
|------|-------|
| Framework | Next.js 14.2.5 (App Router) |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS + CSS custom properties |
| Tema | Dark fixo — não existe tema claro |
| Fontes | DM Sans (sans) · DM Mono (mono) |
| Backend | REST em `http://api.financeiro.arielgiacomini.com.br` |
| Validação | `esbuild <arquivo>.tsx --format=esm --jsx=automatic` antes de qualquer entrega |

---

## Estrutura de pastas

```
src/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── contas-a-pagar/page.tsx     # Contas a Pagar
│   ├── contas-a-receber/page.tsx   # Contas a Receber
│   ├── carteira/page.tsx           # Carteira
│   ├── analise/page.tsx            # Análise
│   ├── configuracoes/page.tsx      # Configurações
│   └── globals.css                 # CSS vars do tema
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx           # Layout principal (usado em todas as páginas)
│   │   ├── Sidebar.tsx             # Menu lateral — contém APP_VERSION
│   │   └── AuthGuard.tsx
│   ├── forms/
│   │   ├── BillToPayForm.tsx       # Criação/edição contas a pagar
│   │   └── CashReceivableForm.tsx
│   └── ui/
│       ├── index.tsx               # Modal, Table, TRow, Td, Spinner, Empty
│       ├── BillToPayHistory.tsx    # Modal histórico contas a pagar
│       ├── CashReceivableHistory.tsx
│       ├── FinanceChart.tsx        # Gráfico do dashboard
│       ├── CurrencyInput.tsx       # Input monetário com botão ±
│       ├── RecordsAwaitingAlert.tsx # Alerta global de registros pendentes
│       └── ...demais componentes
├── lib/
│   ├── api.ts      # Todas as chamadas à API + normalizeResponse
│   ├── auth.ts     # Autenticação via localStorage
│   ├── utils.ts    # formatCurrency, formatDate, formatYearMonth…
│   └── wallet.ts   # Configurações da Carteira em localStorage
└── types/index.ts  # BillToPay, CashReceivable, Account…
```

---

## Regra crítica — TRow + Td

> ⚠️ A causa raiz de todos os problemas de fundo branco nas tabelas.

`TRow` define `--row-bg` como CSS custom property no `<tr>`. `Td` aplica
`backgroundColor: 'var(--row-bg, var(--bg-2))'` no `<td>` DOM.

**NUNCA coloque `<td>` cru dentro de `<TRow>`** — `<td>` nativo não consome
`--row-bg` e fica com fundo branco quebrando a linha toda.

```tsx
// ✅ CORRETO — todos os filhos são <Td>
<TRow bg="#1b2e1d">
  <Td>Nome</Td>
  <Td>Valor</Td>
</TRow>

// ❌ ERRADO — <td> cru ignora --row-bg → fundo branco
<TRow bg="#1b2e1d">
  <td style={{ width: 4 }}>...</td>  {/* PROIBIDO */}
  <Td>Nome</Td>
</TRow>
```

### Cores por estado (usar em `bg=`)

| Estado | Cor |
|--------|-----|
| Normal | `'var(--bg-2)'` (padrão — pode omitir) |
| Pago / Recebido | `'#1b2e1d'` (verde escuro = 15% #22c55e sobre #161616) |
| Selecionado | `'rgba(96,165,250,0.10)'` |
| Mês atual (pendente) | `'rgba(251,191,36,0.08)'` |

---

## CSS custom properties

```css
/* Superfícies */
--bg-0: #0a0a0a  --bg-1: #111111  --bg-2: #161616
--bg-3: #1e1e1e  --bg-4: #262626  --bg-5: #303030

/* Texto */
--text-1: #f5f5f5   --text-2: #a3a3a3   --text-3: #6b6b6b

/* Bordas */
--border-1: rgba(255,255,255,0.07)
--border-2: rgba(255,255,255,0.12)

/* Verde */
--green-400: #4ade80  --green-500: #22c55e
--green-dim: rgba(34,197,94,0.12)  --green-border: rgba(34,197,94,0.25)

/* Semânticas */
--red: #f87171        --red-dim: rgba(248,113,113,0.12)
--amber: #fbbf24      --amber-dim: rgba(251,191,36,0.12)
--blue: #60a5fa       --blue-dim: rgba(96,165,250,0.12)
```

---

## Versão da aplicação

```tsx
// src/components/layout/Sidebar.tsx
export const APP_VERSION = 'v212'
```

Aparece ao lado do botão "Sair". **Incrementar a cada alteração entregue.**

---

## API — endpoints principais

| Método | Verbo | Endpoint |
|--------|-------|----------|
| billsToPayApi.search | POST | /v1/bills-to-pay/search |
| billsToPayApi.create | POST | /v1/bills-to-pay/create |
| billsToPayApi.edit | PUT | /v1/bills-to-pay/edit |
| billsToPayApi.pay | PATCH | /v1/bills-to-pay/pay |
| billsToPayApi.delete | DELETE | /v1/bills-to-pay/delete |
| billsToPayApi.recordsAwaiting | GET | /v1/bills-to-pay/records-awaiting-complete-registration |
| cashReceivableApi.search | POST | /v1/cash-receivable/search |
| cashReceivableApi.receive | **PATCH** | /v1/cash-receivable/receive |
| cashReceivableApi.edit | PUT | /v1/cash-receivable/edit |
| accountsApi.searchAll | GET | /v1/accounts/search-all |
| dashboardApi.monthlyCashflow | POST | /v1/dashboard/monthly-cashflow-billtopay-cashreceivable |
| walletApi.search | GET | /v1/wallet/search |
| walletApi.edit | **PUT** | /v1/wallet/edit |

`normalizeResponse` em `api.ts` converte todas as chaves da resposta para
lowercase recursivamente — campos chegam em camelCase minúsculo.

---

## Tipos principais

```typescript
interface BillToPay {
  id: string
  idBillToPayRegistration: number
  account?: string; name?: string; category?: string
  value: number; dueDate: string; yearMonth?: string
  purchaseDate?: string; payDay?: string; hasPay: boolean
  frequence?: string; registrationType?: string
  additionalMessage?: string; country?: string
  detailsQuantity?: number  // populado com showDetails: true
  detailsAmount?: number
  details?: BillToPay[]    // registros "Compra Livre" relacionados
  creationDate: string; lastChangeDate?: string
}

interface CashReceivable {
  id: string
  idCashReceivableRegistration: number
  name?: string; account?: string; category?: string
  value: number; manipulatedValue: number
  dueDate?: string; yearMonth?: string
  dateReceived?: string; hasReceived: boolean
  frequence?: string; registrationType?: string
  additionalMessage?: string; country?: string
  creationDate: string; lastChangeDate?: string
}
```

---

## Comportamentos por tela

### Contas a Pagar
- Ordenação: pendentes primeiro (por vencimento) → pagos no fim
- Linha paga: `bg='#1b2e1d'`, valor verde, data de pagamento verde
- Coluna "Qtd Compras": badge azul com `detailsQuantity` — abre modal "Registros Relacionados"
- Alerta global (`RecordsAwaitingAlert`): polling em `AppLayout`, mostra itens pendentes de cadastro

### Contas a Receber
- Ordenação: pendentes primeiro → recebidos no fim
- Linha recebida: `bg='#1b2e1d'`
- Filtro de status: Todos / Não recebido / Recebido

### Histórico (BillToPayHistory / CashReceivableHistory)
- Drawer: bottom-sheet no mobile, painel lateral (min 960px) no desktop
- Cabeçalho sticky no desktop via `sm:sticky sm:top-0` nos `<th>`
- Linha paga/recebida: mesmo `bg='#1b2e1d'`

### Dashboard
- Cards de resumo rápido + `FinanceChart`
- Blocos Brasil/Espanha **removidos** — não recriar
- Memória de cálculo: colapsável (fechada por padrão), respeita filtros do gráfico via `useMemo`

---

## Armadilhas — lições aprendidas

### Zero e negativo em inputs de valor
`parseFloat('0') || fallback` retorna `fallback` porque `0` é falsy.
Sempre usar: `!isNaN(parseFloat(v)) ? parseFloat(v) : fallback`

### Hooks após early return
`useMemo`, `useState`, `useEffect` nunca podem vir depois de
`if (loading) return`. Mover todos os hooks para antes de qualquer `return` condicional.

### Sticky headers em tabela
`position: sticky` no `<thead>` não funciona com `border-collapse: collapse`.
Aplicar `sm:sticky sm:top-0 sm:z-10` em cada `<th>` individualmente.

### Cabeçalho fixo de filtros + sticky da tabela
O bloco de filtros é `sm:sticky top:0 z-30`. O cabeçalho da tabela usa
`headerOffset` medido via `ResizeObserver` para colar logo abaixo.

### TypeScript Set sem downlevelIteration
Usar `Record<string, boolean>` + `forEach` em vez de `Set<string>` onde o TS reclamar.

### Verbos HTTP
- `/v1/cash-receivable/receive` → **PATCH** (não PUT)
- `/v1/wallet/edit` → **PUT** (não PATCH)

---

## Checklist antes de qualquer alteração entregue

- [ ] Todos os `<TRow>` têm apenas `<Td>` como filhos (sem `<td>` cru)
- [ ] `APP_VERSION` incrementado em `Sidebar.tsx`
- [ ] esbuild validado em **todos** os arquivos alterados
- [ ] Zero e negativo funcionam onde aplicável
- [ ] Hooks antes de qualquer early return
- [ ] Sticky headers aplicados nos `<th>`, não no `<thead>`
