import { UserRole, User, CompanyStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../../env.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './jwt.js';
import { prisma } from '../../lib/prisma.js';
import { sendInvitationEmail } from '../../lib/email.js';

type UserWithCompany = Prisma.UserGetPayload<{ include: { company: true } }>;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  companyName: string | null;
  isActive: boolean;
  companyStatus?: CompanyStatus;
}

const REFRESH_TOKEN_TTL_DAYS = 7;
const INVITATION_TOKEN_TTL_HOURS = 72;
const BCRYPT_ROUNDS = 12;

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function calculateExpiry(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function calculateExpiryHours(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function findUserByEmail(email: string): Promise<UserWithCompany | null> {
  return prisma.user.findUnique({
    where: { email },
    include: { company: true },
  });
}

export class InvalidCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class UserInactiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserInactiveError';
  }
}

export class CompanyInactiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyInactiveError';
  }
}

export async function validateUserCredentials(
  email: string,
  password: string
): Promise<{ user: AuthUser; tokens: TokenPair }> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new InvalidCredentialsError('Credenciales inválidas');
  }

  if (!user.passwordHash) {
    throw new InvalidCredentialsError('Credenciales inválidas');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError('Credenciales inválidas');
  }

  if (!user.isActive) {
    throw new UserInactiveError('Usuario desactivado');
  }
  if (user.company && user.company.status === CompanyStatus.inactive) {
    throw new CompanyInactiveError('Empresa desactivada');
  }

  const tokens = await createTokenPair(user);
  return { user: mapToAuthUser(user), tokens };
}

export async function createTokenPair(user: User): Promise<TokenPair> {
  const jti = crypto.randomUUID();
  const refreshTokenRaw = generateSecureToken();
  const refreshTokenHash = sha256Hex(refreshTokenRaw);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      jti,
      expiresAt: calculateExpiry(REFRESH_TOKEN_TTL_DAYS),
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  });

  const refreshToken = signRefreshToken({
    sub: user.id,
    jti,
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(
  refreshToken: string
): Promise<TokenPair | null> {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken) as { sub: string; jti: string };
  } catch {
    return null;
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { jti: payload.jti },
    include: { user: { include: { company: true } } },
  });

  if (!storedToken) return null;
  if (storedToken.revokedAt) return null;
  if (storedToken.expiresAt < new Date()) return null;

  const user = storedToken.user as UserWithCompany;
  if (!user.isActive) return null;
  if (user.company && user.company.status === CompanyStatus.inactive) return null;

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: {
      revokedAt: new Date(),
      replacedBy: crypto.randomUUID(),
    },
  });

  return createTokenPair(user);
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken) as { sub: string; jti: string };
  } catch {
    return;
  }

  await prisma.refreshToken.updateMany({
    where: { jti: payload.jti },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllCompanyRefreshTokens(companyId: string): Promise<void> {
  const userIds = await prisma.user.findMany({
    where: { companyId },
    select: { id: true },
  });
  const ids = userIds.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.refreshToken.updateMany({
      where: { userId: { in: ids }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export async function acceptInvitation(
  tokenRaw: string,
  password: string
): Promise<{ user: AuthUser; tokens: TokenPair } | null> {
  const tokenHash = sha256Hex(tokenRaw);

  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash },
    include: { user: { include: { company: true } } },
  });

  if (!invitation) return null;
  if (invitation.usedAt) return null;
  if (invitation.expiresAt < new Date()) return null;

  const user = invitation.user as UserWithCompany;
  if (!user.isActive) return null;
  if (user.company && user.company.status === CompanyStatus.inactive) return null;

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    }),
  ]);

  const tokens = await createTokenPair(user);
  return { user: mapToAuthUser(user), tokens };
}

export async function resendInvitation(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true, invitations: { where: { usedAt: null } } },
  });

  if (!user) return null;

  await prisma.userInvitation.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const tokenRaw = generateSecureToken();
  const tokenHash = sha256Hex(tokenRaw);

  await prisma.userInvitation.create({
    data: {
      userId,
      tokenHash,
      expiresAt: calculateExpiryHours(INVITATION_TOKEN_TTL_HOURS),
    },
  });

  const invitationUrl = `${env.WEB_APP_URL}/set-password?token=${tokenRaw}`;
  
  if (user.company) {
    await sendInvitationEmail(user.email, user.fullName, invitationUrl, user.company.legalName);
  }

  return invitationUrl;
}

export async function createInvitationForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const tokenRaw = generateSecureToken();
  const tokenHash = sha256Hex(tokenRaw);

  await prisma.userInvitation.create({
    data: {
      userId,
      tokenHash,
      expiresAt: calculateExpiryHours(INVITATION_TOKEN_TTL_HOURS),
    },
  });

  const invitationUrl = `${env.WEB_APP_URL}/set-password?token=${tokenRaw}`;
  
  if (user.company) {
    await sendInvitationEmail(user.email, user.fullName, invitationUrl, user.company.legalName);
  }

  return invitationUrl;
}

function mapToAuthUser(
  user: User & { company?: { status: CompanyStatus; legalName: string } | null }
): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company?.legalName ?? null,
    isActive: user.isActive,
    companyStatus: user.company?.status,
  };
}

export async function getUserProfile(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { company: true },
  });
  if (!user) return null;
  return mapToAuthUser(user);
}