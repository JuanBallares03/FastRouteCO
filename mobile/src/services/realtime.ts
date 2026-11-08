import { io, type Socket } from 'socket.io-client';
import { tokenStore } from '@/features/auth/token-store';
import { API_BASE_URL } from './http';

export const REALTIME_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

let socket: Socket | null = null;

export function getRealtimeSocket(): Socket | null {
  const token = tokenStore.getAccessToken();
  if (!token) return null;

  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  socket = io(REALTIME_URL, {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}

export function resetRealtimeSocket(): void {
  socket?.disconnect();
  socket = null;
}
