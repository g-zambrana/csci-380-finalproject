// js/services/journalService.js
// Browser-compatible journal service for MindBloom.
// Interacts with: public.journal_entries, public.journal_prompts

import { supabase, query } from '../supabase.js';

/**
 * Create a new journal entry.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.body
 * @param {string} [params.title]
 * @param {'very_bad'|'bad'|'neutral'|'good'|'very_good'} [params.mood]
 * @param {string[]} [params.tags]
 */
export async function createEntry({ userId, body, title, mood, tags = [] }) {
  return query(
    supabase
      .from('journal_entries')
      .insert({
        user_id:    userId,
        title:      title ?? null,
        body,
        mood:       mood ?? null,
        tags,
        word_count: body.trim().split(/\s+/).filter(Boolean).length,
        is_private: true,
      })
      .select()
      .single()
  );
}

/**
 * Update an existing entry.
 */
export async function updateEntry(entryId, updates) {
  const patch = { ...updates };
  if (updates.body) {
    patch.word_count = updates.body.trim().split(/\s+/).filter(Boolean).length;
  }

  return query(
    supabase
      .from('journal_entries')
      .update(patch)
      .eq('id', entryId)
      .select()
      .single()
  );
}

/**
 * Delete a journal entry by ID.
 */
export async function deleteEntry(entryId) {
  return query(
    supabase.from('journal_entries').delete().eq('id', entryId)
  );
}

/**
 * Get all entries for a user, newest first.
 */
export async function getEntries(userId, limit = 50) {
  return query(
    supabase
      .from('journal_entries')
      .select('id, title, body, mood, tags, word_count, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

/**
 * Get a single entry by ID.
 */
export async function getEntry(entryId) {
  return query(
    supabase.from('journal_entries').select('*').eq('id', entryId).single()
  );
}

/**
 * Full-text search across title + body.
 */
export async function searchEntries(userId, keyword) {
  return query(
    supabase
      .from('journal_entries')
      .select('id, title, body, mood, created_at')
      .eq('user_id', userId)
      .or(`title.ilike.%${keyword}%,body.ilike.%${keyword}%`)
      .order('created_at', { ascending: false })
  );
}

/**
 * Get a random active journal prompt to inspire the user.
 */
export async function getDailyPrompt() {
  const { data, error } = await supabase
    .from('journal_prompts')
    .select('id, prompt_text, category')
    .eq('is_active', true)
    .limit(20);

  if (error || !data?.length) return null;
  return data[Math.floor(Math.random() * data.length)];
}
