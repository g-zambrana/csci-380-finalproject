// js/mood-tracker.js
// Controller for pages/mood-tracker.html — Supabase-connected mood logging.

import { logMood, getMoodHistory, hasLoggedToday, sliderToMood, MOOD_LABELS, MOOD_EMOJIS } from './services/moodService.js';
import { initSidebar } from './sidebar.js';

const user = await initSidebar();
if (!user) throw new Error('Not authenticated');

// ── DOM refs ──────────────────────────────────────────────────
const slider      = document.getElementById('moodSlider');
const moodDisplay = document.getElementById('moodDisplay');
const energySlider   = document.getElementById('energySlider');
const anxietySlider  = document.getElementById('anxietySlider');
const sleepInput     = document.getElementById('sleepHours');
const notesInput     = document.getElementById('moodNotes');
const submitBtn      = document.getElementById('submitMood');
const statusMsg      = document.getElementById('statusMessage');
const historyList    = document.getElementById('historyList');
const alreadyLogged  = document.getElementById('alreadyLogged');

// ── Update mood display as slider moves ───────────────────────
function renderMoodDisplay() {
  const mood  = sliderToMood(slider.value);
  const emoji = MOOD_EMOJIS[mood];
  const label = MOOD_LABELS[mood];
  moodDisplay.textContent = `${emoji} ${label}`;

  // Colour the slider track
  const pct = ((slider.value - 1) / 9) * 100;
  slider.style.background = `linear-gradient(to right, #3D6B35 ${pct}%, #ddd ${pct}%)`;
}

slider.addEventListener('input', renderMoodDisplay);
renderMoodDisplay();

// ── Check if already logged today ────────────────────────────
let alreadyDone = false;
try {
  alreadyDone = await hasLoggedToday(user.id);
} catch (_) {
  // If mood_logs is temporarily inaccessible, let the user try to log anyway.
  // The logMood call itself will surface any real error via the status message.
}
if (alreadyDone) {
  alreadyLogged.style.display = 'block';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Already logged today ✓';
}

// ── Submit mood ───────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  submitBtn.disabled = true;
  statusMsg.textContent = 'Saving…';

  try {
    await logMood({
      userId:       user.id,
      mood:         sliderToMood(slider.value),
      energyLevel:  energySlider.value  ? Number(energySlider.value)  : undefined,
      anxietyLevel: anxietySlider.value ? Number(anxietySlider.value) : undefined,
      sleepHours:   sleepInput.value    ? Number(sleepInput.value)    : undefined,
      notes:        notesInput.value.trim() || undefined,
    });

    statusMsg.textContent    = '✓ Mood logged! Great job checking in.';
    statusMsg.style.color    = '#3D6B35';
    submitBtn.textContent    = 'Logged today ✓';
    alreadyLogged.style.display = 'block';

    // Refresh history
    loadHistory();
  } catch (err) {
    statusMsg.textContent  = `Error: ${err.message}`;
    statusMsg.style.color  = '#c0392b';
    submitBtn.disabled     = false;
  }
});

// ── Load mood history ─────────────────────────────────────────
async function loadHistory() {
  historyList.innerHTML = '<p style="color:#999;font-size:13px;">Loading history…</p>';
  try {
    const logs = await getMoodHistory(user.id, 14);

    if (!logs.length) {
      historyList.innerHTML = '<p style="color:#999;font-size:13px;">No entries yet. Log your first mood above!</p>';
      return;
    }

    historyList.innerHTML = logs.map(log => `
      <div class="history-entry">
        <span class="h-emoji">${MOOD_EMOJIS[log.mood]}</span>
        <div class="h-info">
          <strong>${MOOD_LABELS[log.mood]}</strong>
          <span class="h-date">${new Date(log.logged_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</span>
          ${log.notes ? `<span class="h-note">${escHtml(log.notes)}</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    historyList.innerHTML = `<p style="color:#c0392b;font-size:13px;">${err.message}</p>`;
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadHistory();
