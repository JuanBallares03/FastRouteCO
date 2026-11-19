import type { Request, RequestHandler } from 'express';
import {
  createRateLimiter,
  type RateLimitStore,
} from '../lib/rate-limit.js';
import { verifyAccessToken } from '../modules/auth/jwt.js';

export interface ApiRateLimitOptions {
  userLimit?: number;
  ipLimit?: number;
  windowSeconds?: number;
  store?: RateLimitStore;
  skip?: (req: Request) => boolean;
}

const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_USER_LIMIT = 1200;
const DEFAULT_IP_LIMIT = 2400;

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function userIdentity(req: Request): string {
  const token = bearerToken(req);
  if (token) {
    try {
      return verifyAccessToken(token).sub;
    } catch {
      return `ip:${req.ip ?? 'unknown'}`;
    }
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

/**
 * Rate limits every authenticated /api/v1 request twice: once per user and
 * once per IP address. Requests without a bearer token are left to the
 * specific limiter of their route (for example login or invitations).
 */
export function createAuthenticatedApiRateLimiters(
  options: ApiRateLimitOptions = {}
): RequestHandler[] {
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  const shouldSkip = (req: Request) => {
    if (!bearerToken(req)) return true;
    return options.skip?.(req) ?? false;
  };

  const userLimiter = createRateLimiter({
    limit: options.userLimit ?? DEFAULT_USER_LIMIT,
    windowSeconds,
    keyPrefix: 'api:user',
    store: options.store,
    keyGenerator: userIdentity,
  });

  const ipLimiter = createRateLimiter({
    limit: options.ipLimit ?? DEFAULT_IP_LIMIT,
    windowSeconds,
    keyPrefix: 'api:ip',
    store: options.store,
    keyGenerator: (req) => req.ip ?? 'unknown',
  });

  return [
    (req, res, next) => {
      if (shouldSkip(req)) {
        next();
        return;
      }
      userLimiter(req, res, next);
    },
    (req, res, next) => {
      if (shouldSkip(req)) {
        next();
        return;
      }
      ipLimiter(req, res, next);
    },
  ];
}
