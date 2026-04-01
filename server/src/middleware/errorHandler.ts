import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Uventede feil — logg og svar med 500
  console.error('Uventet feil:', err);
  res.status(500).json({ error: 'Intern serverfeil' });
}
