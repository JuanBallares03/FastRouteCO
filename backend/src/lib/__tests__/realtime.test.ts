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

  it('reuses the same server instance on repeated calls', async () => {
    const first = await initRealtime(createServer());
    const second = await initRealtime(createServer());

    expect(second).toBe(first);
  });
});
