// js/services/dashboardService.js
// Central dashboard data service for MindBloom.
// Aligned with current schema:
// - profiles
// - mood_entries
// - tasks
// - appointments
// - therapists

import { supabase } from '../supabase.js';

const AFFIRMATIONS = [
  { text: 'You are doing better than you think. Every small step forward is progress worth celebrating.', category: 'encouragement' },
  { text: 'Healing is not linear. Be patient and gentle with yourself today.', category: 'self-compassion' },
  { text: 'You have survived every difficult day so far. That is strength.', category: 'resilience' },
  { text: 'Your feelings are valid. You deserve care and support.', category: 'validation' },
  { text: 'Progress, not perfection. You are enough exactly as you are.', category: 'encouragement' },
  { text: 'Taking care of yourself is not selfish — it is necessary.', category: 'self-compassion' },
  { text: 'Every day is a new opportunity to grow and heal.', category: 'growth' },
];

/**
 * Fetch everything the dashboard needs.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   streak: number,
 *   longestStreak: number,
 *   moodLoggedToday: boolean,
 *   moodTodayLabel: string|null,
 *   nextAppointment: null | {
 *     id: string,
 *     therapist_id: string|null,
 *     therapistName: string,
 *     scheduled_at: string|null,
 *     duration_mins: number|null,
 *     format: string|null,
 *     status: string|null,
 *     notes_client: string|null
 *   },
 *   affirmation: { text: string, category: string },
 *   unreadNotifications: number
 * }>}
 */
export async function getDashboardData(userId) {
  const [
    streakData,
    todayMood,
    nextAppointment,
    unreadCount
  ] = await Promise.all([
    getMoodStreaks(userId).catch(() => ({ currentStreak: 0, longestStreak: 0 })),
    getTodayMoodEntry(userId).catch(() => null),
    getNextAppointment(userId).catch(() => null),
    getUnreadTaskCount(userId).catch(() => 0),
  ]);

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86_400_000
  );
  const affirmation = AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];

  return {
    streak: streakData.currentStreak ?? 0,
    longestStreak: streakData.longestStreak ?? 0,
    moodLoggedToday: Boolean(todayMood),
    moodTodayLabel: todayMood?.mood_label ?? null,
    nextAppointment,
    affirmation,
    unreadNotifications: unreadCount ?? 0,
  };
}

/**
 * Gets the user's most recent mood entry for today.
 */
