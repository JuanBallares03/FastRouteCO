import neo4j from 'neo4j-driver';
import { env } from '../env.js';
import { getRealtimeRedisClient } from './realtime.js';
import { prisma } from './prisma.js';

const HEALTH_TIMEOUT_MS = 2000;

export interface HealthCheckResult {
  status: 'up' | 'down';
  message?: string;
}

export interface HealthCheckers {
  postgres: () => Promise<HealthCheckResult>;
  redis: () => Promise<HealthCheckResult>;
  neo4j: () => Promise<HealthCheckResult>;
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks: {
    postgres: HealthCheckResult;
    redis: HealthCheckResult;
    neo4j: HealthCheckResult;
  };
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timeout`)),
      HEALTH_TIMEOUT_MS
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkPostgres(): Promise<HealthCheckResult> {
  await withTimeout(prisma.$queryRaw`SELECT 1`, 'postgres');
  return { status: 'up' };
}

async function checkRedis(): Promise<HealthCheckResult> {
  const client = getRealtimeRedisClient();
  if (!client) {
    return { status: 'down', message: 'Redis client not initialized' };
  }

  await withTimeout(client.ping(), 'redis');
  return { status: 'up' };
}

async function checkNeo4j(): Promise<HealthCheckResult> {
  const driver = neo4j.driver(
    env.NEO4J_URI,
    neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD),
    { connectionTimeout: HEALTH_TIMEOUT_MS }
  );

  try {
    await withTimeout(driver.verifyConnectivity(), 'neo4j');
    return { status: 'up' };
  } finally {
    await driver.close().catch(() => undefined);
  }
}

const defaultCheckers: HealthCheckers = {
  postgres: checkPostgres,
  redis: checkRedis,
  neo4j: checkNeo4j,
};

async function runChecker(
  check: () => Promise<HealthCheckResult>
): Promise<HealthCheckResult> {
  try {
    return await check();
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkHealth(
  checkers: HealthCheckers = defaultCheckers
): Promise<HealthReport> {
  const [postgres, redis, neo4jResult] = await Promise.all([
    runChecker(checkers.postgres),
    runChecker(checkers.redis),
    runChecker(checkers.neo4j),
  ]);

  const checks = { postgres, redis, neo4j: neo4jResult };
  const status =
    postgres.status === 'down' || redis.status === 'down'
      ? 'error'
      : neo4jResult.status === 'down'
        ? 'degraded'
        : 'ok';

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
  };
}
