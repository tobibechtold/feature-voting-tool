import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { promiseWithTimeout, TimeoutError } from '@/lib/queryCache';

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

    // Set up auth state listener BEFORE getting session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Check admin role asynchronously with timeout
          const adminStatus = await checkAdminRole(session.user.id);
          if (isMounted) {
            setIsAdmin(adminStatus);
            setLoading(false);
          }
        } else {
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // Get initial session with timeout
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

    initSession();

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
