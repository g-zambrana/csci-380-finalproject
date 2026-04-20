// js/sidebar.js
// Shared sidebar initialiser — import and call initSidebar() on every
// feature page that carries the nav sidebar.
//
// Populates: #avatar-initials, #sb-username, #sb-useremail
// Wires:     #logoutBtn  (sign-out button in the page header)

import { supabase, requireAuth } from './supabase.js';
import { getUserProfile }        from './services/userService.js';

/**
 * Call once at the top of each page's module.
 * Returns the authenticated user object, or redirects to /login.
 */
export async function initSidebar() {
  const user = await requireAuth();
  if (!user) return null;

  // Resolve the best available display name
  let displayName = user.email.split('@')[0]; // safe ultimate fallback
  try {
    const profile = await getUserProfile(user.id);
    displayName =
      profile?.display_name          ||
      profile?.full_name             ||
      user.user_metadata?.full_name  ||
      user.email.split('@')[0];
  } catch (_) {
    displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.email.split('@')[0];
  }

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('avatar-initials', initials);
  set('sb-username',     displayName);
  set('sb-useremail',    user.email);

  // Wire logout button (page header)
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  });

  return user;
}
