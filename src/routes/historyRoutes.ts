import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getTransactionHistory, getLedgerStatement } from '../services/historyService';

/**
 * Rotas de Histórico e Extrato de Movimentações.
 *
 * Endpoints:
 *   GET /api/history          → Histórico de transações (macro) com paginação
 *   GET /api/ledger           → Extrato contábil do ledger (micro) com paginação e filtro por token
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
   *
   * Query params:
   *   page  (opcional, default: 1)
   *   limit (opcional, default: 10, máx: 50)
   *
   * Retorna: tipo, status, tokens envolvidos, taxa (se houver) e movimentos detalhados.
   */
  app.get(
    '/history',
    { onRequest: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    }
  );

  /**
   * GET /api/ledger
   * Retorna o extrato contábil completo (nível de movimentação individual).
   * Permite filtrar por token e paginar os resultados.
   *
   * Query params:
   *   page  (opcional, default: 1)
   *   limit (opcional, default: 10, máx: 50)
   *   token (opcional — ex: ?token=BTC)
   *
   * @description
   * O saldo atual pode ser reconstruído somando todos os 'amount' deste extrato,
   * garantindo auditabilidade total conforme requisito do teste.
   */
  app.get(
    '/ledger',
    { onRequest: [app.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {

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
          ...(token && { filter: { token } }), // Indica o filtro ativo na resposta, se houver
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
    }
  );
}