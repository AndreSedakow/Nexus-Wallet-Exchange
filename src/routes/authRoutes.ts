import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/authService';

const authService = new AuthService();

/**
 * Rotas de Autenticação 
 * Ciclo de usuário: registro e geração de tokens de acesso.
 */
export async function authRoutes(app: FastifyInstance) {

  /**
   * POST /register
   * Cria um novo usuário no sistema.
   * A senha é processada via hash (Bcrypt) 
   */
  app.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Cadastro de usuário',
      description: 'Cria um novo usuário e inicializa carteiras com saldo zero para BRL, BTC e ETH. A senha é armazenada com hash Bcrypt.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
      response: {
        201: {
          description: 'Usuário criado com sucesso',
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: {
          description: 'Dados inválidos',
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array' },
          },
        },
        409: {
          description: 'E-mail já cadastrado',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const registerSchema = z.object({
      email: z.string().email({ message: "Formato de e-mail inválido." }),
      password: z.string().min(6, { message: "A senha deve ter no mínimo 6 caracteres." }),
    });

    try {
      const { email, password } = registerSchema.parse(request.body);
      const user = await authService.register(email, password);

      // Retornamos apenas dados não sensíveis
      return reply.status(201).send({
        id: user.id,
        email: user.email,
        message: "Usuário criado com sucesso."
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: "Dados inválidos", details: error.issues });
      }

      // Tratamento específico para e-mails já cadastrados (Unique constraint do Prisma)
      if (error.message.includes("Usuário já existe")) {
        return reply.status(409).send({ error: "Este e-mail já está em uso." });
      }

      app.log.error(error);
      return reply.status(500).send({ error: "Erro interno ao processar o registro." });
    }
  });

  /**
   * POST /login
   * Valida credenciais e emite um token JWT para acesso às rotas 
   */
  app.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login',
      description: 'Autentica o usuário e retorna um JWT. Copie o token e clique em **Authorize** (canto superior direito) para acessar os endpoints protegidos.',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          description: 'Login realizado com sucesso',
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT para autenticação — validade de 7 dias' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
              },
            },
          },
        },
        401: {
          description: 'Credenciais inválidas',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string(),
    });

    try {
      const { email, password } = loginSchema.parse(request.body);
      const user = await authService.validateUser(email, password);

      if (!user) {
        return reply.status(401).send({ error: "Credenciais inválidas." });
      }

      /**
       * Geração de Token JWT
       * O payload contém o ID do usuário para identificação segura no middleware de autenticação.
       * Expiração configurado para 7 dias.
       */
      const token = app.jwt.sign(
        { id: user.id },
        { expiresIn: '7d' }
      );

      return {
        token,
        user: { id: user.id, email: user.email }
      };

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: "Formato de dados inválido." });
      }

      app.log.error(error);
      return reply.status(500).send({ error: "Erro interno durante a autenticação." });
    }
  });
}