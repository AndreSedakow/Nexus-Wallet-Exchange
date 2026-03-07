import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fjwt from '@fastify/jwt';
import { depositRoutes } from './routes/depositRoutes';
import { authRoutes } from './routes/authRoutes';
import { swapRoutes } from './routes/swapRoutes';
import { historyRoutes } from './routes/historyRoutes';

/**
 * Module Augmentação para o Fastify.
 * Estende a interface nativa para que o TypeScript reconheça o método de
 * autenticação no eco sistema.
 */
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Inicialização Fastify.
 * Habilitamos o logger nativo para rastreabilidade de requisições e erros em runtime.
 */
const app: FastifyInstance = Fastify({ logger: true });

/**
 * Configuração da estensão de JWT.
 * Responsável pela emissão e validação de tokens de acesso para rotas privadas.
 * A secret é recuperada de variáveis de ambiente para conformidade com o 12-Factor App.
 */
app.register(fjwt, {
  secret: process.env.JWT_SECRET || 'nexus-default-secret-key',
});

/**
 * Middleware Global para autenticação Autenticação.
 * Executa a verificação do Token. Caso o token seja inválido ou ausente,
 * interrompe o fluxo da requisição com status 401 de erro.
 */
app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Credenciais inválidas ou token expirado.' });
  }
});

// Registro de Rotas

/** Autenticação: registro e login */
app.register(authRoutes, { prefix: '/auth' });

/** Webhooks externos: depósitos via gateway */
app.register(depositRoutes, { prefix: '/webhooks' });

/** Operações autenticadas: swap (cotação + execução) */
app.register(swapRoutes, { prefix: '/api' });

/** Consultas autenticadas: histórico de transações + extrato do ledger */
app.register(historyRoutes, { prefix: '/api' });

// Rotas utilitárias

/**
 * GET /
 * Health check da API — útil para monitoramento e validação de deploy.
 */
app.get('/', async (_request: FastifyRequest, _reply: FastifyReply) => {
  return {
    status: 'online',
    api: 'Nexus Crypto Wallet API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  };
});

/**
 * GET /private
 * Rota de teste para validação do middleware de autenticação JWT.
 */
app.get('/private', { preHandler: [app.authenticate] }, async () => {
  return { message: 'Acesso autorizado.' };
});

// Inicialização

const start = async () => {
  try {
    const PORT = Number(process.env.PORT) || 3333;

    // O host '0.0.0.0' é essencial para o Docker e acessos externos
    await app.listen({ port: PORT, host: '0.0.0.0' });

    console.log(`🚀 Nexus Crypto API está online na porta ${PORT}`);
    console.log(`📋 Rotas disponíveis:`);
    console.log(`   POST /auth/register`);
    console.log(`   POST /auth/login`);
    console.log(`   POST /webhooks/deposit`);
    console.log(`   POST /api/swap/quote`);
    console.log(`   POST /api/swap`);
    console.log(`   GET  /api/history`);
    console.log(`   GET  /api/ledger`);
  } catch (err) {
    app.log.error('Erro fatal na inicialização: ' + err);
    process.exit(1);
  }
};

start();