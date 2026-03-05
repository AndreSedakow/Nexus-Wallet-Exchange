import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { processDeposit } from '../services/ledgerService';

/**
 * Rotas de Webhook para Depósitos.
 * Gerencia as entradas de capital externo na plataforma.
 * Implementa validação rigorosa e proteção contra duplicidade via chaves de idempotência
 *  tão importante quanto funcional é a validação e proteção.
 */
export async function depositRoutes(app: FastifyInstance) {
  
  /**
   * Schema de validação para a requisição de depósito.
   * Definido fora do handler para melhor legibilidade e performance.
   */
  const depositSchema = z.object({
    userId: z.string().uuid({ message: "O ID do usuário deve ser um UUID válido." }),
    token: z.enum(['BRL', 'BTC', 'ETH'], { message: "O token informado não é suportado pela plataforma." }),
    amount: z.string().refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0, 
      "O valor do depósito deve ser uma representação numérica positiva."
    ),
    idempotencyKey: z.string().min(10, "A chave de idempotência é obrigatória para garantir a segurança da operação.")
  });

  /**
   * POST /deposit
   * Endpoint de integração para processamento de depósitos via webhook.
   */
  app.post('/deposit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      //  Validação de Schema (Garante integridade dos dados antes de iniciar a transação)
      const data = depositSchema.parse(request.body);
      
      // Execução da lógica de negócio via Service
      //  (Separa a camada de aplicação da lógica de domínio, facilitando testes e manutenção)
      const result = await processDeposit(
        data.userId, 
        data.token, 
        data.amount, 
        data.idempotencyKey
      );

      // Resposta de sucesso (200 OK)
      return reply.status(200).send(result);

    } catch (error: any) {
      // Tratamento de erros de validação (Zod)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: "Falha na validação dos dados", 
          details: error.issues.map(i => ({ path: i.path, message: i.message })) 
        });
      }

      // Tratamento de Idempotência (Caso o webhook já tenha sido processado)
      // Nota: Retornamos 200 para evitar que o serviço de origem continue disparando retries inviaveis.
      if (error.message === "Webhook já processado.") {
        return reply.status(200).send({ 
          message: "Operação já confirmada anteriormente.",
          status: "SUCCESS_IDEMPOTENT"
        });
      }

      // Log de erro interno para monitoramento e resposta ao cliente
      app.log.error(error);
      return reply.status(500).send({ error: "Erro interno ao processar a requisição de depósito." });
    }
  });
}