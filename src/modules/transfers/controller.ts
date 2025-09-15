import { FastifyRequest, FastifyReply } from 'fastify';
import { TransferService } from './service';
import {
  CreateTransferRequest,
  GetTransferRequest,
  ListTransfersRequest,
  CancelTransferRequest,
  validateCreateTransfer,
  validateGetTransfer,
  validateListTransfers,
  validateCancelTransfer
} from './schemas';
import { JwtPayload } from '../../lib/types';
import { ValidationError } from '../../lib/errors';

const transferService = new TransferService();

export async function createTransfer(
  request: FastifyRequest<{ Body: CreateTransferRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateCreateTransfer(request.body)) {
    throw new ValidationError('Invalid request data', validateCreateTransfer.errors);
  }

  const idempotencyKey = request.headers['idempotency-key'] as string;
  const transfer = await transferService.createTransfer(user.userId, request.body, idempotencyKey);

  return reply.status(201).send({
    success: true,
    data: {
      id: transfer.id,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: transfer.amount.toString(),
      currency: transfer.currency,
      description: transfer.description,
      status: transfer.status,
      createdAt: transfer.createdAt,
    },
  });
}

export async function getTransfer(
  request: FastifyRequest<{ Params: GetTransferRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateGetTransfer(request.params)) {
    throw new ValidationError('Invalid request parameters', validateGetTransfer.errors);
  }

  const transfer = await transferService.getTransferById(request.params.id, user.userId);

  return reply.send({
    success: true,
    data: {
      id: transfer.id,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: transfer.amount.toString(),
      currency: transfer.currency,
      description: transfer.description,
      status: transfer.status,
      createdAt: transfer.createdAt,
      updatedAt: transfer.updatedAt,
    },
  });
}

export async function listTransfers(
  request: FastifyRequest<{ Querystring: ListTransfersRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateListTransfers(request.query || {})) {
    throw new ValidationError('Invalid query parameters', validateListTransfers.errors);
  }

  const result = await transferService.listTransfers(user.userId, request.query || {});

  return reply.send({
    success: true,
    data: result.transfers.map(transfer => ({
      id: transfer.id,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: transfer.amount.toString(),
      currency: transfer.currency,
      description: transfer.description,
      status: transfer.status,
      direction: transfer.fromAccount?.ownerId === user.userId ? 'outgoing' : 'incoming',
      fromAccount: transfer.fromAccount,
      toAccount: transfer.toAccount,
      createdAt: transfer.createdAt,
    })),
    meta: {
      pagination: result.meta,
    },
  });
}

export async function cancelTransfer(
  request: FastifyRequest<{ Params: CancelTransferRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateCancelTransfer(request.params)) {
    throw new ValidationError('Invalid request parameters', validateCancelTransfer.errors);
  }

  const transfer = await transferService.cancelTransfer(request.params.id, user.userId);

  return reply.send({
    success: true,
    data: {
      id: transfer.id,
      status: transfer.status,
      cancelledAt: transfer.updatedAt,
    },
  });
}