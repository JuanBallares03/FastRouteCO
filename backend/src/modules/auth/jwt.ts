import jwt from 'jsonwebtoken';
import { env } from '../../env.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  companyId: string | null;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, 'type'>,
  expiresInMinutes = 15
): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
    expiresIn: `${expiresInMinutes}m`,
  });
}

export function signRefreshToken(
  payload: Omit<RefreshTokenPayload, 'type'>,
  expiresInDays = 7
): string {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${expiresInDays}d`,
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseAccessPayload(payload: unknown): AccessTokenPayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid access token');
  }

  const { sub, email, role, companyId, type } = payload as Record<string, unknown>;
  if (type !== 'access') {
    throw new Error('Invalid access token type');
  }
  if (
    !isNonEmptyString(sub) ||
    !isNonEmptyString(email) ||
    !isNonEmptyString(role) ||
    !(companyId === null || typeof companyId === 'string')
  ) {
    throw new Error('Invalid access token payload');
  }

  return { sub, email, role, companyId, type: 'access' };
}

function parseRefreshPayload(payload: unknown): RefreshTokenPayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid refresh token');
  }

  const { sub, jti, type } = payload as Record<string, unknown>;
  if (type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }
  if (!isNonEmptyString(sub) || !isNonEmptyString(jti)) {
    throw new Error('Invalid refresh token payload');
  }

  return { sub, jti, type: 'refresh' };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return parseAccessPayload(jwt.verify(token, env.JWT_SECRET));
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return parseRefreshPayload(jwt.verify(token, env.JWT_REFRESH_SECRET));
}

export function decodeToken(token: string): jwt.JwtPayload | null {
  return jwt.decode(token) as jwt.JwtPayload | null;
}