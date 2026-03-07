import { prisma } from '../lib/prisma';

/**
 * Parâmetros de paginação compartilhados entre os dois endpoints.
 */
interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Busca o histórico de transações do usuário.
 * Retorna as transações com seus respectivos movimentos de ledger.
 *
 * @param userId  - ID do usuário autenticado (extraído do JWT).
 * @param page    - Página atual (começa em 1).
 * @param limit   - Quantidade de itens por página (máx. 50).
 *
 * @description
 * Cada Transaction representa o "cabeçalho" de uma operação (DEPOSIT, SWAP, WITHDRAWAL).
 * Os LedgerMovements são os detalhes contábeis de cada operação.
 * Essa separação segue o padrão de sistemas bancários e exchange.
 */
export async function getTransactionHistory(userId: string, { page, limit }: PaginationParams) {
  const skip = (page - 1) * limit;

  // Executa as duas queries em paralelo para melhor performance
  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        // Inclui os movimentos para que o cliente possa ver tokens e valores envolvidos
        movements: {
          select: {
            type: true,
            token: true,
            amount: true,
            oldBalance: true,
            newBalance: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.transaction.count({ where: { userId } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: transactions.map((tx) => ({
      transactionId: tx.id,
      type: tx.type,
      status: tx.status,
      createdAt: tx.createdAt,
      // Extrai tokens envolvidos e taxa de movimentação a partir dos cambios de ledger
      tokens: [...new Set(tx.movements.map((m) => m.token))],
      fee: extractFee(tx.movements),
      movements: tx.movements.map((m) => ({
        ...m,
        amount: m.amount.toString(),
        oldBalance: m.oldBalance.toString(),
        newBalance: m.newBalance.toString(),
      })),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Busca o extrato de movimentações do ledger (nível micro/contábil).
 * Retorna cada entrada e saída individual com rastreabilidade completa.
 *
 * @param userId  - ID do usuário autenticado.
 * @param page    - Página atual (começa em 1).
 * @param limit   - Quantidade de itens por página (máx. 50).
 * @param token   - Filtro opcional por token (ex: 'BTC').
 *
 * @description
 * Este endpoint permite reconstruir o saldo atual a partir do histórico,
 * garantindo auditabilidade total — requisito explícito do teste.
 */
export async function getLedgerStatement(
  userId: string,
  { page, limit }: PaginationParams,
  token?: string
) {
  const skip = (page - 1) * limit;

  // Filtro dinâmico: inclui token apenas se informado
  const tokenFilter = token ? { token } : {};

  const [movements, total] = await Promise.all([
    prisma.ledgerMovement.findMany({
      where: {
        transaction: { userId }, // Garante que só retorna movimentos do próprio usuário
        ...tokenFilter,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        transaction: {
          select: {
            type: true,
            status: true,
          },
        },
      },
    }),
    prisma.ledgerMovement.count({
      where: {
        transaction: { userId },
        ...tokenFilter,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: movements.map((m) => ({
      movementId: m.id,
      transactionId: m.transactionId,
      transactionType: m.transaction.type,   // DEPOSIT | SWAP | WITHDRAWAL
      transactionStatus: m.transaction.status,
      movementType: m.type,                  // DEPOSIT | SWAP_IN | SWAP_OUT | SWAP_FEE | WITHDRAWAL
      token: m.token,
      amount: m.amount.toString(),
      oldBalance: m.oldBalance.toString(),
      newBalance: m.newBalance.toString(),
      createdAt: m.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Extrai a taxa cobrada de uma lista de movimentos.
 * Retorna null se a operação não gerou taxa (ex: depósitos).
 */
function extractFee(movements: Array<{ type: string; amount: any; token: string }>) {
  const feeMovement = movements.find((m) => m.type === 'SWAP_FEE');
  if (!feeMovement) return null;

  return {
    token: feeMovement.token,
    amount: feeMovement.amount.toString(),
  };
}