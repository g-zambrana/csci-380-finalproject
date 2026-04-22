// js/mood-tracker.js
import { supabase } from "./supabase.js";

// -----------------------------
// Sidebar / auth bootstrap
// -----------------------------
async function initSidebar() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    window.location.href = "/login";
    return null;
  }

  const user = data.user;

  const avatarEl = document.getElementById("avatar-initials");
  const nameEl = document.getElementById("sb-username");
  const emailEl = document.getElementById("sb-useremail");

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const fullName = profile?.full_name || user.email?.split("@")[0] || "User";
    const email = profile?.email || user.email || "";

    if (avatarEl) avatarEl.textContent = getInitials(fullName);
    if (nameEl) nameEl.textContent = fullName;
    if (emailEl) emailEl.textContent = email;
  } catch (err) {
    console.error("Sidebar load error:", err);

    const fallbackName = user.email?.split("@")[0] || "User";
    if (avatarEl) avatarEl.textContent = getInitials(fallbackName);
    if (nameEl) nameEl.textContent = fallbackName;
    if (emailEl) emailEl.textContent = user.email || "";
  }

  return user;
}

// -----------------------------
// Mood display helpers
// -----------------------------
const MOOD_LABELS = {
  1: "Very Low",
  2: "Low",
  3: "Down",
  4: "Not Great",
  5: "Okay",
  6: "Pretty Good",
  7: "Good",
  8: "Great",
  9: "Really Great",
  10: "Excellent",
};

const MOOD_EMOJIS = {
  1: "😞",
  2: "🙁",
  3: "😕",
  4: "😐",
  5: "🙂",
  6: "😊",
  7: "😄",
  8: "😁",
  9: "🤩",
  10: "🌟",
};

function sliderToMoodLabel(value) {
  const num = Number(value);
  return MOOD_LABELS[num] || "Okay";
}

function getInitials(name) {
  if (!name) return "?";

  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatEntryDate(entry) {
  const raw = entry.logged_at || entry.created_at || entry.entry_date;
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return entry.entry_date || "Unknown date";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// -----------------------------
// Local date helpers
// -----------------------------
// IMPORTANT:
// Do NOT use toISOString().split("T")[0] for "today" because that uses UTC
// and can flip to the next day in the evening for local users.
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

// -----------------------------
// Main app
// -----------------------------
const user = await initSidebar();
if (!user) {
  throw new Error("Not authenticated");
}

// DOM refs
const slider = document.getElementById("moodSlider");
const moodDisplay = document.getElementById("moodDisplay");
const energySlider = document.getElementById("energySlider");
const anxietySlider = document.getElementById("anxietySlider");
const sleepInput = document.getElementById("sleepHours");
const notesInput = document.getElementById("moodNotes");
const submitBtn = document.getElementById("submitMood");
const statusMsg = document.getElementById("statusMessage");
const historyList = document.getElementById("historyList");
const alreadyLogged = document.getElementById("alreadyLogged");
const logoutBtn = document.getElementById("logoutBtn");

// Safety checks
if (!slider || !moodDisplay || !submitBtn || !statusMsg || !historyList) {
  throw new Error("Missing required mood tracker HTML elements.");
}

// -----------------------------
// Logout
// -----------------------------
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  });
}

// -----------------------------
// UI render
// -----------------------------
function renderMoodDisplay() {
  const moodRating = Number(slider.value);
  const emoji = MOOD_EMOJIS[moodRating] || "🙂";
  const label = MOOD_LABELS[moodRating] || "Okay";

  moodDisplay.textContent = `${emoji} ${label}`;

  const pct = ((moodRating - 1) / 9) * 100;
  slider.style.background = `linear-gradient(to right, #3D6B35 ${pct}%, #ddd ${pct}%)`;
}

slider.addEventListener("input", renderMoodDisplay);
renderMoodDisplay();

