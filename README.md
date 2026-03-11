# Nexus Crypto Wallet API

## API REST de alta performance para gerenciamento de carteiras cripto, desenvolvida como parte do Teste Prático – Desenvolvedor Backend na Nexus. O Sistema simula componentes de uma **exchange financeira** com foco em:
**Integridade de dados, Consistência contábil e Rastreabilidade de transações**.
## Base URL
**API disponível em:** https://nexus-wallet-exchange.onrender.com

## Endpoints da API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/` | GET | Health check |
| `/auth/register` | POST | Cadastro de usuário |
| `/auth/login` | POST | Login e emissão de JWT |
| `/webhooks/deposit` | POST | Depósito via webhook (requer Idempotency Key) |
| `/api/swap/quote` | POST | Cotação em tempo real via CoinGecko |
| `/api/swap` | POST | Execução de swap entre ativos |
| `/api/history` | GET | Histórico de transações com paginação |
| `/api/ledger` | GET | Extrato contábil com paginação e filtro por token |

## Engenharia de Back com Base em Instituições Financeiras

**Diferente de uma carteira simples, este projeto aplica conceitos de sistemas bancários reais:**

**Precisão de 18 Casas Decimais:** Uso da biblioteca Decimal.js e tipo @db.Decimal(36, 18) no banco de dados para suportar o padrão de tokens como Ethereum, evitando erros de arredondamento de ponto flutuante.

**Arquitetura de Ledger (Livro-Razão):** Toda alteração de saldo gera um LedgerMovement atômico. Não apenas alteramos o saldo, mas registramos o oldBalance e newBalance para fins de auditoria completa.

**Idempotência Garantida:** Webhooks de depósito utilizam chaves de idempotência únicas, prevenindo o processamento duplicado de uma mesma ordem em caso de instabilidade na rede.

**Transações Atômicas (ACID):** Operações de Swap garantem que o débito de um ativo e o crédito de outro ocorram simultaneamente através do $transaction do Prisma.

**Cotação em Tempo Real:** Integração com a API pública da CoinGecko para obter preços reais de BTC e ETH, com suporte a pares Cripto→BRL, BRL→Cripto e Cripto→Cripto via cross-rate.

## Stack Utilizada

| Tecnologia | Decisão Técnica |
|------------|----------------|
| Node.js + TypeScript | Segurança de tipos em tempo de compilação |
| Fastify | Baixa latência e alta performance comparado ao Express |
| PostgreSQL | Banco relacional com suporte a transações ACID |
| Prisma ORM | Type-safety nas queries e migrations automatizadas |
| Decimal.js | Precisão arbitrária para evitar erros de ponto flutuante |
| JWT (Access + Refresh) | Sessões seguras com renovação de token |
| Bcrypt | Hashing seguro de senhas |
| Zod | Validação de schema em runtime |
| Docker | Infraestrutura local reproduzível |
| Render | Deploy em produção com PostgreSQL gerenciado |

## Estrutura do Projeto

## Estrutura do Projeto

```text
src
├── routes
│   ├── authRoutes.ts
│   ├── depositRoutes.ts
│   ├── historyRoutes.ts
│   └── swapRoutes.ts
│
├── services
│   ├── authService.ts
│   ├── coinGeckoService.ts
│   ├── historyService.ts
│   └── ledgerService.ts
│
├── lib
│   └── prisma.ts
│
├── types
│   ├── fastify-jwt.d.ts
│   └── fastify.d.ts
│
└── server.ts
````

## Estrutura do Banco de Dados

```text
Users
├── id (UUID)
├── email (unique)
├── passwordHash
└── createdAt


Wallets
├── id (UUID)
├── userId → Users
├── token (BRL | BTC | ETH)
├── balance (Decimal 36,18)
└── updatedAt


Transactions
├── id (UUID)
├── userId → Users
├── type (DEPOSIT | SWAP | WITHDRAWAL)
├── status (COMPLETED)
└── createdAt


