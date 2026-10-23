import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../modules/auth/jwt.js';
import { UserRole, CompanyStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    companyId: string | null;
    isActive: boolean;
    companyStatus?: CompanyStatus;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Token de acceso requerido' });
      return;
    }

    const token = authHeader.slice(7);
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      res.status(401).json({ message: 'Token de acceso inválido o expirado' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { company: true },
    });

    if (!user) {
      res.status(401).json({ message: 'Usuario no encontrado' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Usuario desactivado' });
      return;
    }

    if (user.company && user.company.status === CompanyStatus.inactive) {
      res.status(403).json({ message: 'Empresa desactivada' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      companyStatus: user.company?.status,
    };

    next();
  } catch {
    res.status(500).json({ message: 'Error de autenticación' });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Permisos insuficientes' });
      return;
    }
    next();
  };
}

export function authorizeCompanyAccess() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }
    if (req.user.role === 'platform_admin') {
      next();
      return;
    }
    if (!req.user.companyId) {
      res.status(403).json({ message: 'Sin empresa asociada' });
      return;
    }
    next();
  };
}