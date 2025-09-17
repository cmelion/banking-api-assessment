import { FastifyRequest, FastifyReply } from 'fastify';
import { StatementService } from './service';
import {
  GenerateStatementRequest,
  GetStatementRequest,
  ListAccountStatementsRequest,
  validateGenerateStatement,
  validateGetStatement,
  validateListAccountStatements
} from './schemas';
import { JwtPayload } from '../../lib/types';
import { ValidationError } from '../../lib/errors';

const statementService = new StatementService();

export async function generateStatement(
  request: FastifyRequest<{ Params: { accountId: string }; Body: GenerateStatementRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateGenerateStatement(request.body)) {
    throw new ValidationError('Invalid request data', validateGenerateStatement.errors);
  }

  const statement = await statementService.generateStatement(
    request.params.accountId,
    user.userId,
    request.body
  );

  return reply.status(201).send({
    success: true,
    data: {
      id: statement.id,
      periodStart: statement.periodStart?.toISOString(),
      periodEnd: statement.periodEnd?.toISOString(),
      fileUrl: statement.fileUrl,
      createdAt: statement.createdAt?.toISOString(),
    },
  });
}

export async function getStatement(
  request: FastifyRequest<{ Params: GetStatementRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateGetStatement(request.params)) {
    throw new ValidationError('Invalid request parameters', validateGetStatement.errors);
  }

  const statement = await statementService.getStatementById(request.params.id, user.userId);

  return reply.send({
    success: true,
    data: {
      id: statement.id,
      periodStart: statement.periodStart?.toISOString(),
      periodEnd: statement.periodEnd?.toISOString(),
      fileUrl: statement.fileUrl,
      account: statement.account,
      createdAt: statement.createdAt?.toISOString(),
    },
  });
}

export async function listAccountStatements(
  request: FastifyRequest<{ Params: { accountId: string }; Querystring: ListAccountStatementsRequest }>,
  reply: FastifyReply
) {
  const user = request.user as JwtPayload;

  if (!validateListAccountStatements(request.query || {})) {
    throw new ValidationError('Invalid query parameters', validateListAccountStatements.errors);
  }

  const result = await statementService.listAccountStatements(
    request.params.accountId,
    user.userId,
    request.query || {}
  );

  return reply.send({
    success: true,
    data: result.statements,
    meta: {
      pagination: result.meta,
    },
  });
}