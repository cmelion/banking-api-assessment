import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './service';
import { signupSchema, loginSchema, refreshTokenSchema, SignupRequest, LoginRequest, RefreshTokenRequest } from './schemas';
import { ApiResponse } from '../../lib/types';
import { ValidationError } from '../../lib/errors';

const authService = new AuthService();

export class AuthController {
  async signup(request: FastifyRequest<{ Body: SignupRequest }>, reply: FastifyReply) {
    // Validate request body
    const validation = signupSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const { email, password, name } = validation.data;

    const result = await authService.signup(email, password, name);

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    reply.code(201);
    return response;
  }

  async login(request: FastifyRequest<{ Body: LoginRequest }>, _reply: FastifyReply) {
    // Validate request body
    const validation = loginSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const { email, password } = validation.data;

    const result = await authService.login(email, password);

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    return response;
  }

  async refresh(request: FastifyRequest<{ Body: RefreshTokenRequest }>, _reply: FastifyReply) {
    // Validate request body
    const validation = refreshTokenSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const { refreshToken } = validation.data;

    const tokens = await authService.refreshToken(refreshToken);

    const response: ApiResponse = {
      success: true,
      data: { tokens },
    };

    return response;
  }

  async logout(request: FastifyRequest<{ Body: RefreshTokenRequest }>, _reply: FastifyReply) {
    // Validate request body
    const validation = refreshTokenSchema.safeParse(request.body);
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues);
    }

    const { refreshToken } = validation.data;

    await authService.logout(refreshToken);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Logged out successfully' },
    };

    return response;
  }
}