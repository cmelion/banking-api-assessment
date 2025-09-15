import { FastifyRequest, FastifyReply } from 'fastify';
import { TransactionService } from './service';
import {
  GetTransactionRequest,
  ListAccountTransactionsRequest,
  GetAccountTransactionSummaryRequest,
  validateGetTransaction,
  validateListAccountTransactions,
  validateGetAccountTransactionSummary
} from './schemas';
import { JwtPayload } from '../../lib/types';
import { ValidationError } from '../../lib/errors';

const transactionService = new TransactionService();

export async function getTransaction(
  request: FastifyRequest<{ Params: GetTransactionRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateGetTransaction(request.params)) {
    throw new ValidationError('Invalid request parameters', validateGetTransaction.errors);
  }

  const transaction = await transactionService.getTransactionById(request.params.id, user.userId);

  return reply.send({
    success: true,
    data: {
      id: transaction.id,
      accountId: transaction.accountId,
      type: transaction.type,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      description: transaction.description,
      counterparty: transaction.counterparty,
      balanceAfter: transaction.balanceAfter.toString(),
      createdAt: transaction.createdAt,
      account: transaction.account,
      transfer: transaction.transfer,
    },
  });
}

export async function getAccountTransactions(
  request: FastifyRequest<{ Params: { accountId: string }; Querystring: ListAccountTransactionsRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateListAccountTransactions(request.query || {})) {
    throw new ValidationError('Invalid query parameters', validateListAccountTransactions.errors);
  }

  const result = await transactionService.getAccountTransactions(
    request.params.accountId,
    user.userId,
    request.query || {}
  );

  return reply.send({
    success: true,
    data: result.transactions.map(transaction => ({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      description: transaction.description,
      counterparty: transaction.counterparty,
      balanceAfter: transaction.balanceAfter.toString(),
      createdAt: transaction.createdAt,
      transfer: transaction.transfer,
    })),
    meta: {
      pagination: result.meta,
    },
  });
}

export async function getAccountTransactionSummary(
  request: FastifyRequest<{ Params: { accountId: string }; Querystring: GetAccountTransactionSummaryRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateGetAccountTransactionSummary(request.query || {})) {
    throw new ValidationError('Invalid query parameters', validateGetAccountTransactionSummary.errors);
  }

  const summary = await transactionService.getAccountTransactionSummary(
    request.params.accountId,
    user.userId,
    request.query || {}
  );

  return reply.send({
    success: true,
    data: summary,
  });
}