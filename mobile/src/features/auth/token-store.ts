import type { AuthTokens } from './types';

let currentTokens: AuthTokens | null = null;

export const tokenStore = {
  set(tokens: AuthTokens): void {
    currentTokens = tokens;
  },
  clear(): void {
    currentTokens = null;
  },
  getAccessToken(): string | null {
    return currentTokens?.accessToken ?? null;
  },
  getRefreshToken(): string | null {
    return currentTokens?.refreshToken ?? null;
  },
};
