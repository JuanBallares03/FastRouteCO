import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRole, CompanyStatus } from '@prisma/client';
import authRoutes from '../auth.routes.js';
import {
  hashPassword,
  verifyPassword,
  validateUserCredentials,
  createTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  acceptInvitation,
  resendInvitation,
  createInvitationForUser,
  getUserProfile,
  sha256Hex,
} from '../auth.service.js';
import { prisma } from '../../../lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

const TEST_COMPANY_ID = crypto.randomUUID();
const TEST_USER_ID = crypto.randomUUID();
const TEST_PASSWORD = 'TestPass123!';
const TEST_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 12);

async function cleanup() {
  await prisma.refreshToken.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.userInvitation.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.company.deleteMany({ where: { id: TEST_COMPANY_ID } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.company.create({
    data: {
      id: TEST_COMPANY_ID,
      legalName: 'Test Company',
      taxId: '900.000.000-1',
      email: 'test@company.com',
      status: CompanyStatus.active,
      hasOwnFleet: true,
    },
  });
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Test User',
      email: 'test@company.com',
      passwordHash: TEST_PASSWORD_HASH,
      isActive: true,
    },
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.refreshToken.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.userInvitation.deleteMany({ where: { userId: TEST_USER_ID } });
});

describe('Auth Service', () => {
  describe('hashPassword / verifyPassword', () => {
    it('should hash and verify password correctly', async () => {
      const hash = await hashPassword('MyPass123!');
      const valid = await verifyPassword('MyPass123!', hash);
      expect(valid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const hash = await hashPassword('MyPass123!');
      const valid = await verifyPassword('WrongPass123!', hash);
      expect(valid).toBe(false);
    });
  });

  describe('sha256Hex', () => {
    it('should produce consistent hash', () => {
      const input = 'test-token';
      const hash1 = sha256Hex(input);
      const hash2 = sha256Hex(input);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('validateUserCredentials', () => {
    it('should return tokens for valid credentials', async () => {
      const result = await validateUserCredentials('test@company.com', TEST_PASSWORD);
      expect(result).not.toBeNull();
      expect(result?.tokens).toHaveProperty('accessToken');
      expect(result?.tokens).toHaveProperty('refreshToken');
      expect(result?.user.email).toBe('test@company.com');
      expect(result?.user.role).toBe(UserRole.company_admin);
    });

    it('should return null for wrong password', async () => {
      const result = await validateUserCredentials('test@company.com', 'WrongPass123!');
      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const result = await validateUserCredentials('nonexistent@company.com', TEST_PASSWORD);
      expect(result).toBeNull();
    });

    it('should return null for user without password', async () => {
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          companyId: TEST_COMPANY_ID,
          role: UserRole.driver,
          fullName: 'No Pass User',
          email: 'nopass@company.com',
          isActive: true,
        },
      });
      const result = await validateUserCredentials('nopass@company.com', TEST_PASSWORD);
      expect(result).toBeNull();
      await prisma.user.delete({ where: { id: userId } });
    });

    it('should return null for inactive user', async () => {
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          companyId: TEST_COMPANY_ID,
          role: UserRole.driver,
          fullName: 'Inactive User',
          email: 'inactive@company.com',
          passwordHash: TEST_PASSWORD_HASH,
          isActive: false,
        },
      });
      const result = await validateUserCredentials('inactive@company.com', TEST_PASSWORD);
      expect(result).toBeNull();
      await prisma.user.delete({ where: { id: userId } });
    });

    it('should return null for user in inactive company', async () => {
      const inactiveCompanyId = crypto.randomUUID();
      await prisma.company.create({
        data: {
          id: inactiveCompanyId,
          legalName: 'Inactive Company',
          taxId: '900.000.000-2',
          email: 'inactive@company.com',
          status: CompanyStatus.inactive,
          hasOwnFleet: true,
        },
      });
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          companyId: inactiveCompanyId,
          role: UserRole.driver,
          fullName: 'User In Inactive',
          email: 'userinactive@company.com',
          passwordHash: TEST_PASSWORD_HASH,
          isActive: true,
        },
      });
      const result = await validateUserCredentials('userinactive@company.com', TEST_PASSWORD);
      expect(result).toBeNull();
      await prisma.user.delete({ where: { id: userId } });
      await prisma.company.delete({ where: { id: inactiveCompanyId } });
    });
  });

  describe('createTokenPair / rotateRefreshToken / revokeRefreshToken', () => {
    it('should create token pair', async () => {
      const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
      if (!user) throw new Error('User not found');
      const tokens = await createTokenPair(user);
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
    });

    it('should rotate refresh token', async () => {
      const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
      if (!user) throw new Error('User not found');
      const tokens = await createTokenPair(user);
      const rotated = await rotateRefreshToken(tokens.refreshToken);
      expect(rotated).not.toBeNull();
      expect(rotated).toHaveProperty('accessToken');
      expect(rotated).toHaveProperty('refreshToken');
    });

    it('should reject reused refresh token', async () => {
      const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
      if (!user) throw new Error('User not found');
      const tokens = await createTokenPair(user);
      await rotateRefreshToken(tokens.refreshToken);
      const reused = await rotateRefreshToken(tokens.refreshToken);
      expect(reused).toBeNull();
    });

    it('should revoke refresh token', async () => {
      const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
      if (!user) throw new Error('User not found');
      const tokens = await createTokenPair(user);
      await revokeRefreshToken(tokens.refreshToken);
      const rotated = await rotateRefreshToken(tokens.refreshToken);
      expect(rotated).toBeNull();
    });
  });

  describe('acceptInvitation', () => {
    it('should accept valid invitation and set password', async () => {
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          companyId: TEST_COMPANY_ID,
          role: UserRole.supervisor,
          fullName: 'Invited User',
          email: 'invited@company.com',
          isActive: true,
        },
      });
      const invitationUrl = await createInvitationForUser(userId);
      const token = invitationUrl.split('token=')[1];

      const result = await acceptInvitation(token, 'NewPass123!@#');
      expect(result).not.toBeNull();
      expect(result?.tokens).toHaveProperty('accessToken');
      expect(result?.user.email).toBe('invited@company.com');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.passwordHash).not.toBeNull();
      const valid = await verifyPassword('NewPass123!@#', user!.passwordHash!);
      expect(valid).toBe(true);

      await prisma.user.delete({ where: { id: userId } });
    });

    it('should reject used invitation', async () => {
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          companyId: TEST_COMPANY_ID,
          role: UserRole.supervisor,
          fullName: 'Invited User 2',
          email: 'invited2@company.com',
          isActive: true,
        },
      });
      const invitationUrl = await createInvitationForUser(userId);
      const token = invitationUrl.split('token=')[1];

      await acceptInvitation(token, 'NewPass123!@#');
      const result = await acceptInvitation(token, 'NewPass123!@#');
      expect(result).toBeNull();

      await prisma.user.delete({ where: { id: userId } });
    });

    it('should reject expired invitation', async () => {
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          companyId: TEST_COMPANY_ID,
          role: UserRole.supervisor,
          fullName: 'Invited User 3',
          email: 'invited3@company.com',
          isActive: true,
        },
      });
      const tokenRaw = crypto.randomBytes(32).toString('hex');
      const tokenHash = sha256Hex(tokenRaw);
      await prisma.userInvitation.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const result = await acceptInvitation(tokenRaw, 'NewPass123!@#');
      expect(result).toBeNull();

      await prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('resendInvitation', () => {
    it('should revoke old invitation and create new one', async () => {
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          companyId: TEST_COMPANY_ID,
          role: UserRole.driver,
          fullName: 'Driver User',
          email: 'driver@company.com',
          isActive: true,
        },
      });
      const url1 = await createInvitationForUser(userId);
      const url2 = await resendInvitation(userId);

      expect(url2).not.toBe(url1);
      expect(url2).toContain('/set-password?token=');

      const token1 = url1.split('token=')[1];
      const result = await acceptInvitation(token1, 'NewPass123!@#');
      expect(result).toBeNull();

      await prisma.user.delete({ where: { id: userId } });
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile', async () => {
      const profile = await getUserProfile(TEST_USER_ID);
      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(TEST_USER_ID);
      expect(profile?.email).toBe('test@company.com');
    });

    it('should return null for non-existent user', async () => {
      const profile = await getUserProfile(crypto.randomUUID());
      expect(profile).toBeNull();
    });
  });
});

