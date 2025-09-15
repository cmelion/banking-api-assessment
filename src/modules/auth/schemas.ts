import { z } from 'zod';

// Request schemas
export const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Response schemas
export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: z.date(),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number(),
});

export const authResponseSchema = z.object({
  user: userResponseSchema,
  tokens: authTokensSchema,
});

// Type exports
export type SignupRequest = z.infer<typeof signupSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;