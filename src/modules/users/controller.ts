import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './service';
import { updateUserSchema, userParamsSchema, paginationQuerySchema, UpdateUserRequest, UserParams, PaginationQuery } from './schemas';
import { ApiResponse, JwtPayload } from '../../lib/types';
import { ValidationError } from '../../lib/errors';

const userService = new UserService();

export class UserController {
  async getCurrentUser(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as JwtPayload;
    const result = await userService.getCurrentUser(user.userId);

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    return response;
  }

  async updateCurrentUser(
    request: FastifyRequest<{ Body: UpdateUserRequest }>,
    reply: FastifyReply
  ) {
    // Validate request body
    const validation = updateUserSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const user = request.user as JwtPayload;
    const result = await userService.updateUser(user.userId, validation.data);

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    return response;
  }

  async getAllUsers(
    request: FastifyRequest<{ Querystring: PaginationQuery }>,
    reply: FastifyReply
  ) {
    // Validate query parameters
    const validation = paginationQuerySchema.safeParse(request.query);
    if (!validation.success) {
      throw new ValidationError('Invalid query parameters', validation.error.issues);
    }

    const { page, limit } = validation.data;
    const result = await userService.getAllUsers(page, limit);

    const response: ApiResponse = {
      success: true,
      data: result.users,
      meta: {
        pagination: result.pagination,
      },
    };

    return response;
  }

  async getUserById(request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply) {
    // Validate params
    const validation = userParamsSchema.safeParse(request.params);
    if (!validation.success) {
      throw new ValidationError('Invalid parameters', validation.error.issues);
    }

    const user = request.user as JwtPayload;
    const { id } = validation.data;

    const result = await userService.getUserById(id, user.userId, user.role || 'USER');

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    return response;
  }
}