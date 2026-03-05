import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * Configuração de precisão arbitrária para operações financeiras.
 * 36 dígitos de precisão garantem suporte a tokens com 18 casas decimais (padrão ETH/ERC-20)
 * sem erros de arredondamento comuns em tipos flutuantes do JavaScript que prova na pratica inconsistencia de dados precisos.
 */
Decimal.set({ precision: 36, rounding: Decimal.ROUND_HALF_DOWN });

/**
 * Processa um depósito de forma atômica e idempotente.
 * * @param userId - Identificador único do usuário.
 * @param token - Símbolo do ativo (ex: BRL, BTC).
 * @param amountStr - Valor em string para preservar precisão decimal.
 * @param idempotencyKey - Chave única fornecida pelo provedor do depósito.
 * * @description
 * O fluxo segue o padrão ACID:
 * 1. Verifica duplicidade (Idempotência).
 * 2. Garante existência da carteira (Upsert).
 * 3. Atualiza saldo e gera rastro de auditoria (Ledger) em transação única.
 */
export async function processDeposit(userId: string, token: string, amountStr: string, idempotencyKey: string) {
  const amount = new Decimal(amountStr);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    
    // Verificação de Idempotência
    // Previne que o mesmo webhook seja processado mais de uma vez em caso de retries.
    const existingWebhook = await tx.processedWebhook.findUnique({ 
      where: { idempotencyKey } 
    });
    
    if (existingWebhook) {
      throw new Error("Webhook já processado.");
    }

    //  Recuperação/Criação da Carteira
    // O uso de 'upsert' evita erros caso a carteira ainda não tenha sido inicializada.
    const wallet = await tx.wallet.upsert({
      where: { userId_token: { userId, token } },
      update: {},
      create: { userId, token, balance: 0 },
    });

    const oldBalance = new Decimal(wallet.balance.toString());
    const newBalance = oldBalance.plus(amount);

    // Atualização de Saldo
    // Persistimos o novo estado financeiro do usuário para controle.
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: new Prisma.Decimal(newBalance.toString()) },
    });

    // Registro da Transação 
    const transaction = await tx.transaction.create({
      data: { userId, type: 'DEPOSIT' },
    });

    // Registro no Ledger (Rastreabilidade)
    // Essencial para auditoria: guardamos o delta (amount) e o estado anterior/posterior.
    await tx.ledgerMovement.create({
      data: {
        transactionId: transaction.id,
        type: 'DEPOSIT',
        token,
        amount: new Prisma.Decimal(amount.toString()),
        oldBalance: wallet.balance,
        newBalance: new Prisma.Decimal(newBalance.toString()),
      },
    });

    // Persistência da Chave de Idempotência
    // Concluímos marcando esta chave como utilizada dentro da mesma transação evitando qualquer tipo de duplicidade.
    await tx.processedWebhook.create({ 
      data: { idempotencyKey } 
    });

    return { 
      success: true, 
      newBalance: newBalance.toString(),
      transactionId: transaction.id 
    };
  });
}