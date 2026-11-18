import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthenticatedApiRateLimiters } from '../api-rate-limit.js';
import { MemoryRateLimitStore } from '../../lib/rate-limit.js';
import { signAccessToken } from '../../modules/auth/jwt.js';

function tokenFor(userId: string): string {
  return signAccessToken({
    sub: userId,
    email: `${userId}@test.com`,
    role: 'supervisor',
    companyId: null,
  });
}

function buildApp(limits: { userLimit: number; ipLimit: number }) {
  const app = express();
  app.use(
    '/api/v1',
    ...createAuthenticatedApiRateLimiters({
      ...limits,
      windowSeconds: 60,
      store: new MemoryRateLimitStore(),
    })
  );
  app.get('/api/v1/protected', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('authenticated API rate limiting', () => {
  it('limits per user and per IP with a Spanish 429 response', async () => {
    const app = buildApp({ userLimit: 2, ipLimit: 3 });
    const userA = { Authorization: `Bearer ${tokenFor('user-a')}` };
    const userB = { Authorization: `Bearer ${tokenFor('user-b')}` };

    expect((await request(app).get('/api/v1/protected').set(userA)).status).toBe(200);
    expect((await request(app).get('/api/v1/protected').set(userA)).status).toBe(200);

    const userBlocked = await request(app).get('/api/v1/protected').set(userA);
    expect(userBlocked.status).toBe(429);
    expect(userBlocked.body.code).toBe('RATE_LIMITED');
    expect(userBlocked.body.message).toContain('Demasiados intentos');
    expect(userBlocked.headers['retry-after']).toBeDefined();

    expect((await request(app).get('/api/v1/protected').set(userB)).status).toBe(200);

    const ipBlocked = await request(app).get('/api/v1/protected').set(userB);
    expect(ipBlocked.status).toBe(429);
    expect(ipBlocked.body.code).toBe('RATE_LIMITED');
    expect(ipBlocked.body.message).toContain('Demasiados intentos');
  });

  it('does not rate-limit requests without a bearer token', async () => {
    const app = buildApp({ userLimit: 1, ipLimit: 1 });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await request(app).get('/api/v1/protected')).status).toBe(200);
    }
  });
});
