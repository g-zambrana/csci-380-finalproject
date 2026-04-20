// js/services/userService.js
// Browser-compatible user profile service for MindBloom.
//
// WHY THE DUAL-PATH APPROACH:
// Supabase PostgREST shows "Could not find the table public.users in the
// schema cache" when the authenticated role lacks GRANT permissions, or when
// the missing INSERT RLS policy blocks upsert.  Until the schema is patched
// (see supabase/schema.sql — run the GRANT + INSERT POLICY block in the
// Supabase SQL editor), every write falls back to auth.users raw_user_meta_data
// which is always writable by the session owner.

import { supabase, query } from '../supabase.js';

// ── helpers ────────────────────────────────────────────────────

/** Safely run a Supabase query; return null instead of throwing. */
async function safeQuery(promise) {
  try {
    const { data, error } = await promise;
    if (error) { console.warn('[userService]', error.message); return null; }
    return data;
  } catch (e) {
    console.warn('[userService] unexpected:', e.message);
    return null;
  }
}

// ── public API ─────────────────────────────────────────────────

/**
 * Fetch the user's profile row plus the client_profiles join.
 * Falls back to constructing a profile-like object from auth metadata
 * if the public.users table is inaccessible.
 */
export async function getUserProfile(userId) {
  const row = await safeQuery(
    supabase
      .from('users')
      .select('*, client_profiles(*)')
      .eq('id', userId)
      .maybeSingle()
  );
  if (row) return row;

  // Fallback: build a minimal profile from auth session metadata
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const m = user.user_metadata ?? {};
  return {
    id:           userId,
    email:        user.email,
    full_name:    m.full_name    ?? user.email?.split('@')[0] ?? '',
    display_name: m.display_name ?? null,
    phone:        m.phone        ?? null,
    date_of_birth: m.date_of_birth ?? null,
    timezone:     m.timezone     ?? 'America/New_York',
    role:         m.role         ?? 'client',
    avatar_url:   m.avatar_url   ?? null,
    client_profiles: {
      goals:              m.goals              ?? [],
      preferred_language: m.preferred_language ?? 'en',
      referral_source:    m.referral_source    ?? null,
      emergency_contact:  m.emergency_contact  ?? {},
    },
  };
}

/**
 * Upsert base user fields.
 * Tries public.users first; on any failure saves to auth metadata instead.
 */
export async function upsertUserProfile(userId, email, updates = {}) {
  const row = await safeQuery(
    supabase
      .from('users')
      .upsert({ id: userId, email, ...updates }, { onConflict: 'id' })
      .select()
      .single()
  );
  if (row) return row;

  // Fallback: store in auth metadata
  const { data, error } = await supabase.auth.updateUser({ data: { ...updates } });
  if (error) console.warn('[userService] auth metadata fallback failed:', error.message);
  return data?.user ?? null;
}

/**
 * Update base user fields.
 * Tries public.users first; on failure writes to auth metadata.
 */
export async function updateUserProfile(userId, updates) {
  const row = await safeQuery(
    supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
  );
  if (row) return row;

  // Fallback: store every field in auth user_metadata
  const { data, error } = await supabase.auth.updateUser({ data: { ...updates } });
  if (error) throw new Error(error.message);
  return data?.user ?? null;
}

/**
 * Update the extended client profile row.
 * Tries public.client_profiles first; on failure writes to auth metadata.
 */
export async function updateClientProfile(userId, updates) {
  const row = await safeQuery(
    supabase
      .from('client_profiles')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
      .select()
      .single()
  );
  if (row) return row;

  // Fallback: flatten into auth metadata
  const { data, error } = await supabase.auth.updateUser({ data: { ...updates } });
  if (error) throw new Error(error.message);
  return data?.user ?? null;
}

/**
 * Upload a new avatar and save its public URL.
 */
export async function uploadAvatar(userId, file) {
  const ext  = (file.name?.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `avatars/${userId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('user-assets')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: { publicUrl } } = supabase.storage
    .from('user-assets')
    .getPublicUrl(path);

  return updateUserProfile(userId, { avatar_url: publicUrl });
}
