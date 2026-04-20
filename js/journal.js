// js/journal.js
// Controller for pages/self-reflection.html — Supabase-connected journal.

import { supabase, requireAuth, query } from './supabase.js';
import {
  createEntry,
  getEntries,
  deleteEntry,
  getDailyPrompt,
} from './services/journalService.js';

// --------------------------------------------------
// Auth
// --------------------------------------------------
const user = await requireAuth();
if (!user) {
  throw new Error('Not authenticated');
}

// --------------------------------------------------
// DOM refs
// --------------------------------------------------
const titleInput = document.getElementById('entryTitle');
const bodyInput = document.getElementById('entryBody');
const moodSelect = document.getElementById('entryMood');
const submitBtn = document.getElementById('submitEntry');
const statusMsg = document.getElementById('statusMessage');

const promptBox = document.getElementById('promptBox');
const promptText = document.getElementById('promptText');
const usePromptBtn = document.getElementById('usePromptBtn');

const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');

const entriesList = document.getElementById('entriesList');
const searchInput = document.getElementById('searchInput');

const logoutBtn = document.getElementById('logoutBtn');

const avatarInitials = document.getElementById('avatar-initials');
const sbUsername = document.getElementById('sb-username');
const sbUseremail = document.getElementById('sb-useremail');

// --------------------------------------------------
// Mood display maps
// --------------------------------------------------
const MOOD_LABELS = {
  very_bad: 'Very Bad',
  bad: 'Bad',
  neutral: 'Neutral',
  good: 'Good',
  very_good: 'Very Good',
};

