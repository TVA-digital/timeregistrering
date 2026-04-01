import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Role } from '@timeregistrering/shared';
import { forbidden } from '../utils/errors.js';

export function requireRole(roles: Role | Role[]): RequestHandler {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role as Role)) {
      next(forbidden());
      return;
    }
    next();
  };
}
