import { io, type Socket } from 'socket.io-client';
import { API_URL, getAccessToken } from './api';

export const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getRealtimeSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) return null;

  if (socket && socketToken === token) {
    return socket;
  }

  socket?.disconnect();
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
  });
  socketToken = token;
  return socket;
}

export function releaseRealtimeSocket(): void {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
