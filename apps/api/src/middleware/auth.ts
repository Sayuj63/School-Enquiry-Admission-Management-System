import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminUser, IAdminUser } from '../models';

export interface AuthRequest extends Request {
  user?: IAdminUser;
  userId?: string;
}

/**
 * JWT authentication middleware
 */
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'default-secret';

    const decoded = jwt.verify(token, secret) as { userId: string };

    const user = await AdminUser.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}

/**
 * Generate JWT token
 */
export function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'default-secret';
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}