LedgerMovements
├── id (UUID)
├── transactionId → Transactions
├── type (DEPOSIT | SWAP_IN | SWAP_OUT | SWAP_FEE | WITHDRAWAL)
├── token
├── amount (Decimal 36,18)
├── oldBalance (Decimal 36,18)
├── newBalance (Decimal 36,18)
└── createdAt


ProcessedWebhook
├── id (UUID)
├── idempotencyKey (unique)
└── createdAt
```

## Funcionalidades Principais
**Autenticação e Segurança**

- Cadastro com hash de senha via Bcrypt
- Login com emissão de Access Token + Refresh Token JWT
- Middleware global de autenticação em todas as rotas privadas

**Depósitos via Webhook**

- Endpoint simulando gateway de pagamento externo
- Idempotência nativa via idempotencyKey — protege contra double-spending
- Validação de usuário e token antes de creditar

**Motor de Swap (Conversão)**

- Quote: cotação em tempo real sem executar operação
- Swap: execução atômica com taxa de 1.5% aplicada automaticamente
- Cotação buscada da CoinGecko no momento da execução — cliente não pode manipular o rate
- Suporte a pares: BRL ↔ BTC, BRL ↔ ETH, BTC ↔ ETH

**Ledger Auditável**

- Cada operação gera movimentos contábeis com estado anterior e posterior
- Saldo pode ser reconstruído integralmente a partir das movimentações
- Paginação com filtro por token (token = BTC)

**Histórico de Transações**

- Listagem de movimentos detalhados por transação
- Paginação configurável (?page=1&limit=10, máx. 50 por página)

**Validação de Dados (Zod)**
- Schema de validação em todos os endpoints
- Erros retornam mensagens descritivas por campo
- Paginação com limite máximo
- Enum de tokens validado — apenas BRL, BTC e ETH são aceitos

**Saque**
- Validação de saldo antes de debitar
- Registro no ledger com tipo WITHDRAWAL
- Transferência simulada (mock)

## Como Executar Localmente

### 1. Clonar o repositório

```bash
git clone https://github.com/AndreSedakow/Nexus-Wallet-Exchange.git
cd Nexus-Wallet-Exchange
```

### 2. Configurar ambiente

Crie um arquivo `.env` na raiz seguindo o modelo do `.env.example`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/nexus_db"
JWT_SECRET="sua_chave_secreta_aqui"
```

### 3. Subir infraestrutura (Docker)

```bash
docker-compose up -d
```

### 4. Instalar dependências e rodar o projeto

```bash
npm install
npx prisma db push
npm run dev
```

A API iniciará na porta **3333**

Acesse em:  
`http://localhost:3333`

## Conceitos de Fintech Aplicados

Este projeto não é apenas um CRUD. Ele aplica padrões utilizados por **exchanges** e **bancos digitais**:

- **Atomicidade**  
  Transações SQL garantem que operações parciais nunca corrompam o saldo.

- **Double-Entry Bookkeeping**  
  Princípio contábil onde cada crédito possui um débito correspondente, garantindo rastreabilidade total.

- **Segregação de Responsabilidades**  
Separação entre:
- **Routes** (camada de entrada da API)
- **Services** (lógica de negócio)
- **Data Layer** (persistência no banco)

- **Idempotência**  
  Garantia de que a mesma operação processada múltiplas vezes produz o mesmo resultado — padrão essencial em sistemas distribuídos.

- **Cross-Rate**  
  Derivação de taxa de câmbio entre dois ativos utilizando uma **moeda intermediária de referência** (ex: BRL ou USD).  
  Esse mecanismo permite calcular cotações entre pares que não possuem mercado direto, prática comum em **exchanges e sistemas internacionais de pagamento**.

---

## Autor

Desenvolvido por **André Sedakow** como parte do desafio técnico proposto pela **Nexus**.
