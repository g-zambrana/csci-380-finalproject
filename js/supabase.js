import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl     = 'https://vlsjefufwdxilvibouyx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsc2plZnVmd2R4aWx2aWJvdXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjU0MjIsImV4cCI6MjA5MTI0MTQyMn0.ueI8iY9M9X6JYm_dTjaR7v7Z6By-2fU0iBUthWiVKF8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Returns the current session's user ID, or null.
 */
export async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/**
 * Throws a normalised Error if the Supabase call returned an error,
 * otherwise returns data. Wrap any .from() query with this helper.
 */
export async function query(promise) {
  const { data, error } = await promise;
  if (error) {
    console.error('[Supabase]', error.message, error.details ?? '');
    throw new Error(error.message);
  }
  return data;
}

/**
 * Redirect to /login if not authenticated. Call at the top of every
 * protected page's JS module.
 */
export async function requireAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    window.location.href = '/login';
    return null;
  }
  return data.session.user;
}
