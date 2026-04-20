// js/services/therapistService.js
// Browser-compatible therapist + appointment service for MindBloom.
// Interacts with: public.therapists, public.appointments, public.users

import { supabase, query } from '../supabase.js';

// ── Therapists ────────────────────────────────────────────────

/**
 * Fetch a paginated list of active therapists, joined with their user profile.
 */
export async function listTherapists({ page = 0, pageSize = 10, specializations, language } = {}) {
  let q = supabase
    .from('therapists')
    .select(`
      id,
      credentials,
      specializations,
      treatment_approaches,
      languages,
      bio,
      session_rate_cents,
      accepts_insurance,
      session_formats,
      rating_avg,
      rating_count,
      users!user_id ( full_name, display_name, avatar_url )
    `)
    .eq('status', 'active')
    .order('rating_avg', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (language) q = q.contains('languages', [language]);
  if (specializations?.length) q = q.overlaps('specializations', specializations);

  return query(q);
}

/**
 * Fetch one therapist's full public profile.
 */
export async function getTherapistProfile(therapistId) {
  return query(
    supabase
      .from('therapists')
      .select('*, users!user_id ( full_name, display_name, avatar_url, email )')
      .eq('id', therapistId)
      .eq('status', 'active')
      .single()
  );
}

// ── Appointments ──────────────────────────────────────────────

/**
 * Book a new appointment.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.therapistId
 * @param {string} params.scheduledAt   - ISO 8601 datetime string
 * @param {number} [params.durationMins=50]
 * @param {'video'|'phone'|'in_person'} [params.format='video']
 * @param {string} [params.notesClient]
 */
export async function bookAppointment({ userId, therapistId, scheduledAt, durationMins = 50, format = 'video', notesClient }) {
  return query(
    supabase
      .from('appointments')
      .insert({
        user_id:       userId,
        therapist_id:  therapistId,
        scheduled_at:  scheduledAt,
        duration_mins: durationMins,
        format,
        notes_client:  notesClient ?? null,
      })
      .select()
      .single()
  );
}

/**
 * Get all upcoming appointments for the user (status = 'scheduled', future date).
 */
export async function getUpcomingAppointments(userId) {
  return query(
    supabase
      .from('appointments')
      .select(`
        *,
        therapists!therapist_id (
          id, credentials,
          users!user_id ( full_name, avatar_url )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
  );
}

/**
 * Get the very next upcoming appointment (for the dashboard card).
 */
export async function getNextAppointment(userId) {
  const rows = await query(
    supabase
      .from('appointments')
      .select(`
        scheduled_at, duration_mins, format,
        therapists!therapist_id ( users!user_id ( full_name ) )
      `)
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
  );
  return rows?.[0] ?? null;
}

/**
 * Cancel an existing appointment.
 */
export async function cancelAppointment(appointmentId, cancelledByUserId, reason = '') {
  return query(
    supabase
      .from('appointments')
      .update({
        status:        'cancelled',
        cancelled_by:  cancelledByUserId,
        cancelled_at:  new Date().toISOString(),
        cancel_reason: reason,
      })
      .eq('id', appointmentId)
      .select()
      .single()
  );
}

/**
 * Get appointment history (completed / cancelled).
 */
export async function getAppointmentHistory(userId, limit = 20) {
  return query(
    supabase
      .from('appointments')
      .select(`
        *,
        therapists!therapist_id ( id, users!user_id ( full_name ) )
      `)
      .eq('user_id', userId)
      .in('status', ['completed', 'cancelled', 'no_show'])
      .order('scheduled_at', { ascending: false })
      .limit(limit)
  );
}