describe('Auth API Endpoints', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should return tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@company.com', password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe('test@company.com');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid', password: TEST_PASSWORD });
      expect(res.status).toBe(400);
    });

    it('should reject missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@company.com' });
      expect(res.status).toBe(400);
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@company.com', password: 'WrongPass123!' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should rotate tokens with valid refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@company.com', password: TEST_PASSWORD });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });
      expect(res.status).toBe(401);
    });

    it('should reject reused refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@company.com', password: TEST_PASSWORD });

      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should revoke refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@company.com', password: TEST_PASSWORD });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: loginRes.body.refreshToken });

      expect(res.status).toBe(200);

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken });
      expect(refreshRes.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/accept-invitation', () => {
    it('should accept valid invitation', async () => {
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          companyId: TEST_COMPANY_ID,
          role: UserRole.supervisor,
          fullName: 'API Invited',
          email: 'apiinvited@company.com',
          isActive: true,
        },
      });
      const invitationUrl = await createInvitationForUser(userId);
      const token = invitationUrl.split('token=')[1];

      const res = await request(app)
        .post('/api/v1/auth/accept-invitation')
        .send({ token, password: 'NewPass123!@#' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe('apiinvited@company.com');

      await prisma.user.delete({ where: { id: userId } });
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/accept-invitation')
        .send({ token: 'invalid', password: 'NewPass123!@#' });
      expect(res.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/accept-invitation')
        .send({ token: 'sometoken', password: 'weak' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@company.com', password: TEST_PASSWORD });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(TEST_USER_ID);
      expect(res.body.email).toBe('test@company.com');
    });

    it('should reject missing token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });
});