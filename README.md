# Finance Organization Web

Sistema de gerenciamento financeiro familiar desenvolvido em Next.js para controle de contas a pagar, contas a receber, carteira patrimonial e análises financeiras.

---

# 🚀 Início Rápido

## Pré-requisitos

* Node.js 18 ou superior
* NPM

Verificar versões instaladas:

```bash
node -v
npm -v
```

---

## Instalar dependências

```bash
npm install
```

---

## Executar localmente

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

O sistema será recarregado automaticamente sempre que houver alterações no código.

---

# 📦 Gerar Build para Produção

Para gerar a versão de produção:

```bash
npm run build
```

Ao finalizar, será criada a pasta:

```text
out/
```

Esta pasta contém todos os arquivos estáticos necessários para publicação do sistema.

---

# 🚀 Deploy

## Passo 1 - Gerar Build

```bash
npm run build
```

## Passo 2 - Compactar

Compacte a pasta:

```text
out/
```

em um arquivo ZIP.

Exemplo:

```text
finance-organization-web.zip
```

## Passo 3 - Publicar

Enviar o conteúdo da pasta `out` (ou o arquivo ZIP contendo seu conteúdo) para a hospedagem.

Substituir os arquivos da versão anterior.

---

# 🔄 Fluxo Completo de Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar localmente
npm run dev

# Gerar build para produção
npm run build

# Compactar a pasta out/
# Publicar na hospedagem
```

---

# ⚙️ Configuração da API

O frontend utiliza a variável de ambiente:

```env
NEXT_PUBLIC_API_URL
```

Exemplo:

```env
NEXT_PUBLIC_API_URL=http://api.financeiro.arielgiacomini.com.br
```

Caso a variável não seja informada, será utilizada a URL padrão configurada no projeto.

---

# 🏗️ Tecnologias Utilizadas

* Next.js
* React
* TypeScript
* Tailwind CSS
* Recharts
* Lucide Icons

---

# 📁 Estrutura do Projeto

```text
src/
├── app/
│   ├── analise/
│   ├── carteira/
│   ├── configuracoes/
│   ├── contas/
│   ├── contas-a-pagar/
│   ├── contas-a-receber/
│   └── login/
│
├── components/
│   ├── forms/
│   ├── layout/
│   └── ui/
│
├── lib/
│   ├── api.ts
│   ├── auth.ts
│   └── wallet.ts
│
└── types/
    └── index.ts
```

---

# 📊 Principais Funcionalidades

* Dashboard financeiro
* Contas a pagar
* Contas a receber
* Controle de carteira patrimonial
* Histórico financeiro
* Indicadores e análises
* Controle por categorias
* Multi-país (Brasil e Espanha)
* Controle de recebimentos
* Gráficos financeiros

---

# 🔒 Autenticação

O sistema possui autenticação básica para acesso às funcionalidades.

As configurações de autenticação encontram-se na camada de frontend e podem ser evoluídas futuramente para utilização de JWT e autenticação integrada à API.

---

# 📝 Observações

Este projeto utiliza exportação estática do Next.js:

```javascript
output: 'export'
```

Por este motivo, o deploy é realizado através da publicação da pasta:

```text
out/
```

Não é necessário executar:

```bash
npm start
```

em ambiente de produção.
