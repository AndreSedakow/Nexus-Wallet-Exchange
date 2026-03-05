import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fjwt from '@fastify/jwt';
import { depositRoutes } from './routes/depositRoutes';

/**
 * Module Augmentation para o Fastify.
 * Estende a interface nativa para que o TypeScript reconheça o método de 
 * autenticação customizado em todo o ecossistema.
 */
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Inicialização do Servidor Fastify.
 * Habilitamos o logger nativo para rastreabilidade de requisições e erros em runtime.
 */
const app: FastifyInstance = Fastify({ logger: true });

/**
 * Configuração do Plugin JWT.
 * Responsável pela emissão e validação de tokens de acesso para rotas privadas.
 * A secret é recuperada de variáveis de ambiente para conformidade com o 12-Factor App.
 */
app.register(fjwt, { 
  secret: process.env.JWT_SECRET || 'nexus-default-secret-key' 
});

/**
 * Middleware Global de Autenticação (Decorator).
 * Executa a verificação do Token. Caso o token seja inválido ou ausente,
 * interrompe o fluxo da requisição com status 401 de erro.
 */
app.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: "Credenciais inválidas ou token expirado." });
  }
});

/**
 * Registro de Rotas.
 * Utilizamos o prefixo '/webhooks' para isolar endpoints de integração externa.
 */
app.register(depositRoutes, { prefix: '/webhooks' });
/**
 * Rota raiz para health check da API.
 * Útil para monitoramento, testes rápidos e validação de deploy.
 */
app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
  return { status: 'Nexus Crypto API' };
});

app.get('/private', { preHandler: [app.authenticate] }, async () => {
  return { message: 'Acesso autorizado ' };
});
/**
 * Inicialização do processo do servidor.
 * Configurado para ouvir em porta definida pelo ambiente ou 3333 como padrão.
 */
const start = async () => {
  try {
    const PORT = Number(process.env.PORT) || 3333;
    
    // O host '0.0.0.0' é essencial para o Docker e acessos externos
    await app.listen({ port: PORT, host: '0.0.0.0' });
    
    console.log(`🚀 Nexus Crypto API está online na porta ${PORT}`);
  } catch (err) {
    app.log.error('Erro fatal na inicialização: ' + err);
    process.exit(1);
  }
};
start();