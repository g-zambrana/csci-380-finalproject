// js/journal.js
// Controller for pages/self-reflection.html — Supabase-connected journal.

import { requireAuth }  from './supabase.js';
import {
  createEntry, getEntries, deleteEntry, getDailyPrompt,
} from './services/journalService.js';
import { MOOD_LABELS, MOOD_EMOJIS, sliderToMood } from './services/moodService.js';
import { initSidebar } from './sidebar.js';

const user = await initSidebar();
if (!user) throw new Error('Not authenticated');

// ── DOM refs ──────────────────────────────────────────────────
const titleInput   = document.getElementById('entryTitle');
const bodyInput    = document.getElementById('entryBody');
const moodSelect   = document.getElementById('entryMood');
const submitBtn    = document.getElementById('submitEntry');
const statusMsg    = document.getElementById('statusMessage');
const promptBox    = document.getElementById('promptBox');
const promptText   = document.getElementById('promptText');
const charCount    = document.getElementById('charCount');
const wordCount    = document.getElementById('wordCount');

// ── Load a daily prompt ───────────────────────────────────────
try {
  const prompt = await getDailyPrompt();
  if (prompt) {
    promptText.textContent = prompt.prompt_text;
    promptBox.style.display = 'flex';
    document.getElementById('usePromptBtn').addEventListener('click', () => {
      bodyInput.value = '';
      bodyInput.placeholder = prompt.prompt_text;
      bodyInput.focus();
    });
  }
} catch (_) { /* prompts table may be empty — silently skip */ }

// ── Live word / char count ────────────────────────────────────
bodyInput.addEventListener('input', () => {
  const text  = bodyInput.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  charCount.textContent = `${text.length} chars`;
  wordCount.textContent = `${words} words`;
});

// ── Submit entry ──────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  const body = bodyInput.value.trim();
  if (!body) { statusMsg.textContent = 'Please write something before saving.'; return; }

  submitBtn.disabled    = true;
  statusMsg.textContent = 'Saving…';
  statusMsg.style.color = '';

  try {
    await createEntry({
      userId: user.id,
      body,
      title:  titleInput.value.trim() || undefined,
      mood:   moodSelect.value || undefined,
    });

    statusMsg.textContent  = '✓ Entry saved!';
    statusMsg.style.color  = '#3D6B35';
    titleInput.value       = '';
    bodyInput.value        = '';
    moodSelect.value       = '';
    charCount.textContent  = '0 chars';
    wordCount.textContent  = '0 words';

    loadEntries();
  } catch (err) {
    statusMsg.textContent  = `Error: ${err.message}`;
    statusMsg.style.color  = '#c0392b';
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Load existing entries ─────────────────────────────────────
const entriesList = document.getElementById('entriesList');
const searchInput = document.getElementById('searchInput');

async function loadEntries(filter = '') {
  entriesList.innerHTML = '<p class="loading-text">Loading entries…</p>';
  try {
    const entries = await getEntries(user.id, 50);
    const filtered = filter
      ? entries.filter(e =>
          (e.title ?? '').toLowerCase().includes(filter) ||
          (e.body  ?? '').toLowerCase().includes(filter))
      : entries;

    if (!filtered.length) {
      entriesList.innerHTML = '<p class="loading-text">No entries yet. Write your first one above!</p>';
      return;
    }

    entriesList.innerHTML = filtered.map(e => `
      <div class="entry-card" data-id="${e.id}">
        <div class="entry-header">
          <div>
            <div class="entry-title">${escHtml(e.title || 'Untitled entry')}</div>
            <div class="entry-meta">
              ${e.mood ? `<span>${MOOD_EMOJIS[e.mood]} ${MOOD_LABELS[e.mood]}</span> · ` : ''}
              ${new Date(e.created_at).toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric', year:'numeric' })}
              · ${e.word_count ?? 0} words
            </div>
          </div>
          <button class="btn-delete" data-id="${e.id}" title="Delete entry">✕</button>
        </div>
        <div class="entry-preview">${escHtml(e.body.slice(0, 200))}${e.body.length > 200 ? '…' : ''}</div>
      </div>
    `).join('');

    // Wire delete buttons
    entriesList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!confirm('Delete this entry? This cannot be undone.')) return;
        try {
          await deleteEntry(btn.dataset.id);
          loadEntries(searchInput.value.trim().toLowerCase());
        } catch (err) {
          alert(`Delete failed: ${err.message}`);
        }
      });
    });
  } catch (err) {
    entriesList.innerHTML = `<p style="color:#c0392b;font-size:13px;">${err.message}</p>`;
  }
}

searchInput.addEventListener('input', () => {
  loadEntries(searchInput.value.trim().toLowerCase());
});

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadEntries();
