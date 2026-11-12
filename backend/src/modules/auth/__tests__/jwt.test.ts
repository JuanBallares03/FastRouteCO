import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../../../env.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../jwt.js';

const accessPayload = {
  sub: 'user-1',
  email: 'user@example.com',
  role: 'company_admin',
  companyId: 'company-1',
};

describe('JWT validation', () => {
  it('round-trips a valid access token', () => {
    const token = signAccessToken(accessPayload);

    expect(verifyAccessToken(token)).toEqual({
      ...accessPayload,
      type: 'access',
    });
  });

  it('round-trips a valid refresh token', () => {
    const token = signRefreshToken({ sub: 'user-1', jti: 'jti-1' });

    expect(verifyRefreshToken(token)).toEqual({
      sub: 'user-1',
      jti: 'jti-1',
      type: 'refresh',
    });
  });

  it('rejects a token with the wrong access type', () => {
    const token = jwt.sign({ ...accessPayload, type: 'refresh' }, env.JWT_SECRET);

    expect(() => verifyAccessToken(token)).toThrow('Invalid access token type');
  });

  it('rejects an access token without companyId', () => {
    const token = jwt.sign(
      {
        sub: 'user-1',
        email: 'user@example.com',
        role: 'company_admin',
        type: 'access',
      },
      env.JWT_SECRET
    );

    expect(() => verifyAccessToken(token)).toThrow('Invalid access token payload');
  });

  it('rejects a token with the wrong refresh type', () => {
    const token = jwt.sign(
      { sub: 'user-1', jti: 'jti-1', type: 'access' },
      env.JWT_REFRESH_SECRET
    );

    expect(() => verifyRefreshToken(token)).toThrow('Invalid refresh token type');
  });

  it('rejects a refresh token without jti', () => {
    const token = jwt.sign({ sub: 'user-1', type: 'refresh' }, env.JWT_REFRESH_SECRET);

    expect(() => verifyRefreshToken(token)).toThrow('Invalid refresh token payload');
  });

  it('rejects a string payload', () => {
    const token = jwt.sign('not-an-object', env.JWT_SECRET);

    expect(() => verifyAccessToken(token)).toThrow('Invalid access token');
  });
});
