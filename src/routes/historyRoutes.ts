import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getTransactionHistory, getLedgerStatement } from '../services/historyService';

/**
 * Rotas de Histórico e Extrato de Movimentações.
 *
 * Endpoints:
 *   GET /api/history          Histórico de transações (macro) com paginação
 *   GET /api/ledger           Extrato contábil do ledger (micro) com paginação e filtro por token
 *
 * Ambos exigem autenticação JWT. O userId é sempre extraído do token
 * para garantir que o usuário acesse apenas seus próprios dados.
 */
export async function historyRoutes(app: FastifyInstance) {

  /**
   * Schema de paginação reutilizado nos dois endpoints.
   * Query params: ?page=1&limit=10
   * Limita a 50 itens por página para proteger a performance do banco.
   */
  const paginationSchema = z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform(Number)
      .refine((val) => val >= 1, 'A página deve ser maior ou igual a 1.'),
    limit: z
      .string()
      .optional()
      .default('10')
      .transform(Number)
      .refine((val) => val >= 1 && val <= 50, 'O limite deve ser entre 1 e 50.'),
  });

  /**
   * GET /api/history
   * Lista todas as transações do usuário autenticado com paginação.
   * Cada transação inclui os movimentos de ledger relacionados.
   */
  app.get('/history', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['History'],
      summary: 'Histórico de transações',
      description: `Retorna todas as transações do usuário autenticado com seus movimentos detalhados.\n\n**Tipos de transação:** DEPOSIT, SWAP, WITHDRAWAL\n\nSuporta paginação via query params.`,
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: 'Número da página' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Itens por página (máx. 50)' },
        },
      },
      response: {
        200: {
          description: 'Histórico retornado com sucesso',
          type: 'object',
          properties: {
            message: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  type: { type: 'string', enum: ['DEPOSIT', 'SWAP', 'WITHDRAWAL'] },
                  status: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  movements: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        token: { type: 'string' },
                        amount: { type: 'string' },
                        oldBalance: { type: 'string' },
                        newBalance: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
        401: {
          description: 'Token JWT inválido ou ausente',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page, limit } = paginationSchema.parse(request.query);
      const userId = (request.user as any).id;
      const result = await getTransactionHistory(userId, { page, limit });
      return reply.status(200).send({
        message: 'Histórico de transações recuperado com sucesso.',
        ...result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros de paginação inválidos.',
          details: error.issues,
        });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Erro interno ao buscar o histórico.' });
    }
  });

  /**
   * GET /api/ledger
   * Retorna o extrato contábil completo ( movimentação individual).
   * Permite filtrar por token e paginar os resultados.
   *
   * @description
   * O saldo atual pode ser reconstruído somando todos os 'amount' deste extrato,
   * garantindo auditabilidade total conforme requisito do teste.
   */
  app.get('/ledger', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['History'],
      summary: 'Extrato do ledger',
      description: `Retorna o extrato contábil detalhado com oldBalance e newBalance por movimento.\n\n**Double-entry bookkeeping:** cada operação gera registros auditáveis com estado anterior e posterior.\n\nFiltre por token usando o parâmetro \`token\`.`,
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: 'Número da página' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Itens por página (máx. 50)' },
          token: { type: 'string', enum: ['BRL', 'BTC', 'ETH'], description: 'Filtrar por token (opcional)' },
        },
      },
      response: {
        200: {
          description: 'Extrato retornado com sucesso',
          type: 'object',
          properties: {
            message: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  type: { type: 'string', enum: ['DEPOSIT', 'SWAP_IN', 'SWAP_OUT', 'SWAP_FEE', 'WITHDRAWAL'] },
                  token: { type: 'string', enum: ['BRL', 'BTC', 'ETH'] },
                  amount: { type: 'string' },
                  oldBalance: { type: 'string' },
                  newBalance: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
        401: {
          description: 'Token JWT inválido ou ausente',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ledgerQuerySchema = paginationSchema.extend({
      token: z
        .enum(['BRL', 'BTC', 'ETH'], {
          errorMap: () => ({ message: "Token inválido. Use: BRL, BTC ou ETH." }),
        })
        .optional(),
    });
    try {
      const { page, limit, token } = ledgerQuerySchema.parse(request.query);
      const userId = (request.user as any).id;
      const result = await getLedgerStatement(userId, { page, limit }, token);
      return reply.status(200).send({
        message: 'Extrato de movimentações recuperado com sucesso.',
        ...(token && { filter: { token } }),
        ...result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos.',
          details: error.issues,
        });
      }
      app.log.error(error);
      return reply.status(500).send({ error: 'Erro interno ao buscar o extrato.' });
    }
  });
}