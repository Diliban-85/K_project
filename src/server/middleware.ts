import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from './auth';
import prisma from './db';

export interface AuthenticatedRequest extends Request {
  teacher?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export async function requireTeacherAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Fallback to cookie
    if (!token && req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    // 3. Fallback to query parameter (useful for media/PDF range streaming)
    if (!token && req.query && typeof req.query.auth_token === 'string') {
      token = req.query.auth_token;
    }

    if (!token) {
      res.status(401).json({
        error: 'Authentication required. Please sign in to access this resource.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const payload = verifyToken(token);
    if (!payload || !payload.id) {
      res.status(401).json({
        error: 'Invalid or expired session. Please sign in again.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Confirm teacher still exists in database
    const teacher = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!teacher) {
      res.status(401).json({
        error: 'Teacher account no longer exists.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    req.teacher = teacher;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}
