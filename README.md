# Nexus Crypto Wallet API

## API REST de alta performance para gerenciamento de carteiras cripto, desenvolvida como parte do Teste Prático – Desenvolvedor Backend na Nexus. O sistema simula o ecossistema de uma exchange, com foco total em integridade financeira e rastreabilidade.

## Engenharia de back com base em instituições financeiras
Diferente de uma carteira simples, este projeto aplica conceitos de sistemas bancários reais:
-Precisão de 18 Casas Decimais: Uso da biblioteca Decimal.js e tipo @db.Decimal(36, 18) no banco de dados para suportar o padrão de tokens como Ethereum, evitando erros de arredondamento de ponto flutuante.

-Arquitetura de Ledger (Livro-Razão): Toda alteração de saldo gera um LedgerMovement atômico. Não apenas alteramos o saldo, mas registramos o oldBalance e newBalance para fins de auditoria completa.

-Idempotência Garantida: Webhooks de depósito utilizam chaves de idempotência únicas, prevenindo o processamento duplicado de uma mesma ordem em caso de instabilidade na rede.

-Transações Atômicas (ACID): Operações de Swap garantem que o débito de um ativo e o crédito de outro ocorram simultaneamente através do $transaction do Prisma de forma consistente.

## Stack Utilizada 

-**Node.js + TypeScript**: stack principal para segurança de tipos
-**Framework: Fastify** (Escolhido pela baixa latência e performance execelente ferramenta)
-**PostgreSQL**: banco de dados
-**Prisma ORM**
-**Decimal.Js**: garantir a precisão das 18 casas decimais em ETH 
-**JWT** (Access Token + Refresh Token) + Bcrypt para Hashing

## Estrutura do Banco de Dados
- **Users**: Credenciais e perfil do usuário.
- **Wallets**: Saldo segregado por token (BRL, BTC, ETH).
- **Transactions**: Cabeçalho das operações.
- **LedgerMovements**: Detalhamento de cada entrada e saída de valores.
- **ProcessedWebhook**: Registro de chaves de idempotência já processadas.

## Funcionalidades Principais
**Autenticação e Segurança**
**JWT Ecosystem:** Implementação de Access e Refresh Tokens para sessões seguras.

**Proteção de Rotas:** Middleware de autenticação que impede acessos não autorizados a dados sensíveis.

**Multi-Currency:** Suporte nativo para BRL, BTC e ETH com carteiras isoladas por usuário.

## Gestão de Fluxo de Caixa
**Depósitos via Webhook:** Integração simulada com gateways de pagamento externos.

**Idempotência Nativa:** Proteção contra o "double-spending" e reprocessamento de notificações externas.

**Saques Automáticos:** Fluxo de retirada com validação de saldo em tempo real e simulação de transferência externa.

## Motor de Swap (Conversão)
**Cotação Dinâmica:** Sistema preparado para integração com APIs de preço.

**Taxa Operacional:** Aplicação automática de taxa de 1.5% sobre as conversões.

**Validação de Liquidez:** Verificação rigorosa de saldo antes da execução de qualquer troca entre ativos.

## Integridade e Auditoria
**Ledger Auditável (Livro-Razão)**
O sistema não apenas atualiza o saldo; ele documenta a história de cada centavo. Cada operação gera um registro no Ledger contendo:

**Estado Anterior:** O saldo antes da operação.

**Delta:** O valor exato que foi movimentado.

**Novo Estado:** O saldo resultante, garantindo que a soma dos movimentos sempre bata com o saldo atual.

## Histórico de Transações
**Registro centralizado de todos os eventos financeiros do usuário:**

Histórico de Depósitos, Swaps e Saques.

Detalhamento de taxas cobradas por operação.

Rastreabilidade de cada movimento através de IDs de transação únicos.

## Conceitos de Fintech Aplicados
**Este projeto não é apenas um CRUD. Ele aplica padrões utilizados por gigantes do setor (Exchanges e Bancos Digitais):**

**Atomicidade:** Uso de transações SQL para evitar saldos inconsistentes.

**Double-Entry Bookkeeping:** Princípio contábil onde cada crédito tem um débito correspondente.

**Segregação de Responsabilidades:** Separação clara entre a rota (entrada), o service (lógica) e o banco (persistência).

## Autenticação
**POST /auth/register:** Criação de novo usuário.
**POST /auth/login:** Autenticação e emissão de JWT.

## Operações
**POST /webhooks/deposit:** Recebimento de depósitos (Requer Idempotency Key).
**POST /api/swap:** Conversão entre ativos (Ex: BRL -> BTC) com taxa de 1.5%.
**GET /api/history:** Extrato completo com rastro de auditoria.

# Como Executar
## 1. Clonar o repositório:
**git clone https://github.com/seu-usuario/nexus-crypto-wallet.git**

## 2.Configurar Ambiente:
**Crie um arquivo .env na raiz seguindo o modelo:**
**DATABASE_URL="postgresql://user:password@localhost:5432/nexus_db" JWT_SECRET="sua_chave_secreta_aqui"**
**"A API iniciará por padrão na porta 3333. Você pode acessá-la em http://localhost:3333."**

## 3. Subir Infraestrutura (Docker):
**docker-compose up -d**

## 4. Instalar e Rodar:
**npm install**
**npx prisma db push**
**npm run dev**

## Autor
**Desenvolvido por André Sedakow como parte do desafio técnico proposto pela Nexus.**