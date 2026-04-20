// js/services/moodService.js
// Browser-compatible mood logging service for MindBloom.
// Interacts with: public.mood_logs, public.user_streaks

import { supabase, query } from '../supabase.js';

// Mood enum values that match the Supabase schema
export const MOOD_LEVELS = ['very_bad', 'bad', 'neutral', 'good', 'very_good'];
export const MOOD_LABELS  = {
  very_bad:  'Very Bad',
  bad:       'Bad',
  neutral:   'Neutral',
  good:      'Good',
  very_good: 'Very Good',
};
export const MOOD_EMOJIS = {
  very_bad:  '😢',
  bad:       '😕',
  neutral:   '😐',
  good:      '🙂',
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
export async function logMood({ userId, mood, energyLevel, anxietyLevel, sleepHours, emotions = [], notes }) {
  const entry = await query(
    supabase
      .from('mood_logs')
      .insert({
        user_id:       userId,
        mood,
        energy_level:  energyLevel  ?? null,
        anxiety_level: anxietyLevel ?? null,
        sleep_hours:   sleepHours   ?? null,
        emotions,
        notes:         notes        ?? null,
        logged_at:     new Date().toISOString(),
      })
      .select()
      .single()
  );

  // Update streak without blocking the UI
  _updateStreak(userId).catch(console.error);

  return entry;
}

/**
 * Get mood logs for the last `days` days.
 */
export async function getMoodHistory(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

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
 * Returns true if the user already logged a mood today.
 */
export async function hasLoggedToday(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await query(
    supabase
      .from('mood_logs')
      .select('id')
      .eq('user_id', userId)
      .gte('logged_at', todayStart.toISOString())
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
    .maybeSingle();   // won't throw on 0 rows

  if (error) console.error('[moodService] getStreak:', error.message);
  return data ?? { current_streak: 0, longest_streak: 0 };
}

// ── Internal ──────────────────────────────────────────────────

async function _updateStreak(userId) {
  const today = new Date().toISOString().split('T')[0];

  const { data: streak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const last = streak?.last_logged_at;

  if (last === today) return; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newStreak = last === yesterdayStr ? (streak.current_streak ?? 0) + 1 : 1;

  await supabase.from('user_streaks').upsert({
    user_id:        userId,
    current_streak: newStreak,
    longest_streak: Math.max(newStreak, streak?.longest_streak ?? 0),
    last_logged_at: today,
    updated_at:     new Date().toISOString(),
  }, { onConflict: 'user_id' });
}
