import { FastifyRequest, FastifyReply } from 'fastify';
import { CardService } from './service';
import {
  CreateCardRequest,
  GetCardRequest,
  ListAccountCardsRequest,
  UpdateCardRequest,
  validateCreateCard,
  validateGetCard,
  validateListAccountCards,
  validateUpdateCard
} from './schemas';
import { JwtPayload } from '../../lib/types';
import { ValidationError } from '../../lib/errors';

const cardService = new CardService();

export async function createCard(
  request: FastifyRequest<{ Params: { accountId: string }; Body: CreateCardRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateCreateCard(request.body)) {
    throw new ValidationError('Invalid request data', validateCreateCard.errors);
  }

  const card = await cardService.createCard(request.params.accountId, user.userId, request.body);

  return reply.status(201).send({
    success: true,
    data: {
      id: card.id,
      maskedPan: card.maskedPan,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.expMonth,
      expYear: card.expYear,
      status: card.status,
      account: card.account,
      createdAt: card.createdAt,
    },
  });
}

export async function getCard(
  request: FastifyRequest<{ Params: GetCardRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateGetCard(request.params)) {
    throw new ValidationError('Invalid request parameters', validateGetCard.errors);
  }

  const card = await cardService.getCardById(request.params.id, user.userId);

  return reply.send({
    success: true,
    data: {
      id: card.id,
      maskedPan: card.maskedPan,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.expMonth,
      expYear: card.expYear,
      status: card.status,
      account: card.account,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    },
  });
}

export async function listAccountCards(
  request: FastifyRequest<{ Params: { accountId: string }; Querystring: ListAccountCardsRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateListAccountCards(request.query || {})) {
    throw new ValidationError('Invalid query parameters', validateListAccountCards.errors);
  }

  const result = await cardService.listAccountCards(
    request.params.accountId,
    user.userId,
    request.query || {}
  );

  return reply.send({
    success: true,
    data: result.cards,
    meta: {
      pagination: result.meta,
    },
  });
}

export async function updateCard(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateCardRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateUpdateCard(request.body)) {
    throw new ValidationError('Invalid request data', validateUpdateCard.errors);
  }

  const card = await cardService.updateCard(request.params.id, user.userId, request.body);

  return reply.send({
    success: true,
    data: {
      id: card.id,
      maskedPan: card.maskedPan,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.expMonth,
      expYear: card.expYear,
      status: card.status,
      account: card.account,
      updatedAt: card.updatedAt,
    },
  });
}