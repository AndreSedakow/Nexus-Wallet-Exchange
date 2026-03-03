import { FastifyInstance } from 'fastify';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    return { message: "Rota de registro funcionando!" };
  });
}
