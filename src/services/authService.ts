import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

/**
 * Serviço de Autenticação e Gestão de Usuários.
 * Responsável pela segurança das credenciais e inicialização do ecossistema do cliente.
 */
export class AuthService {
  /**
   * Registra um novo usuário e inicializa suas carteiras padrão.
   * @param email - Identificador único do usuário.
   * @param passwordUnsafe - Senha em texto plano (criptografada).
   * @description
   * Utiliza Bcrypt com Salt de 10 rounds para hashing de senha.
   * Executa a criação do usuário e das carteiras (BRL, BTC, ETH) de forma atômica.
   */
  async register(email: string, passwordUnsafe: string) {
    // Criptografia de Senha 
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(passwordUnsafe, saltRounds);

    // Transação Atômica: Criação de Usuário + Carteiras Iniciais
    // Isso garante a integridade referencial: usuário sempre terá suas carteiras.
    return await prisma.$transaction(async (tx) => {
      // Verifica se o usuário já existe para lançar um erro adequado
      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new Error("Usuário já existe com este e-mail.");
      }

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
        }
      });

      // Inicialização de portfólio Requisitos
      const tokens = ['BRL', 'BTC', 'ETH'];
      await tx.wallet.createMany({
        data: tokens.map(token => ({
          userId: user.id,
          token,
          balance: 0
        }))
      });

      return user;
    });
  }

  /**
   * Valida as credenciais de acesso do usuário.
   * @returns O usuário autenticado ou null se as credenciais forem inválidas.
   */
  async validateUser(email: string, passwordUnsafe: string) {
    // Busca o usuário pelo e-mail único
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) return null;

    // Comparação segura de Hash (Proteção contra ataques)
    const isPasswordValid = await bcrypt.compare(passwordUnsafe, user.passwordHash);
    
    if (!isPasswordValid) return null;

    return user;
  }
}