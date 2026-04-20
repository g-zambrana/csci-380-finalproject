// js/dashboard.js
// Controller for pages/home.html — the main dashboard.

import { supabase, requireAuth }    from './supabase.js';
import { getDashboardData }          from './services/dashboardService.js';
import { upsertUserProfile, getUserProfile } from './services/userService.js';

// ── Auth guard ─────────────────────────────────────────────────
const user = await requireAuth();
if (!user) throw new Error('Not authenticated');

// ── Ensure user profile row exists in public.users ────────────
// Wrapped in try/catch so a missing INSERT RLS policy doesn't
// kill the whole module and leave the sidebar stuck on "Loading…".
try {
  await upsertUserProfile(user.id, user.email, {
    full_name: user.user_metadata?.full_name ?? user.email.split('@')[0],
  });
} catch (e) {
  console.warn('[dashboard] upsertUserProfile failed (non-fatal):', e.message);
}

// ── Load profile for greeting + avatar ───────────────────────
let profile = null;
try {
  profile = await getUserProfile(user.id);
} catch (e) {
  console.warn('[dashboard] getUserProfile failed (non-fatal):', e.message);
}

// Robust name resolution: DB display_name → DB full_name →
// auth metadata full_name → email prefix
const displayName =
  profile?.display_name ||
  profile?.full_name ||
  user.user_metadata?.full_name ||
  user.email.split('@')[0];

// ── Render greeting ───────────────────────────────────────────
const hour = new Date().getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
document.getElementById('greeting').textContent = `${greeting}, ${displayName.split(' ')[0]}.`;

// ── Render today's date ───────────────────────────────────────
document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

// ── Render avatar initials ────────────────────────────────────
const initials = displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
document.getElementById('avatar-initials').textContent = initials;
document.getElementById('sb-username').textContent  = displayName;
document.getElementById('sb-useremail').textContent = user.email;

// ── Load dashboard data ───────────────────────────────────────
try {
  const data = await getDashboardData(user.id);

  // Streak
  document.getElementById('streak-count').textContent = data.streak;
  document.getElementById('longest-streak').textContent = `Longest: ${data.longestStreak} days`;

  // Mood logged today
  const moodStatus = document.getElementById('mood-status');
  moodStatus.textContent      = data.moodLoggedToday ? 'Logged today ✓' : 'Not logged yet';
  moodStatus.style.color      = data.moodLoggedToday ? '#3D6B35' : '#e67e22';

  // Next appointment
  const apptEl = document.getElementById('next-appointment');
  if (data.nextAppointment) {
    const appt = data.nextAppointment;
    const when = new Date(appt.scheduled_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const therapistName = appt.therapists?.users?.full_name ?? 'Your therapist';
    apptEl.textContent = `${therapistName} · ${when}`;
  } else {
    apptEl.textContent = 'No upcoming sessions';
  }

  // Affirmation
  if (data.affirmation) {
    document.getElementById('affirmation-text').textContent = data.affirmation.text;
  }

  // Notification badge
  if (data.unreadNotifications > 0) {
    const badge = document.getElementById('notif-badge');
    badge.textContent = data.unreadNotifications;
    badge.style.display = 'inline-flex';
  }
} catch (err) {
  console.error('Dashboard data error:', err);
}

// ── Logout ────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login';
});
