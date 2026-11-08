import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../env.js';
import { verifyAccessToken } from '../modules/auth/jwt.js';
import { prisma } from './prisma.js';

interface RealtimeUser {
  id: string;
  role: string;
  companyId: string | null;
}

let io: Server | null = null;

export function initRealtime(server: HttpServer): Server {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: env.WEB_APP_URL,
      credentials: true,
    },
  });

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

export function closeRealtime(): Promise<void> | void {
  if (!io) return;
  const server = io;
  io = null;
  return server.close();
}
