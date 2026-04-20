// js/services/journalService.js
// Browser-compatible journal service for MindBloom.
// Interacts with: public.journal_entries, public.journal_prompts

import { supabase, query } from '../supabase.js';

/**
 * Count words safely.
 */
function countWords(text = '') {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

/**
 * Create a new journal entry.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.body
 * @param {string} [params.title]
 * @param {'very_bad'|'bad'|'neutral'|'good'|'very_good'} [params.mood]
 */
export async function createEntry({ userId, body, title, mood }) {
  const cleanBody = body?.trim() ?? '';

  return query(
    supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        title: title?.trim() || null,
        body: cleanBody,
        mood: mood || null,
        word_count: countWords(cleanBody),
        entry_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single()
  );
}

/**
 * Update an existing entry.
 *
 * @param {string} entryId
 * @param {object} updates
 */
export async function updateEntry(entryId, updates) {
  const patch = {};

  if ('title' in updates) {
    patch.title = updates.title?.trim() || null;
  }

  if ('body' in updates) {
    const cleanBody = updates.body?.trim() ?? '';
    patch.body = cleanBody;
    patch.word_count = countWords(cleanBody);
  }

  if ('mood' in updates) {
    patch.mood = updates.mood || null;
  }

  if ('entry_date' in updates) {
    patch.entry_date = updates.entry_date || null;
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
 *
 * @param {string} entryId
 */
export async function deleteEntry(entryId) {
  return query(
    supabase
      .from('journal_entries')
      .delete()
      .eq('id', entryId)
  );
}

/**
 * Get all entries for a user, newest first.
 *
 * @param {string} userId
 * @param {number} [limit=50]
 */
export async function getEntries(userId, limit = 50) {
  return query(
    supabase
      .from('journal_entries')
      .select('id, title, body, mood, entry_date, word_count, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

/**
 * Get a single entry by ID.
 *
 * @param {string} entryId
 */
export async function getEntry(entryId) {
  return query(
    supabase
      .from('journal_entries')
      .select('*')
      .eq('id', entryId)
      .single()
  );
}

/**
 * Search entries by title/body for a specific user.
 *
 * @param {string} userId
 * @param {string} keyword
 */
export async function searchEntries(userId, keyword) {
  const cleanKeyword = keyword?.trim() ?? '';

  return query(
    supabase
      .from('journal_entries')
      .select('id, title, body, mood, entry_date, word_count, created_at')
      .eq('user_id', userId)
      .or(`title.ilike.%${cleanKeyword}%,body.ilike.%${cleanKeyword}%`)
      .order('created_at', { ascending: false })
  );
}

/**
 * Get a random active journal prompt.
 * Returns null if the table does not exist or no prompt is available.
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