// -----------------------------
// Database helpers
// -----------------------------
async function hasLoggedToday(userId) {
  const today = getLocalDateString();

  // Prefer entry_date because it represents the user's intended local day.
  const { data, error } = await supabase
    .from("mood_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("entry_date", today)
    .limit(1);

  if (error) throw error;

  return Array.isArray(data) && data.length > 0;
}

async function logMoodEntry({
  userId,
  moodRating,
  moodLabel,
  note,
  energyLevel,
  anxietyLevel,
  sleepHours,
}) {
  const today = getLocalDateString();

  const payload = {
    user_id: userId,
    mood_rating: moodRating,
    mood_label: moodLabel,
    note: note || null,
    entry_date: today,
    energy_level: energyLevel ?? null,
    anxiety_level: anxietyLevel ?? null,
    sleep_hours: sleepHours ?? null,
    logged_at: new Date().toISOString(), // keep full timestamp for history ordering
  };

  const { data, error } = await supabase
    .from("mood_entries")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function getMoodHistory(userId, limit = 14) {
  const { data, error } = await supabase
    .from("mood_entries")
    .select(
      "id, mood_rating, mood_label, note, entry_date, created_at, energy_level, anxiety_level, sleep_hours, logged_at"
    )
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}

// Optional fallback checker in case older rows do not have entry_date set correctly.
// Not required for normal use, but helpful if your table has mixed old data.
async function hasLoggedTodayByTimestamp(userId) {
  const { start, end } = getLocalDayBounds();

  const { data, error } = await supabase
    .from("mood_entries")
    .select("id")
    .eq("user_id", userId)
    .gte("logged_at", start.toISOString())
    .lt("logged_at", end.toISOString())
    .limit(1);

  if (error) throw error;

  return Array.isArray(data) && data.length > 0;
}

// -----------------------------
// Already logged today check
// -----------------------------
async function refreshTodayStatus() {
  let alreadyDone = false;

  try {
    alreadyDone = await hasLoggedToday(user.id);

    // Fallback for older records if needed
    if (!alreadyDone) {
      alreadyDone = await hasLoggedTodayByTimestamp(user.id);
    }
  } catch (err) {
    console.error("Could not check today's mood status:", err);
    alreadyDone = false;
  }

  if (alreadyDone) {
    if (alreadyLogged) alreadyLogged.style.display = "block";
    submitBtn.disabled = true;
    submitBtn.textContent = "Already logged today ✓";
  } else {
    if (alreadyLogged) alreadyLogged.style.display = "none";
    submitBtn.disabled = false;
    submitBtn.textContent = "Log Mood";
  }
}

await refreshTodayStatus();

// -----------------------------
// Submit mood
// -----------------------------
submitBtn.addEventListener("click", async () => {
  const moodRating = Number(slider.value);
  const moodLabel = sliderToMoodLabel(slider.value);
  const energyLevel = energySlider?.value ? Number(energySlider.value) : null;
  const anxietyLevel = anxietySlider?.value ? Number(anxietySlider.value) : null;
  const sleepHours = sleepInput?.value ? Number(sleepInput.value) : null;
  const note = notesInput?.value.trim() || "";

  submitBtn.disabled = true;
  statusMsg.textContent = "Saving…";
  statusMsg.style.color = "#7A7870";

  try {
    const alreadyLoggedToday =
      (await hasLoggedToday(user.id)) || (await hasLoggedTodayByTimestamp(user.id));

    if (alreadyLoggedToday) {
      statusMsg.textContent = "You already logged your mood today.";
      statusMsg.style.color = "#c0392b";
      submitBtn.textContent = "Already logged today ✓";
      if (alreadyLogged) alreadyLogged.style.display = "block";
      return;
    }

    await logMoodEntry({
      userId: user.id,
      moodRating,
      moodLabel,
      note,
      energyLevel,
      anxietyLevel,
      sleepHours,
    });

    statusMsg.textContent = "✓ Mood logged! Great job checking in.";
    statusMsg.style.color = "#3D6B35";
    submitBtn.textContent = "Logged today ✓";

    if (alreadyLogged) alreadyLogged.style.display = "block";

    await loadHistory();
    await refreshTodayStatus();
  } catch (err) {
    console.error("Mood submit error:", err);
    statusMsg.textContent = `Error: ${err.message}`;
    statusMsg.style.color = "#c0392b";
    submitBtn.disabled = false;
  }
});

// -----------------------------
// Load history
// -----------------------------
async function loadHistory() {
  historyList.innerHTML = '<p style="color:#999;font-size:13px;">Loading history…</p>';

  try {
    const logs = await getMoodHistory(user.id, 14);

    if (!logs.length) {
      historyList.innerHTML =
        '<p style="color:#999;font-size:13px;">No entries yet. Log your first mood above!</p>';
      return;
    }

    historyList.innerHTML = logs
      .map((log) => {
        const emoji = MOOD_EMOJIS[log.mood_rating] || "🙂";
        const label = log.mood_label || MOOD_LABELS[log.mood_rating] || "Mood logged";
        const dateText = formatEntryDate(log);
        const safeNote = log.note ? escHtml(log.note) : "";

        const extras = [
          log.energy_level != null ? `Energy: ${log.energy_level}/10` : null,
          log.anxiety_level != null ? `Anxiety: ${log.anxiety_level}/10` : null,
          log.sleep_hours != null ? `Sleep: ${log.sleep_hours} hrs` : null,
        ]
          .filter(Boolean)
          .join(" • ");

        return `
          <div class="history-entry">
            <span class="h-emoji">${emoji}</span>
            <div class="h-info">
              <strong>${escHtml(label)}</strong>
              <span class="h-date">${escHtml(dateText)}</span>
              ${extras ? `<span class="h-date">${escHtml(extras)}</span>` : ""}
              ${safeNote ? `<span class="h-note">${safeNote}</span>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Mood history error:", err);
    historyList.innerHTML = `<p style="color:#c0392b;font-size:13px;">${escHtml(err.message)}</p>`;
  }
}

await loadHistory();