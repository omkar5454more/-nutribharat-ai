import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';

type Ctx = {
  session: Session | null;
  isLoading: boolean;
  /** true after the user opened a password-reset link: the app shows only the "new password" screen until it is saved */
  recovery: boolean;
  endRecovery: () => void;
};
const SessionContext = createContext<Ctx | null>(null);

export function useSession() {
  const v = use(SessionContext);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={{ session, isLoading, recovery, endRecovery: () => setRecovery(false) }}>{children}</SessionContext.Provider>;
}