async function getTodayMoodEntry(userId) {
  const today = getLocalDateString();

  const { data, error } = await supabase
    .from('mood_entries')
    .select('id, mood_rating, mood_label, entry_date, created_at')
    .eq('user_id', userId)
    .eq('entry_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Gets current streak + longest streak from mood_entries.entry_date.
 */
async function getMoodStreaks(userId) {
  const { data, error } = await supabase
    .from('mood_entries')
    .select('entry_date')
    .eq('user_id', userId)
    .order('entry_date', { ascending: true });

  if (error) throw error;

  const uniqueDates = [...new Set((data || []).map(row => row.entry_date).filter(Boolean))];
  return calculateStreaks(uniqueDates);
}

/**
 * Counts overdue / due-today incomplete tasks for the badge.
 */
async function getUnreadTaskCount(userId) {
  const today = getLocalDateString();

  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'eq', 'completed')
    .lte('due_date', today);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Returns the next upcoming appointment.
 *
 * Primary path:
 * - appointments.scheduled_at
 *
 * Legacy fallback:
 * - appointments.appointment_date + appointments.appointment_time
 */
async function getNextAppointment(userId) {
  const nowIso = new Date().toISOString();

  // 1) Preferred query using scheduled_at
  const { data: modernRows, error: modernError } = await supabase
    .from('appointments')
    .select(`
      id,
      therapist_id,
      scheduled_at,
      duration_mins,
      format,
      status,
      notes_client
    `)
    .eq('user_id', userId)
    .in('status', ['scheduled'])
    .gte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(1);

  if (modernError) {
    throw modernError;
  }

  if (modernRows && modernRows.length > 0) {
    const appt = modernRows[0];
    const therapistName = await getTherapistName(appt.therapist_id);

    return {
      id: appt.id,
      therapist_id: appt.therapist_id ?? null,
      therapistName,
      scheduled_at: appt.scheduled_at ?? null,
      duration_mins: appt.duration_mins ?? null,
      format: appt.format ?? null,
      status: appt.status ?? null,
      notes_client: appt.notes_client ?? null,
    };
  }

  // 2) Legacy fallback query
  const today = getLocalDateString();
  const currentTime = new Date().toTimeString().split(' ')[0];

  const { data: legacyRows, error: legacyError } = await supabase
    .from('appointments')
    .select(`
      id,
      therapist_id,
      appointment_date,
      appointment_time,
      status,
      notes
    `)
    .eq('user_id', userId)
    .in('status', ['scheduled'])
    .or(
      `appointment_date.gt.${today},and(appointment_date.eq.${today},appointment_time.gte.${currentTime})`
    )
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .limit(1);

  if (legacyError) {
    throw legacyError;
  }

  if (!legacyRows || legacyRows.length === 0) {
    return null;
  }

  const legacyAppt = legacyRows[0];
  const therapistName = await getTherapistName(legacyAppt.therapist_id);

  let scheduledAt = null;
  if (legacyAppt.appointment_date) {
    scheduledAt = `${legacyAppt.appointment_date}T${legacyAppt.appointment_time || '00:00:00'}`;
  }

  return {
    id: legacyAppt.id,
    therapist_id: legacyAppt.therapist_id ?? null,
    therapistName,
    scheduled_at: scheduledAt,
    duration_mins: null,
    format: null,
    status: legacyAppt.status ?? null,
    notes_client: legacyAppt.notes ?? null,
  };
}

/**
 * Looks up the therapist's display name from:
 * therapists.user_id -> profiles.full_name / display_name
 *
 * Also supports legacy therapists.profile_id as fallback.
 */
async function getTherapistName(therapistId) {
  if (!therapistId) return 'Your therapist';

  try {
    const { data: therapist, error: therapistError } = await supabase
      .from('therapists')
      .select('id, user_id, profile_id, specialty')
      .eq('id', therapistId)
      .maybeSingle();

    if (therapistError || !therapist) {
      return 'Your therapist';
    }

    const linkedProfileId = therapist.user_id || therapist.profile_id || null;

    if (!linkedProfileId) {
      return therapist.specialty ? `Therapist (${therapist.specialty})` : 'Your therapist';
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', linkedProfileId)
      .maybeSingle();

    if (profileError || !profile) {
      return therapist.specialty ? `Therapist (${therapist.specialty})` : 'Your therapist';
    }

    return profile.display_name || profile.full_name || 'Your therapist';
  } catch (err) {
    console.warn('Therapist name lookup warning:', err);
    return 'Your therapist';
  }
}

function calculateStreaks(dateStrings) {
  if (!dateStrings || dateStrings.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const dates = dateStrings
    .map(dateStr => {
      const d = new Date(`${dateStr}T00:00:00`);
      d.setHours(0, 0, 0, 0);
      return d;
    })
    .sort((a, b) => a - b);

  let longestStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const diffDays = Math.round((dates[i] - dates[i - 1]) / 86400000);

    if (diffDays === 1) {
      runningStreak++;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else if (diffDays > 1) {
      runningStreak = 1;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let currentStreak = 0;

  for (let i = dates.length - 1; i >= 0; i--) {
    const current = new Date(dates[i]);
    current.setHours(0, 0, 0, 0);

    if (i === dates.length - 1) {
      const isToday = current.getTime() === today.getTime();
      const isYesterday = current.getTime() === yesterday.getTime();

      if (!isToday && !isYesterday) {
        currentStreak = 0;
        break;
      }

      currentStreak = 1;
    } else {
      const next = new Date(dates[i + 1]);
      next.setHours(0, 0, 0, 0);

      const diffDays = Math.round((next - current) / 86400000);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak };
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}