// js/services/moodService.js
// Browser-compatible mood logging service for MindBloom.
// Interacts with: public.mood_logs, public.user_streaks

import { supabase, query } from '../supabase.js';

// Mood enum values that match the Supabase schema
export const MOOD_LEVELS = ['very_bad', 'bad', 'neutral', 'good', 'very_good'];

export const MOOD_LABELS = {
  very_bad: 'Very Bad',
  bad: 'Bad',
  neutral: 'Neutral',
  good: 'Good',
  very_good: 'Very Good',
};

export const MOOD_EMOJIS = {
  very_bad: '😢',
  bad: '😕',
  neutral: '😐',
  good: '🙂',
  very_good: '😄',
};

/**
 * Convert a 1-10 slider value to a mood enum string.
 * 1-2 → very_bad, 3-4 → bad, 5-6 → neutral, 7-8 → good, 9-10 → very_good
 */
export function sliderToMood(value) {
  const v = Number(value);

  if (v <= 2) return 'very_bad';
  if (v <= 4) return 'bad';
  if (v <= 6) return 'neutral';
  if (v <= 8) return 'good';
  return 'very_good';
}

// ── Local date helpers ────────────────────────────────────────
// IMPORTANT:
// Do not use toISOString().split('T')[0] for "today" because that uses UTC
// and can become the next day in the evening for local users.

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

/**
 * Log a mood entry and fire-and-forget a streak update.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {'very_bad'|'bad'|'neutral'|'good'|'very_good'} params.mood
 * @param {number} [params.energyLevel]   1–10
 * @param {number} [params.anxietyLevel]  1–10
 * @param {number} [params.sleepHours]
 * @param {string[]} [params.emotions]
 * @param {string}  [params.notes]
 */
export async function logMood({
  userId,
  mood,
  energyLevel,
  anxietyLevel,
  sleepHours,
  emotions = [],
  notes,
}) {
  const entry = await query(
    supabase
      .from('mood_logs')
      .insert({
        user_id: userId,
        mood,
        energy_level: energyLevel ?? null,
        anxiety_level: anxietyLevel ?? null,
        sleep_hours: sleepHours ?? null,
        emotions: Array.isArray(emotions) ? emotions : [],
        notes: notes ?? null,
        logged_at: new Date().toISOString(), // keep full timestamp
      })
      .select()
      .single()
  );

  // Update streak without blocking the UI
  _updateStreak(userId).catch((err) => {
    console.error('[moodService] streak update error:', err);
  });

  return entry;
}

/**
 * Get mood logs for the last `days` days.
 */
export async function getMoodHistory(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - Number(days));

  return query(
    supabase
      .from('mood_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: false })
  );
}

/**
 * Returns true if the user already logged a mood today,
 * based on the user's local calendar day.
 */
export async function hasLoggedToday(userId) {
  const { start, end } = getLocalDayBounds();

  const rows = await query(
    supabase
      .from('mood_logs')
      .select('id')
      .eq('user_id', userId)
      .gte('logged_at', start.toISOString())
      .lt('logged_at', end.toISOString())
      .limit(1)
  );

  return rows.length > 0;
}

/**
 * Get the user's current / longest streak record.
 */
export async function getStreak(userId) {
  const { data, error } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[moodService] getStreak:', error.message);
  }

  return data ?? {
    current_streak: 0,
    longest_streak: 0,
    last_logged_at: null,
  };
}

// ── Internal ──────────────────────────────────────────────────

async function _updateStreak(userId) {
  const today = getLocalDateString();

  const { data: streak, error: streakError } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (streakError) {
    console.error('[moodService] _updateStreak fetch:', streakError.message);
    return;
  }

  const last = streak?.last_logged_at ?? null;

  // Already counted today
  if (last === today) return;

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterdayDate);

  const previousCurrent = Number(streak?.current_streak ?? 0);
  const previousLongest = Number(streak?.longest_streak ?? 0);

  const newCurrentStreak = last === yesterdayStr ? previousCurrent + 1 : 1;
  const newLongestStreak = Math.max(newCurrentStreak, previousLongest);

  const { error: upsertError } = await supabase.from('user_streaks').upsert(
    {
      user_id: userId,
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_logged_at: today,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (upsertError) {
    console.error('[moodService] _updateStreak upsert:', upsertError.message);
  }
}