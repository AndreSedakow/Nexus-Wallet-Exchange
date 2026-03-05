import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Permite que o TypeScript reconheça decoradores personalizados como 'authenticate'.
 */
declare module 'fastify' {
  interface FastifyInstance {
    // Adiciona o método authenticate que criamos no server.ts
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}