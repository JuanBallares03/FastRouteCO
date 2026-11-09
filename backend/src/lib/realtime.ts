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

export async function initRealtime(server: HttpServer): Promise<Server> {
  if (io) return io;

  pubClient = new Redis(env.REDIS_URL, { lazyConnect: true });
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

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient, { key: 'fastrouteco:socket.io' }));

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

export function emitToCompany(companyId: string, event: string, payload: unknown): void {
  io?.to(`company:${companyId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
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
