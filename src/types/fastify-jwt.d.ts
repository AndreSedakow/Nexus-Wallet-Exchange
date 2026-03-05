import "@fastify/jwt";

/**
 * Modulo de argumentação para o @fastify/jwt.
 * Aqui definimos o formato que o JWT carrega.
 * Isso garante o preenchimento automático IntelliSense e segurança de tipos
 * ao acessar o objeto 'request.user' nas rotas protegidas.
 */
declare module "@fastify/jwt" {
  interface FastifyJWT {
    // Payload do Token, aqui definimos os campos que estarão presentes no token JWT
    user: {
      id: string;
      // Você pode adicionar email: string caso vá usá-lo no token
    };
  }
}