import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { processSwap } from '../services/swapService';
import { getSwapRate } from '../services/coinGeckoService';
import Decimal from 'decimal.js';

/**
 * Rotas de Operações de Câmbio (Swap).
 * Modulo que gerencia a conversão de ativos entre as carteiras do usuário.
 * Requer autenticação JWT para garantir que o usuário opere apenas em suas próprias contas.
 *
 * Endpoints:
 *  POST /api/swap/quote  → Retorna a cotação atual SEM executar a operação
 *  POST /api/swap        → Executa o swap utilizando cotação em tempo real
 */
export async function swapRoutes(app: FastifyInstance) {

  /**
   * POST /api/swap/quote
   * Retorna a cotação atual de um par de tokens sem executar nenhuma operação.
   * Requisito do teste: "Endpoint para cotar um swap (ex: quanto custa 0,5 BTC em BRL?)"
   */
  app.post('/swap/quote', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Swap'],
      summary: 'Cotação de swap',
      description: `Retorna a cotação atual para conversão entre dois ativos **sem executar nenhuma operação**.\n\n**Cotação em tempo real** via CoinGecko API.\n\n**Taxa:** 1.5% sobre o valor de origem.\n\n**Pares suportados:** BRL↔BTC, BRL↔ETH, BTC↔ETH`,
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['fromToken', 'toToken', 'amount'],
        properties: {
          fromToken: { type: 'string', enum: ['BRL', 'BTC', 'ETH'] },
          toToken: { type: 'string', enum: ['BRL', 'BTC', 'ETH'] },
          amount: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Cotação obtida com sucesso',
          type: 'object',
          properties: {
            message: { type: 'string' },
            quote: {
              type: 'object',
              properties: {
                fromToken: { type: 'string' },
                toToken: { type: 'string' },
                amountToSell: { type: 'string' },
                feeCharged: { type: 'string', description: 'Taxa de 1.5%' },
                amountToReceive: { type: 'string' },
                rateUsed: { type: 'string', description: 'Cotação em tempo real da CoinGecko' },
                feePercent: { type: 'string' },
              },
            },
            timestamp: { type: 'string' },
          },
        },
        401: {
          description: 'Token JWT inválido ou ausente',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        502: {
          description: 'Serviço de cotação indisponível',
          type: 'object',
          properties: { error: { type: 'string' }, details: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const quoteSchema = z.object({
      fromToken: z.string().toUpperCase().min(3),
      toToken: z.string().toUpperCase().min(3),
      amount: z.string().refine(
        (val) => !isNaN(Number(val)) && Number(val) > 0,
        'O valor deve ser um número positivo.'
      ),
    });

    try {
      const { fromToken, toToken, amount } = quoteSchema.parse(request.body);

      // Busca cotação real na CoinGecko
      const rateStr = await getSwapRate(fromToken, toToken);

      const amountDecimal = new Decimal(amount);
      const rate = new Decimal(rateStr);
      const FEE_PERCENT = new Decimal('0.015');

      const feeAmount = amountDecimal.mul(FEE_PERCENT);
      const netAmount = amountDecimal.sub(feeAmount);
      const receiveAmount = netAmount.mul(rate);

      return reply.status(200).send({
        message: 'Cotação obtida com sucesso (simulação — nenhuma operação foi executada)',
        quote: {
          fromToken,
          toToken,
          amountToSell: amountDecimal.toFixed(8),
          feeCharged: feeAmount.toFixed(8),          // Taxa de 1.5%
          amountToReceive: receiveAmount.toFixed(8),  // Valor líquido de destino
          rateUsed: rate.toFixed(8),                  // Cotação em tempo real da CoinGecko
          feePercent: '1.5%',
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados de entrada inválidos', details: error.issues });
      }
      // Erros da CoinGecko (rate limit, token inválido, rede, etc.)
      app.log.warn(`Falha na cotação: ${error.message}`);
      return reply.status(502).send({ error: 'Falha ao obter cotação', details: error.message });
    }
  });

  /**
   * POST /api/swap
   * Executa a conversão de um ativo para outro com cotação em tempo real.
   * A taxa de câmbio é buscada automaticamente — o cliente não precisa (nem pode) informá-la.
   */
  app.post('/swap', {
    onRequest: [app.authenticate],
    schema: {
      tags: ['Swap'],
      summary: 'Executar swap',
      description: `Executa a conversão entre dois ativos com cotação em tempo real.\n\n**Atomicidade:** débito e crédito ocorrem simultaneamente via transação ACID.\n\n**Taxa:** 1.5% deduzida automaticamente do valor de origem.\n\n**Segurança:** o rate é buscado automaticamente — o cliente não pode manipulá-lo.`,
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['fromToken', 'toToken', 'amount'],
        properties: {
          fromToken: { type: 'string', enum: ['BRL', 'BTC', 'ETH'] },
          toToken: { type: 'string', enum: ['BRL', 'BTC', 'ETH'] },
          amount: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Swap executado com sucesso',
          type: 'object',
          properties: {
            message: { type: 'string' },
            timestamp: { type: 'string' },
            rateUsed: { type: 'string', description: 'Cotação usada — registrada para auditoria' },
            status: { type: 'string' },
          },
        },
        400: {
          description: 'Saldo insuficiente ou dados inválidos',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        401: {
          description: 'Token JWT inválido ou ausente',
          type: 'object',
          properties: { error: { type: 'string' } },
        },
        502: {
          description: 'Serviço de cotação indisponível',
          type: 'object',
          properties: { error: { type: 'string' }, details: { type: 'string' } },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const swapSchema = z.object({
      fromToken: z.string().toUpperCase().min(3),
      toToken: z.string().toUpperCase().min(3),
      amount: z.string().refine(
        (val) => !isNaN(Number(val)) && Number(val) > 0,
        'O valor para conversão deve ser um número positivo.'
      ),
    });

    try {
      const { fromToken, toToken, amount } = swapSchema.parse(request.body);
      const userId = (request.user as any).id;

      // Busca cotação real ANTES de executar — garante que o rate usado
      // é o mesmo exibido ao usuário no momento da operação.
      const rateStr = await getSwapRate(fromToken, toToken);

      // Executa a transação atômica consistente com o rate real
      const result = await processSwap(userId, fromToken, toToken, amount, rateStr);

      return reply.status(200).send({
        message: 'Conversão realizada com sucesso',
        timestamp: new Date().toISOString(),
        rateUsed: new Decimal(rateStr).toFixed(8), // Registra a cotação usada para auditoria
        ...result,
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados de entrada inválidos', details: error.issues });
      }
      // Distingue erro de cotação (externo) de erro de negócio (saldo, etc.)
      if (error.message.includes('cotações') || error.message.includes('CoinGecko')) {
        app.log.error(`Falha na API de cotação durante swap: ${error.message}`);
        return reply.status(502).send({
          error: 'Serviço de cotação indisponível. Tente novamente em instantes.',
          details: error.message,
        });
      }

      app.log.warn(`Tentativa de Swap falhou para o usuário: ${error.message}`);
      return reply.status(400).send({ error: error.message });
    }
  });
}