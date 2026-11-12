import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { checkHealth, type HealthCheckers } from '../../../lib/health.js';
import { createHealthRouter } from '../health.routes.js';

const up = async () => ({ status: 'up' as const });
const down = async () => {
  throw new Error('connection refused');
};

function checkers(overrides: Partial<HealthCheckers> = {}): HealthCheckers {
  return { postgres: up, redis: up, neo4j: up, ...overrides };
}

describe('health', () => {
  it('reports ok when every dependency is up', async () => {
    const report = await checkHealth(checkers());

    expect(report.status).toBe('ok');
    expect(report.checks).toEqual({
      postgres: { status: 'up' },
      redis: { status: 'up' },
      neo4j: { status: 'up' },
    });
  });

  it('reports degraded when only Neo4j is down', async () => {
    const report = await checkHealth(checkers({ neo4j: down }));

    expect(report.status).toBe('degraded');
    expect(report.checks.neo4j).toEqual({
      status: 'down',
      message: 'connection refused',
    });
  });

  it('reports error when Redis is down', async () => {
    const report = await checkHealth(checkers({ redis: down }));

    expect(report.status).toBe('error');
    expect(report.checks.redis.status).toBe('down');
  });

  it('returns 503 when a critical dependency is down', async () => {
    const app = express();
    app.use('/health', createHealthRouter(checkers({ postgres: down })));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.checks.postgres.status).toBe('down');
  });

  it('returns 200 when only Neo4j is down', async () => {
    const app = express();
    app.use('/health', createHealthRouter(checkers({ neo4j: down })));

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
  });
});
