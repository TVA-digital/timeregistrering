import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, Role } from '@timeregistrering/shared';
import { apiFetch } from '../lib/api';

function getAvailableRoles(role: Role): Role[] {
  switch (role) {
    case 'admin':             return ['admin', 'leder', 'fagleder', 'lonningsansvarlig', 'ansatt'];
    case 'leder':             return ['leder', 'fagleder', 'ansatt'];
    case 'fagleder':          return ['fagleder', 'ansatt'];
    case 'lonningsansvarlig': return ['lonningsansvarlig', 'ansatt'];
    default:                  return ['ansatt'];
  }
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  activeRole: Role | null;
  availableRoles: Role[];
  setActiveRole: (role: Role) => void;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, setActiveRoleState] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadUserProfile();
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserProfile();
      else {
        setUser(null);
        setActiveRoleState(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile() {
    try {
      const profile = await apiFetch<User>('/users/me');
      setUser(profile);

      // Hent lagret rollebytte fra localStorage
      const storageKey = `activeRole_${profile.id}`;
      const stored = localStorage.getItem(storageKey) as Role | null;
      const available = getAvailableRoles(profile.role as Role);
      if (stored && available.includes(stored)) {
        setActiveRoleState(stored);
      } else {
        setActiveRoleState(profile.role as Role);
      }
    } catch {
      setUser(null);
      setActiveRoleState(null);
    } finally {
      setLoading(false);
    }
  }

  function setActiveRole(role: Role) {
    if (!user) return;
    const available = getAvailableRoles(user.role as Role);
    if (!available.includes(role)) return;
    setActiveRoleState(role);
    localStorage.setItem(`activeRole_${user.id}`, role);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (user) localStorage.removeItem(`activeRole_${user.id}`);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setActiveRoleState(null);
  }

  const availableRoles = user ? getAvailableRoles(user.role as Role) : [];

  return (
    <AuthContext.Provider value={{
      session, user, activeRole, availableRoles, setActiveRole, loading, signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth må brukes inni AuthProvider');
  return ctx;
}
