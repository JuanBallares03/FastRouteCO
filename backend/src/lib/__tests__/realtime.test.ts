import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { initRealtime, closeRealtime } from '../realtime.js';

describe('realtime', () => {
  afterEach(async () => {
    await closeRealtime();
  });

  it('attaches the Redis adapter so rooms are shared across instances', async () => {
    const io = await initRealtime(createServer());

    expect(io.of('/').adapter.constructor.name).toBe('RedisAdapter');
  });

  it('falls back to the in-memory adapter when Redis is unavailable', async () => {
    const io = await initRealtime(createServer(), {
      redisUrl: 'redis://127.0.0.1:1',
    });

    expect(io.of('/').adapter.constructor.name).not.toBe('RedisAdapter');
  });

  it('reuses the same server instance on repeated calls', async () => {
    const first = await initRealtime(createServer());
    const second = await initRealtime(createServer());

    expect(second).toBe(first);
  });
});
