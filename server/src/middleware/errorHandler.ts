import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    res.status(400).json({ error: 'Ugyldig input', details: messages });
    return;
  }

  // Uventede feil — logg begrenset i produksjon
  if (process.env.NODE_ENV === 'production') {
    const msg = err instanceof Error ? err.message : 'Ukjent feil';
    console.error(`[ERROR] ${msg}`);
  } else {
    console.error('Uventet feil:', err);
  }

  res.status(500).json({ error: 'Intern serverfeil' });
}
