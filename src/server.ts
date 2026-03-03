import Fastify from 'fastify';
import fjwt from '@fastify/jwt';
import { z } from 'zod';
import { processDeposit } from './services/ledgerService';

// declare module augmentation so TS knows about the decorated method
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const app = Fastify({ logger: true });

app.register(fjwt, { secret: process.env.JWT_SECRET || 'super-secret-key' });

// Middleware de proteção de rotas
app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: "Não autorizado" });
  }
});

// Endpoint: Webhook de Depósito
const depositSchema = z.object({
  userId: z.string().uuid(),
  token: z.string().min(3),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Valor inválido"),
  idempotencyKey: z.string()
});

app.post('/webhooks/deposit', async (request, reply) => {
  try {
    // Validação com Zod
    const data = depositSchema.parse(request.body);
    
    // Processamento seguro no Ledger
    const result = await processDeposit(data.userId, data.token, data.amount, data.idempotencyKey);
    return reply.status(200).send(result);
  } catch (error: any) {
    if (error.message === "Webhook já processado.") {
      return reply.status(200).send({ message: "Ignorado: depósito duplicado evitado." });
    }
    return reply.status(400).send({ error: error.message });
  }
});

// Endpoint protegido de exemplo (Consultar Saldo)
app.get('/wallet/balances', { preValidation: [app.authenticate] }, async (request: any, reply) => {
  // Lógica de buscar saldo do usuário autenticado (request.user.id)
  reply.send({ message: "Saldos retornados com sucesso." });
});

app.listen({ port: 3000 }, (err) => {
  if (err) throw err;
  console.log('Server rodando na porta 3000 ');
});