import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fjwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { depositRoutes } from './routes/depositRoutes';
import { authRoutes } from './routes/authRoutes';
import { swapRoutes } from './routes/swapRoutes';
import { historyRoutes } from './routes/historyRoutes';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const app: FastifyInstance = Fastify({ logger: true });

/**
 * Swagger — Documentação interativa da API.
 * Acessível em /docs após a inicialização.
 */
app.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'Nexus Crypto Wallet API',
      description: `
## API REST para gerenciamento de carteiras cripto

Sistema que simula o ecossistema de uma exchange financeira com foco em:
- **Integridade de dados** via transações ACID
- **Consistência contábil** via double-entry bookkeeping
- **Rastreabilidade** via ledger auditável

### Autenticação
Use o endpoint **/auth/login** para obter um JWT e clique em **Authorize** para autenticar os endpoints protegidos.
      `,
      version: '1.0.0',
      contact: {
        name: 'André Sedakow',
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Insira o token JWT obtido no endpoint /auth/login',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Autenticação e gestão de identidade' },
      { name: 'Webhooks', description: 'Integração com gateways de pagamento externos' },
      { name: 'Swap', description: 'Cotação e execução de conversão entre ativos' },
      { name: 'History', description: 'Histórico de transações e extrato do ledger' },
    ],
  },
});

app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    persistAuthorization: true,
  },
  staticCSP: true,
});

app.register(fjwt, {
  secret: process.env.JWT_SECRET || 'nexus-default-secret-key',
});

app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Credenciais inválidas ou token expirado.' });
  }
});

// Registro de Rotas
app.register(authRoutes, { prefix: '/auth' });
app.register(depositRoutes, { prefix: '/webhooks' });
app.register(swapRoutes, { prefix: '/api' });
app.register(historyRoutes, { prefix: '/api' });

// Health check
app.get('/', {
  schema: {
    tags: ['Health'],
    summary: 'Health check',
    description: 'Verifica se a API está online',
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          api: { type: 'string' },
          version: { type: 'string' },
          timestamp: { type: 'string' },
        },
      },
    },
  },
}, async (_request: FastifyRequest, _reply: FastifyReply) => {
  return {
    status: 'online',
    api: 'Nexus Crypto Wallet API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  };
});

const start = async () => {
  try {
    const PORT = Number(process.env.PORT) || 3333;
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`   Nexus Crypto API está online na porta ${PORT}`);
    console.log(`   Rotas disponíveis:`);
    console.log(`   POST /auth/register`);
    console.log(`   POST /auth/login`);
    console.log(`   POST /webhooks/deposit`);
    console.log(`   POST /api/swap/quote`);
    console.log(`   POST /api/swap`);
    console.log(`   GET  /api/history`);
    console.log(`   GET  /api/ledger`);
    console.log(`   Documentação: http://localhost:${PORT}/docs`);
  } catch (err) {
    app.log.error('Erro fatal na inicialização: ' + err);
    process.exit(1);
  }
};

start();