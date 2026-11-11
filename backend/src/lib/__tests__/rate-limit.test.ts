import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  createRateLimiter,
  MemoryRateLimitStore,
  RedisRateLimitStore,
} from '../rate-limit.js';

describe('rate limiter', () => {
  it('blocks requests after the configured limit', async () => {
    const app = express();
    app.get(
      '/limited',
      createRateLimiter({
        limit: 2,
        windowSeconds: 60,
        keyPrefix: 'test:memory',
        store: new MemoryRateLimitStore(),
      }),
      (_req, res) => res.json({ ok: true })
    );

    expect((await request(app).get('/limited')).status).toBe(200);
    expect((await request(app).get('/limited')).status).toBe(200);

    const blocked = await request(app).get('/limited');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('increments Redis keys atomically with a window', async () => {
    const evalMock = vi.fn().mockResolvedValue([1, 60]);
    const store = new RedisRateLimitStore({ eval: evalMock } as never);

    await expect(store.increment('rate-limit:test:127.0.0.1', 60)).resolves.toEqual({
      count: 1,
      resetSeconds: 60,
    });
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      1,
      'rate-limit:test:127.0.0.1',
      60
    );
  });
});
