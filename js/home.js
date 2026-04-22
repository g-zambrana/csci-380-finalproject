// js/home.js
// Controller for pages/home.html
// Uses dashboardService.js as the single source of truth.

import { supabase } from './supabase.js';
import { getDashboardData } from './services/dashboardService.js';

const greetingEl = document.getElementById('greeting');
const todayDateEl = document.getElementById('today-date');
const avatarInitialsEl = document.getElementById('avatar-initials');
const sbUsernameEl = document.getElementById('sb-username');
const sbUseremailEl = document.getElementById('sb-useremail');
const streakCountEl = document.getElementById('streak-count');
const longestStreakEl = document.getElementById('longest-streak');
const moodStatusEl = document.getElementById('mood-status');
const nextAppointmentEl = document.getElementById('next-appointment');
const affirmationTextEl = document.getElementById('affirmation-text');
const notifBadgeEl = document.getElementById('notif-badge');
const logoutBtn = document.getElementById('logoutBtn');

document.addEventListener('DOMContentLoaded', async () => {
  try {
    setTodayDate();
    setupLogout();

    const user = await requireAuth();
    if (!user) return;

    const profile = await ensureAndLoadProfile(user);

    renderUserBasics(user, profile);
    renderGreeting(user, profile);

    const dashboard = await getDashboardData(user.id);
    renderDashboard(dashboard);
  } catch (err) {
    console.error('Dashboard init error:', err);
    renderDashboardFallback();
  }
});

// --------------------------------------------------
// Auth
// --------------------------------------------------
async function requireAuth() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      window.location.href = '/login';
      return null;
    }

    return data.user;
  } catch (err) {
    console.error('Auth error:', err);
    window.location.href = '/login';
    return null;
  }
}

// --------------------------------------------------
// Profile
// --------------------------------------------------
async function ensureAndLoadProfile(user) {
  const fallbackName =
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split('@')[0] ||
    'User';

  const fallbackEmail = user.email || '';

  try {
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existingProfile) {
      return existingProfile;
    }

    const insertPayload = {
      id: user.id,
      full_name: fallbackName,
      display_name: fallbackName,
      email: fallbackEmail,
      role: 'user',
    };

    const { data: insertedProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      console.warn('Profile insert failed:', insertError.message);
      return insertPayload;
    }

    return insertedProfile;
  } catch (err) {
    console.warn('Profile load fallback:', err.message);
    return {
      id: user.id,
      full_name: fallbackName,
      display_name: fallbackName,
      email: fallbackEmail,
      role: 'user',
    };
  }
}

function renderUserBasics(user, profile) {
  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'User';

  const email = profile?.email || user.email || '';

  sbUsernameEl.textContent = displayName;
  sbUseremailEl.textContent = email;
  avatarInitialsEl.textContent = getInitials(displayName);
}

function renderGreeting(user, profile) {
  const sourceName =
    profile?.display_name ||
    profile?.full_name ||
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'User';

  const firstName = sourceName.trim().split(' ')[0];
  const hour = new Date().getHours();

  let greeting = 'Hello';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  else greeting = 'Good evening';

  greetingEl.textContent = `${greeting}, ${firstName}.`;
}

// --------------------------------------------------
// Dashboard rendering
// --------------------------------------------------
function renderDashboard(dashboard) {
  renderStreakCard(dashboard);
  renderMoodCard(dashboard);
  renderAppointmentCard(dashboard);
  renderAffirmation(dashboard);
  renderNotificationBadge(dashboard);
}

function renderStreakCard(dashboard) {
  const streak = dashboard?.streak ?? 0;
  const longestStreak = dashboard?.longestStreak ?? 0;

  streakCountEl.textContent = String(streak);
  streakCountEl.classList.remove('skeleton');

  longestStreakEl.textContent =
    `Longest: ${longestStreak} day${longestStreak === 1 ? '' : 's'}`;
}

function renderMoodCard(dashboard) {
  if (dashboard?.moodLoggedToday) {
    const label = dashboard?.moodTodayLabel || 'Logged today';
    moodStatusEl.textContent = `${label} ✓`;
    moodStatusEl.style.color = '#3D6B35';
    return;
  }

  moodStatusEl.textContent = 'Not logged yet';
  moodStatusEl.style.color = '#e67e22';
}

function renderAppointmentCard(dashboard) {
  const appt = dashboard?.nextAppointment;

  if (!appt) {
    nextAppointmentEl.textContent = 'No upcoming sessions';
    return;
  }

  nextAppointmentEl.textContent = formatAppointmentDisplay(appt);
}

function renderAffirmation(dashboard) {
  affirmationTextEl.textContent =
    dashboard?.affirmation?.text ||
    'You are doing better than you think.';
}

function renderNotificationBadge(dashboard) {
  const count = dashboard?.unreadNotifications ?? 0;

  if (count > 0) {
    notifBadgeEl.textContent = count > 9 ? '9+' : String(count);
    notifBadgeEl.style.display = 'flex';
  } else {
    notifBadgeEl.style.display = 'none';
  }
}

function renderDashboardFallback() {
  streakCountEl.textContent = '0';
  streakCountEl.classList.remove('skeleton');
  longestStreakEl.textContent = 'Longest: 0 days';

  moodStatusEl.textContent = 'Unable to load';
  moodStatusEl.style.color = '#c0392b';

  nextAppointmentEl.textContent = 'Unable to load';
  affirmationTextEl.textContent = 'One small step is still progress.';
  notifBadgeEl.style.display = 'none';
}

function formatAppointmentDisplay(appt) {
  const therapistName = appt?.therapistName || 'Your therapist';

  if (!appt?.scheduled_at) {
    return therapistName;
  }

  const date = new Date(appt.scheduled_at);

  if (Number.isNaN(date.getTime())) {
    return therapistName;
  }

  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });

  let suffix = `${formattedDate} at ${formattedTime}`;

  if (appt?.format) {
    suffix += ` · ${appt.format}`;
  }

  return `${therapistName} · ${suffix}`;
}

// --------------------------------------------------
// Date / Logout
// --------------------------------------------------
function setTodayDate() {
  todayDateEl.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function setupLogout() {
  logoutBtn.addEventListener('click', async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
      alert('Could not sign out. Please try again.');
    }
  });
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function getInitials(name) {
  if (!name) return '?';

  const parts = name.trim().split(' ').filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}