import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { env } from '../env.js';
import { verifyAccessToken } from '../modules/auth/jwt.js';
import { prisma } from './prisma.js';

interface RealtimeUser {
  id: string;
  role: string;
  companyId: string | null;
}

let io: Server | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export async function initRealtime(
  server: HttpServer,
  options: { redisUrl?: string } = {}
): Promise<Server> {
  if (io) return io;

  pubClient = new Redis(options.redisUrl ?? env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  subClient = pubClient.duplicate();

  for (const client of [pubClient, subClient]) {
    client.on('error', (error) => {
      console.error('Redis realtime client error:', error.message);
    });
  }

  io = new Server(server, {
    cors: {
      origin: env.WEB_APP_URL,
      credentials: true,
    },
  });

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient, { key: 'fastrouteco:socket.io' }));
  } catch (error) {
    await Promise.all([closeClient(pubClient), closeClient(subClient)]);
    pubClient = null;
    subClient = null;

    const reason = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Redis is required in production: ${reason}`, { cause: error });
    }
    console.error(
      '[realtime] Redis unavailable, falling back to the in-memory adapter',
      reason
    );
  }

  io.use(async (socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);

    if (!token) {
      next(new Error('unauthorized'));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { company: true },
      });

      if (!user || !user.isActive) {
        next(new Error('unauthorized'));
        return;
      }

      if (user.company && user.company.status === 'inactive') {
        next(new Error('unauthorized'));
        return;
      }

      const realtimeUser: RealtimeUser = {
        id: user.id,
        role: user.role,
        companyId: user.companyId,
      };
      socket.data.user = realtimeUser;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as RealtimeUser | undefined;
    if (!user) return;

    if (user.companyId) {
      socket.join(`company:${user.companyId}`);
    }
    socket.join(`user:${user.id}`);
  });

  return io;
}

export function getRealtimeRedisClient(): Redis | null {
  return pubClient;
}

export function emitToCompany(companyId: string, event: string, payload: unknown): void {
  io?.to(`company:${companyId}`).emit(event, payload);
}

async function closeClient(client: Redis | null): Promise<void> {
  if (!client) return;
  if (client.status === 'ready') {
    try {
      await client.quit();
      return;
    } catch {
      // fall through to a forced disconnect
    }
  }
  client.disconnect();
}

export async function closeRealtime(): Promise<void> {
  const server = io;
  const pub = pubClient;
  const sub = subClient;
  io = null;
  pubClient = null;
  subClient = null;

  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await Promise.all([closeClient(pub), closeClient(sub)]);
}
