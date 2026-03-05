import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * Processa a conversão (SWAP) entre dois ativos.
 * @param userId - ID do usuário autenticado.
 * @param fromToken - Ativo de origem (ex: BRL).
 * @param toToken - Ativo de destino (ex: BTC).
 * @param amountStr - Quantidade bruta a ser vendida.
 * @param rateStr - Taxa de câmbio atual (Preço do ativo).
 * * @description
 * Aplica uma taxa de 1.5% sobre o montante de entrada antes da conversão.
 * Utiliza o Prisma Transaction para garantir que o débito e o crédito ocorram simultaneamente.
 */
export async function processSwap(
  userId: string, 
  fromToken: string, 
  toToken: string, 
  amountStr: string, 
  rateStr: string
) {
  const amount = new Decimal(amountStr);
  const rate = new Decimal(rateStr);
  
  // Regra de Negócio: Taxa operacional fixa de 1.5%
  const FEE_PERCENT = new Decimal('0.015'); 
  const feeAmount = amount.mul(FEE_PERCENT);
  const netAmount = amount.sub(feeAmount);
  
  // Cálculo do valor de destino baseado na taxa líquida de mercado
  const receiveAmount = netAmount.mul(rate);

  return await prisma.$transaction(async (tx) => {
    // 1. Recuperação das Carteiras
    // Nota Técnica: Em um ambiente de alta concorrência, o Prisma garante a consistência 
    // dentro da transação isolando as operações.
    const walletFrom = await tx.wallet.findUnique({ 
      where: { userId_token: { userId, token: fromToken } } 
    });
    
    const walletTo = await tx.wallet.findUnique({ 
      where: { userId_token: { userId, token: toToken } } 
    });

    // Validações de Segurança
    if (!walletFrom || new Decimal(walletFrom.balance.toString()).lt(amount)) {
      throw new Error("Saldo insuficiente para realizar a operação.");
    }

    if (!walletTo) {
      throw new Error(`Carteira de destino (${toToken}) não encontrada para este usuário.`);
    }

    //Cálculo dos Novos Saldos
    const newFromBalance = new Decimal(walletFrom.balance.toString()).sub(amount);
    const newToBalance = new Decimal(walletTo.balance.toString()).add(receiveAmount);

    // Persistência dos Saldos (Atomic Update)
    await tx.wallet.update({ 
      where: { id: walletFrom.id }, 
      data: { balance: new Prisma.Decimal(newFromBalance.toString()) } 
    });
    
    await tx.wallet.update({ 
      where: { id: walletTo.id }, 
      data: { balance: new Prisma.Decimal(newToBalance.toString()) } 
    });

    // Registro da Transação (Cabeçalho de auditoria)
    const transaction = await tx.transaction.create({
      data: { userId, type: 'SWAP' }
    });

    // Ledger (Contabilidade de partidas dobradas)
    // Registramos tanto a saída (OUT) quanto a entrada (IN) para rastreabilidade total de sistemas
    //  adotados por corretoras, bancos e Blockchains.
    await tx.ledgerMovement.createMany({
      data: [
        {
          transactionId: transaction.id,
          type: 'SWAP_OUT',
          token: fromToken,
          amount: new Prisma.Decimal(amount.negated().toString()),
          oldBalance: walletFrom.balance,
          newBalance: new Prisma.Decimal(newFromBalance.toString()),
        },
        {
          transactionId: transaction.id,
          type: 'SWAP_IN',
          token: toToken,
          amount: new Prisma.Decimal(receiveAmount.toString()),
          oldBalance: walletTo.balance,
          newBalance: new Prisma.Decimal(newToBalance.toString()),
        }
      ]
    });

    // Retorno formatado para o Frontend/API
    return {
      status: "COMPLETED",
      details: {
        sold: amount.toFixed(8),
        fee: feeAmount.toFixed(8),
        received: receiveAmount.toFixed(18),
        tokenFrom: fromToken,
        tokenTo: toToken,
        transactionId: transaction.id
      }
    };
  });
}