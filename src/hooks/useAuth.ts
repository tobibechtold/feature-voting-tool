import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { promiseWithTimeout } from '@/lib/queryCache';

const AUTH_TIMEOUT = 6000; // 6 seconds for auth operations
const ROLE_TIMEOUT = 5000; // 5 seconds for role check

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Helper to check admin role with timeout
    const checkAdminRole = async (userId: string): Promise<boolean> => {
      try {
        const roleCheck = async () => {
          const { data } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .eq('role', 'admin')
            .maybeSingle();
          
          return !!data;
        };

        return await promiseWithTimeout(roleCheck(), ROLE_TIMEOUT);
      } catch (error) {
        console.warn('[useAuth] Admin role check failed/timed out:', error);
        // Secure default: if role check fails, user is not admin
        return false;
      }
    };

    // Initialize session FIRST, then set up listener for future changes
    const initSession = async () => {
      try {
        const getSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          return session;
        };

        const session = await promiseWithTimeout(getSession(), AUTH_TIMEOUT);
        
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const adminStatus = await checkAdminRole(session.user.id);
          if (isMounted) {
            setIsAdmin(adminStatus);
          }
        }
      } catch (error) {
        console.warn('[useAuth] Session restoration failed/timed out:', error);
        // If session restoration fails, user is logged out
        if (isMounted) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      } finally {
        // ALWAYS set loading to false, even on error/timeout
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Run initial session load first
    initSession();

    // Set up auth state listener for FUTURE changes (login/logout after initial load)
    // This listener should NOT control isLoading - that's only for initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        // Update session/user state immediately
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fire-and-forget: check admin role without awaiting
          // This prevents race conditions with initSession
          checkAdminRole(session.user.id).then((adminStatus) => {
            if (isMounted) {
              setIsAdmin(adminStatus);
            }
          });
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    isAdmin,
    loading,
    signIn,
    signOut,
  };
}
