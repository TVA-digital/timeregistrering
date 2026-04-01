import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase.js';
import { unauthorized } from '../utils/errors.js';
import { User } from '@timeregistrering/shared';

// Utvid Express Request med brukerinfo
declare global {
  namespace Express {
    interface Request {
      user: User;
      token: string;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(unauthorized());
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  // Valider token mot Supabase Auth
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !authUser) {
    next(unauthorized());
    return;
  }

  // Hent brukerprofil fra users-tabellen
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*, department:departments(*), group:groups(*)')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile) {
    next(unauthorized());
    return;
  }

  if (!profile.is_active) {
    res.status(403).json({ error: 'Brukerkontoen er deaktivert' });
    return;
  }

  req.user = profile as User;
  req.token = token;
  next();
}
