import { FastifyRequest, FastifyReply } from 'fastify';
import { AccountService } from './service';
import { CreateAccountRequest, GetAccountRequest, ListAccountsRequest, UpdateAccountRequest, validateCreateAccount } from './schemas';
import { JwtPayload } from '../../lib/types';
import { ValidationError } from '../../lib/errors';

const accountService = new AccountService();

export async function createAccount(
  request: FastifyRequest<{ Body: CreateAccountRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateCreateAccount(request.body)) {
    throw new ValidationError('Invalid request data', validateCreateAccount.errors);
  }

  const account = await accountService.createAccount(user.userId, request.body);

  return reply.status(201).send({
    success: true,
    data: {
      id: account.id,
      accountNumber: account.accountNumber,
      type: account.type,
      currency: account.currency,
      balance: account.balance.toString(),
      status: account.status,
      createdAt: account.createdAt,
    },
  });
}

export async function getAccount(
  request: FastifyRequest<{ Params: GetAccountRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;
  const account = await accountService.getAccountById(request.params.id, user.userId);

  return reply.send({
    success: true,
    data: {
      id: account.id,
      accountNumber: account.accountNumber,
      type: account.type,
      currency: account.currency,
      balance: account.balance.toString(),
      status: account.status,
      owner: account.owner,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    },
  });
}

export async function listAccounts(
  request: FastifyRequest<{ Querystring: ListAccountsRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;
  const result = await accountService.listAccountsByUser(user.userId, request.query);

  return reply.send({
    success: true,
    data: result.accounts.map(account => ({
      id: account.id,
      accountNumber: account.accountNumber,
      type: account.type,
      currency: account.currency,
      balance: account.balance.toString(),
      status: account.status,
      transactionCount: account._count.transactions,
      cardCount: account._count.cards,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    })),
    meta: {
      pagination: result.meta,
    },
  });
}

export async function updateAccount(
  request: FastifyRequest<{ Params: { id: string }; Body: Omit<UpdateAccountRequest, 'id'> }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;
  const updateData = { ...request.body, id: request.params.id };
  const account = await accountService.updateAccount(request.params.id, user.userId, updateData);

  return reply.send({
    success: true,
    data: {
      id: account.id,
      accountNumber: account.accountNumber,
      type: account.type,
      currency: account.currency,
      balance: account.balance.toString(),
      status: account.status,
      updatedAt: account.updatedAt,
    },
  });
}

export async function getAccountBalance(
  request: FastifyRequest<{ Params: GetAccountRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;
  const balance = await accountService.getAccountBalance(request.params.id, user.userId);

  return reply.send({
    success: true,
    data: {
      accountId: balance.accountId,
      balance: balance.balance.toString(),
      currency: balance.currency,
      status: balance.status,
    },
  });
}