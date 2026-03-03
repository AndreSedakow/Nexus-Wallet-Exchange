# Nexus Crypto Wallet API

## API REST de uma carteira cripto simplificada desenvolvida como parte do Teste Prático – Desenvolvedor Backend | Nexus.
O projeto simula o funcionamento de uma carteira digital com suporte a múltiplos tokens, autenticação JWT, ledger auditável e operações de depósito, swap e saque.

## Stack Utilizada 

-**Node.js + TypeScript**: stack principal para segurança de tipos
-**PostgreSQL**: banco de dados
-**Prisma ORM**: para manipulação da postgreSQL
-**Decimal.Js**: garantir a precisão das 18 casas decimais em ETH 
-**JWT** (Access Token + Refresh Token)

## Estrutura do Banco de Dados
- **Users**: Cadastro e autenticação[cite: 18].
- **Wallets**: Armazena saldos de BRL, BTC e ETH[cite: 24].
- **Transactions**: Registro de alto nível (DEPOSIT, SWAP, WITHDRAWAL)[cite: 46, 52].
- **LedgerMovements**: Onde a mágica acontece. [cite_start]Registra valor, saldo anterior e novo para cada movimentação[cite: 54, 56].

## Autenticação Segura

Permite cadastro e login de usuários com geração de JWT (access e refresh token), garantindo proteção das rotas e controle de acesso.
Cada usuário possui uma carteira com suporte a:
-**BRL**
-**BTC**
-**ETH**
Os saldos são armazenados e controlados via banco de dados com rastreabilidade completa.

## Depósitos via Webhook

-Simula integração com serviços de cambios externos (como gateways ou banco) através de:
-Endpoint de notificação de depósito
-Controle de idempotência para evitar duplicações de depositos ou saques
-Atualização automática de saldo

 ## Swap 

**Permite:**
-Cotação em tempo real via API externa
-Aplicação de taxa de 1.5%
-Conversão entre tokens
-Validação de saldo
-Registro detalhado da operação

## Saque

-Usuário pode solicitar retirada de fundos:
-Validação de saldo
-Débito do valor
-Registro da movimentação
-Simulação de transferência externa

## Ledger Auditável

Todas as operações geram registros detalhados de movimentação:
-Saldo anterior
-Valor da operação
-Novo saldo
-Tipo da transação

## Histórico de Transações

**Sistema registra todas as operações realizadas pelo usuário:**
-Depósitos
-Swaps
-Saques
-Taxas

## O sistema aplica conceitos reais utilizados em exchanges e fintechs:

-Controle transacional
-Auditoria financeira
-Integração com APIs externas
-Segurança via JWT
-Prevenção de inconsistências
-Modelagem financeira baseada em ledger

## Como Executar
1. Instale as dependências: `npm install`
2. Suba o banco com Docker: `docker-compose up -d`
3. Configure o `.env` com sua `DATABASE_URL`.
4. Rode as migrações: `npx prisma db push`
5. Inicie o servidor: `npm run dev`