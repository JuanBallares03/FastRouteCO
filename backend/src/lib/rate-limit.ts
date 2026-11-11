import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Redis } from 'ioredis';
import { env } from '../env.js';

export interface RateLimitStore {
  increment(
    key: string,
    windowSeconds: number
  ): Promise<{ count: number; resetSeconds: number }>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowSeconds: number) {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.expiresAt <= now) {
      const expiresAt = now + windowSeconds * 1000;
      this.buckets.set(key, { count: 1, expiresAt });
      return { count: 1, resetSeconds: windowSeconds };
    }

    bucket.count += 1;
    return {
      count: bucket.count,
      resetSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
    };
  }
}

const INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: Pick<Redis, 'eval'>) {}

  async increment(key: string, windowSeconds: number) {
    const result = (await this.client.eval(
      INCREMENT_SCRIPT,
      1,
      key,
      windowSeconds
    )) as [number, number];

    return {
      count: Number(result[0]),
      resetSeconds: Math.max(1, Number(result[1])),
    };
  }
}

const memoryFallback = new MemoryRateLimitStore();
let redisClient: Redis | null = null;
let sharedStore: RateLimitStore | null = null;

function createSharedStore(): RateLimitStore {
  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redisClient.on('error', (error) => {
    console.error('[rate-limit] Redis error, using memory fallback:', error.message);
  });

  const redisStore = new RedisRateLimitStore(redisClient);

  return {
    async increment(key, windowSeconds) {
      if (redisClient?.status !== 'ready') {
        return memoryFallback.increment(key, windowSeconds);
      }

      try {
        return await redisStore.increment(key, windowSeconds);
      } catch (error) {
        console.error(
          '[rate-limit] Redis increment failed, using memory fallback:',
          error instanceof Error ? error.message : error
        );
        return memoryFallback.increment(key, windowSeconds);
      }
    },
  };
}

export function getSharedRateLimitStore(): RateLimitStore {
  if (!sharedStore) {
    sharedStore = createSharedStore();
  }
  return sharedStore;
}

export async function closeRateLimitStore(): Promise<void> {
  const client = redisClient;
  redisClient = null;
  sharedStore = null;

  if (!client) return;
  if (client.status === 'ready') {
    await client.quit().catch(() => client.disconnect());
    return;
  }
  client.disconnect();
}

interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyPrefix: string;
  store?: RateLimitStore;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identity = options.keyGenerator?.(req) ?? req.ip ?? 'unknown';
    const key = `rate-limit:${options.keyPrefix}:${identity}`;
    const store = options.store ?? getSharedRateLimitStore();

    try {
      const { count, resetSeconds } = await store.increment(key, options.windowSeconds);

      res.setHeader('RateLimit-Limit', options.limit);
      res.setHeader('RateLimit-Remaining', Math.max(0, options.limit - count));
      res.setHeader('RateLimit-Reset', resetSeconds);

      if (count > options.limit) {
        res.setHeader('Retry-After', resetSeconds);
        res.status(429).json({
          message: 'Demasiados intentos. Intenta de nuevo mǭs tarde.',
          code: 'RATE_LIMITED',
        });
        return;
      }

      next();
    } catch (error) {
      console.error(
        '[rate-limit] Store failed, allowing the request:',
        error instanceof Error ? error.message : error
      );
      next();
    }
  };
}
