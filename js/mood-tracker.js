
import { supabase } from "../supabase/supabase.js";

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
    const { data: profile } = await supabase
      .from("profile")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

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
  10: "Excellent"
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
  10: "🌟"
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
  const raw = entry.created_at || entry.entry_date;
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
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

// Safety checks
if (!slider || !moodDisplay || !submitBtn || !statusMsg || !historyList) {
  throw new Error("Missing required mood tracker HTML elements.");
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
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("mood_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("entry_date", today)
    .limit(1);

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

async function logMoodEntry({
  userId,
  moodRating,
  moodLabel,
  note
}) {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("mood_entries")
    .insert([
      {
        user_id: userId,
        mood_rating: moodRating,
        mood_label: moodLabel,
        note: note || null,
        entry_date: today
      }
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateProfileMoodExtras({
  userId,
  energyLevel,
  anxietyLevel,
  sleepHours
}) {
  // Based on the schema you pasted, these extra values are in "profile"
  const updateData = {
    updated_at: new Date().toISOString(),
    logged_at: new Date().toISOString()
  };

  if (energyLevel !== undefined) updateData.energy_level = energyLevel;
  if (anxietyLevel !== undefined) updateData.anxiety_level = anxietyLevel;
  if (sleepHours !== undefined) updateData.sleep_hours = sleepHours;

  const { error } = await supabase
    .from("profile")
    .update(updateData)
    .eq("id", userId);

  if (error) {
    throw error;
  }
}

async function getMoodHistory(userId, limit = 14) {
  const { data, error } = await supabase
    .from("mood_entries")
    .select("id, mood_rating, mood_label, note, entry_date, created_at")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

// -----------------------------
// Already logged today check
// -----------------------------
let alreadyDone = false;

try {
  alreadyDone = await hasLoggedToday(user.id);
} catch (err) {
  console.error("Could not check today's mood status:", err);
}

if (alreadyDone) {
  if (alreadyLogged) alreadyLogged.style.display = "block";
  submitBtn.disabled = true;
  submitBtn.textContent = "Already logged today ✓";
}

// -----------------------------
// Submit mood
// -----------------------------
submitBtn.addEventListener("click", async () => {
  const moodRating = Number(slider.value);
  const moodLabel = sliderToMoodLabel(slider.value);
  const energyLevel = energySlider?.value ? Number(energySlider.value) : undefined;
  const anxietyLevel = anxietySlider?.value ? Number(anxietySlider.value) : undefined;
  const sleepHours = sleepInput?.value ? Number(sleepInput.value) : undefined;
  const note = notesInput?.value.trim() || "";

  submitBtn.disabled = true;
  statusMsg.textContent = "Saving…";
  statusMsg.style.color = "#7A7870";

  try {
    const alreadyLoggedToday = await hasLoggedToday(user.id);

    if (alreadyLoggedToday) {
      statusMsg.textContent = "You already logged your mood today.";
      statusMsg.style.color = "#c0392b";
      submitBtn.textContent = "Already logged today ✓";
      if (alreadyLogged) alreadyLogged.style.display = "block";
      return;
    }

    // Save the actual mood entry
    await logMoodEntry({
      userId: user.id,
      moodRating,
      moodLabel,
      note
    });

    // Save extra values to profile, because that is where your pasted schema puts them
    try {
      await updateProfileMoodExtras({
        userId: user.id,
        energyLevel,
        anxietyLevel,
        sleepHours
      });
    } catch (profileErr) {
      console.error("Profile extras update failed:", profileErr);
      // Do not fail the whole mood log if the mood entry itself succeeded
    }

    statusMsg.textContent = "✓ Mood logged! Great job checking in.";
    statusMsg.style.color = "#3D6B35";
    submitBtn.textContent = "Logged today ✓";
    if (alreadyLogged) alreadyLogged.style.display = "block";

    await loadHistory();
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

    historyList.innerHTML = logs.map((log) => {
      const emoji = MOOD_EMOJIS[log.mood_rating] || "🙂";
      const label = log.mood_label || MOOD_LABELS[log.mood_rating] || "Mood logged";
      const dateText = formatEntryDate(log);
      const safeNote = log.note ? escHtml(log.note) : "";

      return `
        <div class="history-entry">
          <span class="h-emoji">${emoji}</span>
          <div class="h-info">
            <strong>${label}</strong>
            <span class="h-date">${dateText}</span>
            ${safeNote ? `<span class="h-note">${safeNote}</span>` : ""}
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Mood history error:", err);
    historyList.innerHTML = `<p style="color:#c0392b;font-size:13px;">${escHtml(err.message)}</p>`;
  }
}

await loadHistory();