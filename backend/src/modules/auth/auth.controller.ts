import { Request, Response, NextFunction } from 'express';
import {
  validateUserCredentials,
  rotateRefreshToken,
  revokeRefreshToken,
  acceptInvitation,
  resendInvitation,
  getUserProfile,
  AuthUser,
  InvalidCredentialsError,
  UserInactiveError,
  CompanyInactiveError,
} from './auth.service.js';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await validateUserCredentials(email, password);

    res.json({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        companyId: result.user.companyId,
        companyName: result.user.companyName,
      },
    });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ message: error.message });
      return;
    }
    if (error instanceof UserInactiveError) {
      res.status(403).json({ message: error.message });
      return;
    }
    if (error instanceof CompanyInactiveError) {
      res.status(403).json({ message: error.message });
      return;
    }
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const tokens = await rotateRefreshToken(refreshToken);

    if (!tokens) {
      res.status(401).json({ message: 'Refresh token inválido o expirado' });
      return;
    }

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Refresh token inválido' });
      return;
    }
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    next(error);
  }
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      companyId: profile.companyId,
      companyName: profile.companyName,
      isActive: profile.isActive,
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptInvitationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    const result = await acceptInvitation(token, password);

    if (!result) {
      res.status(400).json({ message: 'Token de invitación inválido, expirado o ya usado' });
      return;
    }

    res.json({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        companyId: result.user.companyId,
        companyName: result.user.companyName,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function resendInvitationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params as { userId: string };
    const invitationUrl = await resendInvitation(userId);

    if (!invitationUrl) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json({ message: 'Invitación reenviada', invitationUrl });
  } catch (error) {
    next(error);
  }
}