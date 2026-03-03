import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

// Configurando precisão global para o Decimal.js
Decimal.set({ precision: 36, rounding: Decimal.ROUND_HALF_DOWN });

export async function processDeposit(userId: string, token: string, amountStr: string, idempotencyKey: string) {
  const amount = new Decimal(amountStr);

  return await prisma.$transaction(async (tx) => {
    // Checa Idempotência 
    const existingWebhook = await tx.processedWebhook.findUnique({ where: { idempotencyKey } });
    if (existingWebhook) throw new Error("Webhook já processado.");

    //  Busca ou cria a carteira do usuário para o token específico
    const wallet = await tx.wallet.upsert({
      where: { userId_token: { userId, token } },
      update: {},
      create: { userId, token, balance: 0 },
    });

    const oldBalance = new Decimal(wallet.balance as any);
    const newBalance = oldBalance.plus(amount);

    //  Atualiza o saldo real
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    //  Registra a Transação e a Movimentação Rastreabilidade
    const transaction = await tx.transaction.create({
      data: { userId, type: 'DEPOSIT' },
    });

    await tx.ledgerMovement.create({
      data: {
        transactionId: transaction.id,
        type: 'DEPOSIT',
        token,
        amount: amount,
        oldBalance: oldBalance,
        newBalance: newBalance,
      },
    });

    //  Salva a chave de idempotência
    await tx.processedWebhook.create({ data: { idempotencyKey } });

    return { success: true, newBalance: newBalance.toString() };
  });
}