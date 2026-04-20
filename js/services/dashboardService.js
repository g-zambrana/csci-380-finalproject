// js/services/dashboardService.js
// Browser-compatible dashboard data aggregation service.
// Fetches all data the home/dashboard page needs in one call.

import { supabase } from '../supabase.js';
import { getStreak, hasLoggedToday } from './moodService.js';
import { getNextAppointment } from './therapistService.js';

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
 * Fetch everything the dashboard needs in parallel.
 * Falls back gracefully if individual calls fail.
 *
 * @param {string} userId
 * @returns {Promise<{streak, longestStreak, moodLoggedToday, nextAppointment, affirmation, unreadNotifications}>}
 */
export async function getDashboardData(userId) {
  const [streak, nextAppt, todayLogged, unreadCount] = await Promise.all([
    getStreak(userId).catch(() => ({ current_streak: 0, longest_streak: 0 })),
    getNextAppointment(userId).catch(() => null),
    hasLoggedToday(userId).catch(() => false),
    _getUnreadCount(userId).catch(() => 0),
  ]);

  // Pick today's affirmation deterministically by day-of-year
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86_400_000
  );
  const affirmation = AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length];

  return {
    streak:              streak?.current_streak  ?? 0,
    longestStreak:       streak?.longest_streak  ?? 0,
    moodLoggedToday:     todayLogged,
    nextAppointment:     nextAppt,
    affirmation,
    unreadNotifications: unreadCount,
  };
}

async function _getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count ?? 0;
}
