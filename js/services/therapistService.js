// js/services/therapistService.js
// Browser-compatible therapist + appointment service for MindBloom.
// Fits schema using: public.profiles, public.therapists, public.appointments

import { supabase, query } from '../supabase.js';

// ── Therapists ────────────────────────────────────────────────

/**
 * Fetch a paginated list of active therapists, joined with their profile.
 *
 * Expected therapist columns:
 * - id
 * - user_id
 * - status
 * - credentials
 * - specializations
 * - treatment_approaches
 * - languages
 * - bio
 * - session_rate_cents
 * - accepts_insurance
 * - session_formats
 * - rating_avg
 * - rating_count
 */
export async function listTherapists({
  page = 0,
  pageSize = 10,
  specializations,
  language,
} = {}) {
  let q = supabase
    .from('therapists')
    .select(`
      id,
      user_id,
      status,
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
      created_at,
      updated_at,
      profiles!user_id (
        id,
        full_name,
        display_name,
        avatar_url,
        email
      )
    `)
    .eq('status', 'active')
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (language) {
    q = q.contains('languages', [language]);
  }

  if (specializations?.length) {
    q = q.overlaps('specializations', specializations);
  }

  return query(q);
}

/**
 * Fetch one therapist's full public profile.
 */
export async function getTherapistProfile(therapistId) {
  return query(
    supabase
      .from('therapists')
      .select(`
        id,
        user_id,
        status,
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
        created_at,
        updated_at,
        profiles!user_id (
          id,
          full_name,
          display_name,
          avatar_url,
          email
        )
      `)
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
 * @param {string} params.scheduledAt   ISO 8601 datetime string
 * @param {number} [params.durationMins=50]
 * @param {'video'|'phone'|'in_person'} [params.format='video']
 * @param {string} [params.notesClient]
 */
export async function bookAppointment({
  userId,
  therapistId,
  scheduledAt,
  durationMins = 50,
  format = 'video',
  notesClient,
} = {}) {
  if (!userId || !therapistId || !scheduledAt) {
    throw new Error('bookAppointment requires userId, therapistId, and scheduledAt.');
  }

  return query(
    supabase
      .from('appointments')
      .insert({
        user_id: userId,
        therapist_id: therapistId,
        scheduled_at: scheduledAt,
        duration_mins: durationMins,
        format,
        status: 'scheduled',
        notes_client: notesClient ?? null,
      })
      .select(`
        id,
        user_id,
        therapist_id,
        scheduled_at,
        duration_mins,
        format,
        status,
        notes_client,
        created_at,
        updated_at
      `)
      .single()
  );
}

/**
 * Get all upcoming appointments for the user.
 */
export async function getUpcomingAppointments(userId) {
  return query(
    supabase
      .from('appointments')
      .select(`
        id,
        user_id,
        therapist_id,
        scheduled_at,
        duration_mins,
        format,
        status,
        notes_client,
        cancel_reason,
        cancelled_at,
        created_at,
        updated_at,
        therapists!therapist_id (
          id,
          credentials,
          profiles!user_id (
            id,
            full_name,
            display_name,
            avatar_url
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
  );
}

/**
 * Get the very next upcoming appointment.
 */
export async function getNextAppointment(userId) {
  const rows = await query(
    supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        duration_mins,
        format,
        therapists!therapist_id (
          id,
          profiles!user_id (
            full_name,
            display_name
          )
        )
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
export async function cancelAppointment(
  appointmentId,
  cancelledByUserId,
  reason = ''
) {
  return query(
    supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_by: cancelledByUserId,
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || null,
      })
      .eq('id', appointmentId)
      .select(`
        id,
        status,
        cancelled_by,
        cancelled_at,
        cancel_reason
      `)
      .single()
  );
}

/**
 * Get appointment history for the user.
 */
export async function getAppointmentHistory(userId, limit = 20) {
  return query(
    supabase
      .from('appointments')
      .select(`
        id,
        user_id,
        therapist_id,
        scheduled_at,
        duration_mins,
        format,
        status,
        notes_client,
        cancel_reason,
        cancelled_at,
        created_at,
        updated_at,
        therapists!therapist_id (
          id,
          profiles!user_id (
            full_name,
            display_name
          )
        )
      `)
      .eq('user_id', userId)
      .in('status', ['completed', 'cancelled', 'no_show'])
      .order('scheduled_at', { ascending: false })
      .limit(limit)
  );
}