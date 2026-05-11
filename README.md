# 💰 Finance Organization — Web

Frontend web do sistema de controle financeiro pessoal, construído com **Next.js 14**, **TypeScript** e **Tailwind CSS**. Consome a API REST do projeto FinanceOrganization.WebAPI.

---

## ✨ Funcionalidades

### 🏠 Dashboard
- Resumo financeiro do mês atual separado por **país** (🇧🇷 Brasil e 🇪🇸 Espanha)
- Totais de contas a pagar e a receber por país, com moedas corretas (R$ e €)
- Lista de contas pendentes e entradas recentes

### 💸 Contas a Pagar
- Listagem mensal com filtro por mês/ano e por país
- Cores de fundo das linhas baseadas na **cor da conta bancária** cadastrada na API
- Ordenação: pendentes por vencimento → pagas ao final
- Ações por linha: **Pagar**, **Histórico**, **Editar**, **Excluir**
- Lógica de **pagamento adiantado** (código `[34]`) com confirmação do usuário
- Botão Mostrar/Ocultar detalhes (observações)
- Cards de resumo separados por país quando filtro "Todos" está ativo

### 💚 Contas a Receber
- Mesma estrutura das Contas a Pagar
- Ações: **Receber**, **Histórico**, **Editar**, **Excluir**
- Saldo (valor manipulado) exibido em coluna separada

### 📋 Drawer de Histórico (Contas a Pagar e Receber)
- Abre como painel lateral com animação deslizante
- Exibe **todas as ocorrências** do registro ao longo dos meses
- Ordenação: últimos 3 meses (crescente) → mês atual (destacado) → próximos meses
- **Seleção múltipla** com checkbox por linha e "Selecionar todos"
- **Edição em lote**: edita múltiplos registros de uma vez
- **Exclusão em lote**: exclui múltiplos com confirmação
- Todas as ações individuais disponíveis por linha
- Botão Mostrar/Ocultar detalhes
- Coluna País com bandeira SVG

### 🏦 Contas Bancárias
- Exibe todas as contas e cartões cadastrados na API
- Mostra cor personalizada, agência, número, dia de vencimento/fechamento

### 📊 Análise
- Histórico de média mensal de gastos
- Barras comparativas com variação em relação ao mês anterior

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
│   │   └── Sidebar.tsx               # Menu lateral de navegação
│   ├── ui/
│   │   ├── index.tsx                 # Componentes base: Modal, Table, TRow...
│   │   ├── BillToPayHistory.tsx      # Drawer de histórico — Contas a Pagar
│   │   ├── CashReceivableHistory.tsx # Drawer de histórico — Contas a Receber
│   │   ├── CountryTabs.tsx           # Abas de filtro por país
│   │   ├── Flags.tsx                 # Bandeiras SVG (Brasil e Espanha)
│   │   ├── PayBillModal.tsx          # Modal de pagamento (com adiantamento)
│   │   ├── ReceiveModal.tsx          # Modal de recebimento
│   │   ├── SummaryCards.tsx          # Cards de resumo por país
│   │   └── YearMonthSelector.tsx     # Seletor de mês/ano com dados da API
│   └── forms/
│       ├── BillToPayForm.tsx         # Formulário de Conta a Pagar
│       └── CashReceivableForm.tsx    # Formulário de Conta a Receber
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

### Pré-requisitos

- [Node.js 18+](https://nodejs.org/)
- npm (incluído com o Node.js)

```bash
node -v   # deve exibir v18+
npm -v
```

### 1. Clonar o repositório

```bash
git clone https://github.com/arielgiacomini/finance-web.git
cd finance-web
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Edite o `.env.local` se necessário:

```env
# URL da API de produção
NEXT_PUBLIC_API_URL=http://api.financeiro.arielgiacomini.com.br

# Para apontar para ambiente local
# NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 4. Iniciar em modo desenvolvimento

```bash
npm run dev
```

Acesse **http://localhost:3000** no navegador.

---

## 🏗️ Build para produção

```bash
npm run build
npm start
```

---

## 🌐 Integração com a API

Todos os endpoints são chamados via `src/lib/api.ts`. A função `normalizeResponse` converte automaticamente as chaves PascalCase do .NET para camelCase no frontend.

### Endpoints utilizados

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

### ⚠️ Configuração de CORS na API

Para que o frontend se comunique com a API, adicione no `Startup.cs`:

```csharp
// ConfigureServices
services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy
            .SetIsOriginAllowed(_ => true)
            .AllowAnyMethod()
            .AllowAnyHeader()
    );
});

// Configure — antes do app.UseMvc()
app.UseCors("AllowFrontend");
```

---

## 🎨 Design System

Tema escuro com variáveis CSS globais em `globals.css`:

| Variável | Uso |
|----------|-----|
| `--bg-0` a `--bg-5` | Superfícies de fundo em camadas |
| `--text-1` a `--text-3` | Hierarquia de texto |
| `--green-400/500` | Cor primária (ações, destaques) |
| `--red` | Valores a pagar, erros |
| `--amber` | Pendências, avisos |
| `--blue` | Ações secundárias (histórico) |
| `--border-1` a `--border-3` | Bordas em diferentes intensidades |

---

## 🌍 Suporte a múltiplos países

O sistema suporta contas em **Brasil** e **Espanha**:

- Valores em **R$ (BRL)** para registros brasileiros
- Valores em **€ (EUR)** para registros espanhóis
- Filtro por país com bandeiras SVG nas telas principais
- Dashboard com blocos e métricas separados por país
- Campos de seleção de país em todos os formulários de cadastro

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

- **API:** [FinanceOrganization.WebAPI](https://github.com/arielgiacomini/FinanceOrganization.WebAPI) — Backend em C# / ASP.NET Core
- **Desktop:** [FinanceOrganization.WindowsForms](https://github.com/arielgiacomini/FinanceOrganization.WindowsForms) — Versão desktop original em Windows Forms

---

## 👤 Autor

**Ariel Giacomini da Silva**
- Email: contato@arielgiacomini.com.br
- GitHub: [@arielgiacomini](https://github.com/arielgiacomini)

---

*Finance Organization Web — Controle financeiro pessoal acessível de qualquer dispositivo.*
