import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { processSwap } from '../services/swapService';

/**
 * Rotas de Operações de Câmbio (Swap).
 * Este módulo gerencia a conversão de ativos entre as carteiras do usuário.
 * Requer autenticação JWT para garantir que o usuário opere apenas em suas próprias contas.
 */
export async function swapRoutes(app: FastifyInstance) {
  
  /**
   * POST /api/swap
   * Realiza a conversão de um ativo para outro aplicando taxas operacionais da corretora como Trading Fee por exemplo.
   * Utiliza o hook 'onRequest' para validar o token JWT antes de processar a lógica.
   */
  app.post('/swap', 
    { onRequest: [app.authenticate] }, //  Barreira de segurança: Garante que request.user exista
    async (request: FastifyRequest, reply: FastifyReply) => {
      
      // Schema de validação para garantir entradas consistentes
      const swapSchema = z.object({
        fromToken: z.string().toUpperCase().min(3),
        toToken: z.string().toUpperCase().min(3),
        amount: z.string().refine(
          val => !isNaN(Number(val)) && Number(val) > 0, 
          "O valor para conversão deve ser um número positivo."
        ),
      });

      try {
        // Validação de Schema
        const { fromToken, toToken, amount } = swapSchema.parse(request.body);
        
        // Extração do ID do usuário via Token JWT 
        const userId = (request.user as any).id;

        /**
         * Lógica de Cotação (Rate Engine)
         * Nota Técnica: Em produção, este valor deve ser buscado em tempo real 
         * de um provedor de liquidez de Preços (ex: CoinGecko, Binance ou outras corretoras).
         */
        const rate = fromToken === 'BTC' ? '350000' : '0.0000028';

        //  Execução da transação no Service Layer
        const result = await processSwap(userId, fromToken, toToken, amount, rate);

        // Resposta de sucesso com detalhes da operação e auditoria
        return reply.status(200).send({
          message: "Conversão realizada com sucesso",
          timestamp: new Date().toISOString(),
          ...result
        });

      } catch (error: any) {
        // Tratamento diferenciado para erros de validação
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ 
            error: "Dados de entrada inválidos", 
            details: error.issues 
          });
        }

        // Erros de lógica de negócio (Saldo insuficiente, etc.)
        app.log.warn(`Tentativa de Swap falhou para o usuário: ${error.message}`);
        return reply.status(400).send({ error: error.message });
      }
    }
  );
}