const MOOD_EMOJIS = {
  very_bad: '😢',
  bad: '😕',
  neutral: '😐',
  good: '🙂',
  very_good: '😄',
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function countWords(text = '') {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function updateCounts() {
  const text = bodyInput.value;
  charCount.textContent = `${text.length} chars`;
  wordCount.textContent = `${countWords(text)} words`;
}

function setStatus(message, color = '') {
  statusMsg.textContent = message;
  statusMsg.style.color = color;
}

function formatEntryDate(entry) {
  const rawDate = entry.entry_date || entry.created_at;
  if (!rawDate) return 'Unknown date';

  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return 'Unknown date';

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(part => part[0].toUpperCase()).join('');
  }

  if (email) return email.charAt(0).toUpperCase();
  return '?';
}

// --------------------------------------------------
// Sidebar user info
// --------------------------------------------------
async function loadSidebarProfile() {
  try {
    const profile = await query(
      supabase
        .from('profile')
        .select('full_name, email')
        .eq('id', user.id)
        .maybeSingle()
    );

    const fullName = profile?.full_name || user.user_metadata?.full_name || 'User';
    const email = profile?.email || user.email || '';

    sbUsername.textContent = fullName;
    sbUseremail.textContent = email;
    avatarInitials.textContent = getInitials(fullName, email);
  } catch (err) {
    console.error('Failed to load sidebar profile:', err);

    const fallbackName = user.user_metadata?.full_name || 'User';
    const fallbackEmail = user.email || '';

    sbUsername.textContent = fallbackName;
    sbUseremail.textContent = fallbackEmail;
    avatarInitials.textContent = getInitials(fallbackName, fallbackEmail);
  }
}

// --------------------------------------------------
// Prompt
// --------------------------------------------------
async function loadPrompt() {
  try {
    const prompt = await getDailyPrompt();

    if (!prompt) {
      promptBox.style.display = 'none';
      return;
    }

    promptText.textContent = prompt.prompt_text;
    promptBox.style.display = 'flex';

    usePromptBtn.addEventListener('click', () => {
      if (!bodyInput.value.trim()) {
        bodyInput.value = `${prompt.prompt_text}\n\n`;
      } else {
        bodyInput.value += `\n\n${prompt.prompt_text}\n\n`;
      }

      bodyInput.focus();
      updateCounts();
    });
  } catch (err) {
    console.warn('Prompt could not be loaded:', err);
    promptBox.style.display = 'none';
  }
}

// --------------------------------------------------
// Save entry
// --------------------------------------------------
submitBtn.addEventListener('click', async () => {
  const body = bodyInput.value.trim();

  if (!body) {
    setStatus('Please write something before saving.', '#c0392b');
    return;
  }

  submitBtn.disabled = true;
  setStatus('Saving...', '');

  try {
    await createEntry({
      userId: user.id,
      title: titleInput.value.trim(),
      body,
      mood: moodSelect.value || null,
    });

    setStatus('✓ Entry saved!', '#3D6B35');

    titleInput.value = '';
    bodyInput.value = '';
    moodSelect.value = '';
    updateCounts();

    await loadEntries(searchInput.value.trim().toLowerCase());
  } catch (err) {
    console.error('Save failed:', err);
    setStatus(`Error: ${err.message}`, '#c0392b');
  } finally {
    submitBtn.disabled = false;
  }
});

// --------------------------------------------------
// Load + render entries
// --------------------------------------------------
async function loadEntries(filter = '') {
  entriesList.innerHTML = '<p class="loading-text">Loading entries...</p>';

  try {
    const entries = await getEntries(user.id, 100);

    const filtered = filter
      ? entries.filter(entry => {
          const title = (entry.title || '').toLowerCase();
          const body = (entry.body || '').toLowerCase();
          const mood = (entry.mood || '').toLowerCase();

          return (
            title.includes(filter) ||
            body.includes(filter) ||
            mood.includes(filter)
          );
        })
      : entries;

    if (!filtered.length) {
      entriesList.innerHTML = '<p class="loading-text">No entries yet. Write your first one above!</p>';
      return;
    }

    entriesList.innerHTML = filtered.map(entry => {
      const preview =
        entry.body && entry.body.length > 200
          ? `${escHtml(entry.body.slice(0, 200))}…`
          : escHtml(entry.body || '');

      return `
        <div class="entry-card" data-id="${entry.id}">
          <div class="entry-header">
            <div>
              <div class="entry-title">${escHtml(entry.title || 'Untitled entry')}</div>
              <div class="entry-meta">
                ${
                  entry.mood && MOOD_LABELS[entry.mood]
                    ? `<span>${MOOD_EMOJIS[entry.mood]} ${MOOD_LABELS[entry.mood]}</span> · `
                    : ''
                }
                ${formatEntryDate(entry)} · ${entry.word_count ?? 0} words
              </div>
            </div>
            <button class="btn-delete" data-id="${entry.id}" title="Delete entry">✕</button>
          </div>
          <div class="entry-preview">${preview}</div>
        </div>
      `;
    }).join('');

    entriesList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();

        const entryId = btn.dataset.id;
        if (!entryId) return;

        const confirmed = window.confirm('Delete this entry? This cannot be undone.');
        if (!confirmed) return;

        try {
          await deleteEntry(entryId);
          await loadEntries(searchInput.value.trim().toLowerCase());
        } catch (err) {
          console.error('Delete failed:', err);
          alert(`Delete failed: ${err.message}`);
        }
      });
    });
  } catch (err) {
    console.error('Failed to load entries:', err);
    entriesList.innerHTML = `<p style="color:#c0392b;font-size:13px;">${escHtml(err.message)}</p>`;
  }
}

// --------------------------------------------------
// Search
// --------------------------------------------------
searchInput.addEventListener('input', () => {
  loadEntries(searchInput.value.trim().toLowerCase());
});

// --------------------------------------------------
// Live counts
// --------------------------------------------------
bodyInput.addEventListener('input', updateCounts);

// --------------------------------------------------
// Logout
// --------------------------------------------------
logoutBtn.addEventListener('click', async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    window.location.href = '/login';
  }
});

// --------------------------------------------------
// Init
// --------------------------------------------------
updateCounts();
await loadSidebarProfile();
await loadPrompt();
await loadEntries();