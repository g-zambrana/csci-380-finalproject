// js/staff/therapist.js

import { supabase, requireAuth } from "../supabase.js";

const user = await requireAuth();
if (!user) throw new Error("Not authenticated");

const main = document.querySelector(".main");
const usersTableBody = document.querySelector("#users-table-body");
const appointmentsTableBody = document.querySelector("#appointments-table-body");
const alertList = document.querySelector("#alert-list");
const noteUserSelect = document.querySelector("#note-user");
const noteForm = document.querySelector("#quick-note-form");
const noteBody = document.querySelector("#note-body");
const previousNotesList = document.querySelector("#previous-notes-list");

const avgMoodEl = document.querySelector("#avg-mood");
const avgSleepEl = document.querySelector("#avg-sleep");
const highAnxietyCountEl = document.querySelector("#high-anxiety-count");
const notesTodayCountEl = document.querySelector("#notes-today-count");

const logoutBtn = document.querySelector("#logoutBtn");
const sbUsername = document.querySelector("#sb-username");
const sbUserEmail = document.querySelector("#sb-useremail");
const avatarInitials = document.querySelector("#avatar-initials");
const todayDate = document.querySelector("#today-date");

let therapistProfile = null;
let therapistRow = null;
let therapistId = null;
let patientIds = [];
let allPatients = [];

initTherapistPage();

async function initTherapistPage() {
  setTodayDate();

  therapistProfile = await loadCurrentProfile();
  await guardTherapistAccess(therapistProfile);

  therapistRow = await loadTherapistRow();

  if (!therapistRow) {
    showMissingTherapistRow();
    setupLogout();
    return;
  }

  therapistId = therapistRow.id;

  patientIds = await loadPatientIdsForTherapist();
  allPatients = await loadPatients();

  await Promise.all([
    renderUsersTable(),
    renderAppointments(),
    renderAlerts(),
    renderCareSnapshot(),
    renderPreviousNotes(),
  ]);

  populateNoteUserDropdown();
  setupQuickNoteForm();
  setupSearchAndFilter();
  setupLogout();
}

function setTodayDate() {
  if (!todayDate) return;

  todayDate.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function loadCurrentProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email, role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error loading therapist profile:", error);
    return null;
  }

  const name = getProfileName(data, "Therapist");

  if (sbUsername) sbUsername.textContent = name;
  if (sbUserEmail) sbUserEmail.textContent = data.email || user.email;
  if (avatarInitials) avatarInitials.textContent = getInitials(name);

  return data;
}

async function guardTherapistAccess(profile) {
  const allowedStaffPortalRoles = ["staff", "admin", "therapist"];

  if (!profile || !allowedStaffPortalRoles.includes(profile.role)) {
    window.location.href = "/home";
    return;
  }

  if (profile.role !== "therapist") {
    if (main) {
      main.innerHTML = `
        <div class="page-header">
          <div>
            <div class="page-greet">Therapist Access Required</div>
            <div class="page-date">Only therapists can view therapist patient data.</div>
          </div>

          <div class="header-actions">
            <button class="btn-logout" id="restrictedLogoutBtn">Sign out</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Only Therapists Can View This Page</div>
          </div>

          <p style="font-size: 14px; color: var(--muted); line-height: 1.6;">
            Your account is allowed to access the staff portal, but this specific page only displays data for therapist accounts.
          </p>
        </div>
      `;

      const restrictedLogoutBtn = document.querySelector("#restrictedLogoutBtn");

      if (restrictedLogoutBtn) {
        restrictedLogoutBtn.addEventListener("click", async () => {
          await supabase.auth.signOut();
          window.location.href = "/login";
        });
      }
    }

    throw new Error("Only therapists can view therapist patient data.");
  }
}

async function loadTherapistRow() {
  const { data, error } = await supabase
    .from("therapists")
    .select("id, user_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error loading therapist row:", error);
    return null;
  }

  return data;
}

async function loadPatientIdsForTherapist() {
  const { data, error } = await supabase
    .from("appointments")
    .select("user_id")
    .eq("therapist_id", therapistId)
    .in("status", ["scheduled", "completed", "cancelled", "no_show", "pending"])
    .not("user_id", "is", null);

  if (error) {
    console.error("Error loading therapist patients:", error);
    return [];
  }

  return [...new Set((data || []).map((appt) => appt.user_id))];
}

async function loadPatients() {
  if (!patientIds.length) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email, energy_level, anxiety_level, sleep_hours, logged_at")
    .in("id", patientIds)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error loading patient profiles:", error);
    return [];
  }

  return data || [];
}

async function renderUsersTable(filteredPatients = allPatients) {
  if (!filteredPatients.length) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="5">No patients found for this therapist.</td>
      </tr>
    `;
    return;
  }

  usersTableBody.innerHTML = filteredPatients
    .map((patient) => {
      const name = getProfileName(patient);

      return `
        <tr>
          <td>${escapeHTML(name)}</td>
          <td>${escapeHTML(patient.email || "No email")}</td>
          <td>${formatHealthValue(patient.energy_level)}</td>
          <td>${formatHealthValue(patient.anxiety_level)}</td>
          <td>${formatSleep(patient.sleep_hours)}</td>
        </tr>
      `;
    })
    .join("");
}

async function renderAppointments() {
  const now = new Date().toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, user_id, therapist_id, scheduled_at, status, format")
    .eq("therapist_id", therapistId)
    .gte("scheduled_at", now)
    .in("status", ["scheduled", "pending"])
    .order("scheduled_at", { ascending: true })
    .limit(8);

  if (error) {
    console.error("Error loading upcoming appointments:", error);
    appointmentsTableBody.innerHTML = `
      <tr>
        <td colspan="3">Could not load appointments.</td>
      </tr>
    `;
    return;
  }

  if (!appointments.length) {
    appointmentsTableBody.innerHTML = `
      <tr>
        <td colspan="3">No upcoming appointments.</td>
      </tr>
    `;
    return;
  }

  const therapistName = getProfileName(therapistProfile, "Current therapist");

  appointmentsTableBody.innerHTML = appointments
    .map((appointment) => {
      const dateObj = new Date(appointment.scheduled_at);

      return `
        <tr>
          <td>${escapeHTML(therapistName)}</td>
          <td>${formatDate(appointment.scheduled_at)}</td>
          <td>${formatTime(dateObj)}</td>
        </tr>
      `;
    })
    .join("");
}

async function renderAlerts() {
  if (!patientIds.length) {
    alertList.innerHTML = `
      <div class="alert-item">
        <div class="alert-body">No patient alerts.</div>
      </div>
    `;
    return;
  }

  const { data, error } = await supabase
    .from("mood_entries")
    .select("user_id, mood_rating, mood_label, note, entry_date, created_at")
    .in("user_id", patientIds)
    .lte("mood_rating", 3)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error loading alerts:", error);
    alertList.innerHTML = `
      <div class="alert-item">
        <div class="alert-body">Could not load alerts.</div>
      </div>
    `;
    return;
  }

  if (!data.length) {
    alertList.innerHTML = `
      <div class="alert-item">
        <div class="alert-body">No open mood alerts.</div>
      </div>
    `;
    return;
  }

  alertList.innerHTML = data
    .map((entry) => {
      const patient = allPatients.find((p) => p.id === entry.user_id);
      const name = getProfileName(patient, "Unknown patient");

      return `
        <div class="alert-item">
          <div class="alert-head">
            <div class="alert-title">${escapeHTML(name)}</div>
            <div class="small-time">${formatDate(entry.entry_date)}</div>
          </div>
          <div class="alert-body">
            Low mood rating logged: ${entry.mood_rating}/10.
            ${entry.note ? escapeHTML(entry.note) : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

async function renderCareSnapshot() {
  if (!patientIds.length) {
    avgMoodEl.textContent = "--";
    avgSleepEl.textContent = "--";
    highAnxietyCountEl.textContent = "0";
    notesTodayCountEl.textContent = "0";
    return;
  }

  const today = getTodayDateString();

  const { data: moods, error: moodError } = await supabase
    .from("mood_entries")
    .select("user_id, mood_rating, created_at")
    .in("user_id", patientIds);

  if (moodError) {
    console.error("Error loading mood snapshot:", moodError);
  }

  const validMoodRatings = (moods || [])
    .map((entry) => Number(entry.mood_rating))
    .filter((rating) => !Number.isNaN(rating));

  const avgMood = calculateAverage(validMoodRatings);

  const sleepValues = allPatients
    .map((patient) => Number(patient.sleep_hours))
    .filter((sleep) => !Number.isNaN(sleep));

  const avgSleep = calculateAverage(sleepValues);

  const highAnxietyCount = allPatients.filter(
    (patient) => Number(patient.anxiety_level) >= 7
  ).length;

  const { data: notesToday, error: notesError } = await supabase
    .from("staff_notes")
    .select("id, user_id, created_at")
    .eq("staff_id", user.id)
    .in("user_id", patientIds)
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);

  if (notesError) {
    console.error("Error loading today's notes:", notesError);
  }

  avgMoodEl.textContent = avgMood !== null ? avgMood.toFixed(1) : "--";
  avgSleepEl.textContent = avgSleep !== null ? `${avgSleep.toFixed(1)}h` : "--";
  highAnxietyCountEl.textContent = highAnxietyCount;
  notesTodayCountEl.textContent = notesToday?.length || 0;
}

function populateNoteUserDropdown() {
  if (!allPatients.length) {
    noteUserSelect.innerHTML = `<option value="">No patients available</option>`;
    return;
  }

  noteUserSelect.innerHTML = `
    <option value="">Select user</option>
    ${allPatients
      .map((patient) => {
        const name = getProfileName(patient);
        return `<option value="${patient.id}">${escapeHTML(name)}</option>`;
      })
      .join("")}
  `;
}

function setupQuickNoteForm() {
  noteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedUserId = noteUserSelect.value;
    const note = noteBody.value.trim();

    if (!selectedUserId || !note) {
      alert("Please select a user and write a note.");
      return;
    }

    if (!patientIds.includes(selectedUserId)) {
      alert("You can only add notes for your own patients.");
      return;
    }

    const latestAppointment = await getLatestAppointmentForPatient(selectedUserId);

    const { error } = await supabase.from("staff_notes").insert({
      staff_id: user.id,
      user_id: selectedUserId,
      appointment_id: latestAppointment?.id || null,
      note,
    });

    if (error) {
      console.error("Error saving therapist note:", error);
      alert("Could not save note.");
      return;
    }

    await supabase.from("staff_actions_log").insert({
      staff_id: user.id,
      action_type: "therapist_note_added",
      target_id: selectedUserId,
      description: "A therapist note was added for a patient.",
    });

    noteBody.value = "";
    noteUserSelect.value = "";

    await Promise.all([renderPreviousNotes(), renderCareSnapshot()]);
    alert("Note saved.");
  });
}

async function getLatestAppointmentForPatient(patientId) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, user_id, therapist_id, scheduled_at")
    .eq("therapist_id", therapistId)
    .eq("user_id", patientId)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error loading latest appointment:", error);
    return null;
  }

  return data;
}

async function renderPreviousNotes() {
  if (!patientIds.length) {
    previousNotesList.innerHTML = `
      <div class="note-item">
        <div class="note-body">No previous notes available.</div>
      </div>
    `;
    return;
  }

  const { data, error } = await supabase
    .from("staff_notes")
    .select("id, user_id, note, created_at")
    .eq("staff_id", user.id)
    .in("user_id", patientIds)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Error loading previous notes:", error);
    previousNotesList.innerHTML = `
      <div class="note-item">
        <div class="note-body">Could not load previous notes.</div>
      </div>
    `;
    return;
  }

  if (!data.length) {
    previousNotesList.innerHTML = `
      <div class="note-item">
        <div class="note-body">No previous notes yet.</div>
      </div>
    `;
    return;
  }

  previousNotesList.innerHTML = data
    .map((note) => {
      const patient = allPatients.find((p) => p.id === note.user_id);
      const name = getProfileName(patient, "Unknown patient");

      return `
        <div class="note-item">
          <div class="note-head">
            <div class="note-title">${escapeHTML(name)}</div>
            <div class="small-time">${timeAgo(note.created_at)}</div>
          </div>
          <div class="note-body">${escapeHTML(note.note)}</div>
        </div>
      `;
    })
    .join("");
}

function setupSearchAndFilter() {
  const searchInput = document.querySelector("#user-search");
  const filterSelect = document.querySelector("#user-filter");

  if (!searchInput || !filterSelect) return;

  function applyFilters() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const filter = filterSelect.value;

    let filtered = [...allPatients];

    if (searchTerm) {
      filtered = filtered.filter((patient) => {
        const name = getProfileName(patient).toLowerCase();
        const email = (patient.email || "").toLowerCase();

        return name.includes(searchTerm) || email.includes(searchTerm);
      });
    }

    if (filter === "high-anxiety") {
      filtered = filtered.filter((patient) => Number(patient.anxiety_level) >= 7);
    }

    if (filter === "low-energy") {
      filtered = filtered.filter((patient) => Number(patient.energy_level) <= 3);
    }

    if (filter === "low-sleep") {
      filtered = filtered.filter((patient) => Number(patient.sleep_hours) < 6);
    }

    renderUsersTable(filtered);
  }

  searchInput.addEventListener("input", applyFilters);
  filterSelect.addEventListener("change", applyFilters);
}

function setupLogout() {
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  });
}

function showMissingTherapistRow() {
  usersTableBody.innerHTML = `
    <tr>
      <td colspan="5">No therapist profile was found for this account.</td>
    </tr>
  `;

  appointmentsTableBody.innerHTML = `
    <tr>
      <td colspan="3">No therapist profile was found.</td>
    </tr>
  `;

  alertList.innerHTML = `
    <div class="alert-item">
      <div class="alert-body">No alerts available.</div>
    </div>
  `;

  previousNotesList.innerHTML = `
    <div class="note-item">
      <div class="note-body">No notes available.</div>
    </div>
  `;

  avgMoodEl.textContent = "--";
  avgSleepEl.textContent = "--";
  highAnxietyCountEl.textContent = "--";
  notesTodayCountEl.textContent = "--";

  noteUserSelect.innerHTML = `<option value="">No patients available</option>`;
}

function getProfileName(profile, fallback = "Unnamed User") {
  if (!profile) return fallback;

  return (
    profile.display_name?.trim() ||
    profile.full_name?.trim() ||
    profile.email?.split("@")[0]?.replace(/[._]/g, " ") ||
    fallback
  );
}

function getInitials(name) {
  return String(name || "TH")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatHealthValue(value) {
  if (value === null || value === undefined || value === "") return "--";
  return escapeHTML(value);
}

function formatSleep(value) {
  if (value === null || value === undefined || value === "") return "--";
  return `${escapeHTML(value)}h`;
}

function calculateAverage(values) {
  if (!values.length) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateValue) {
  if (!dateValue) return "N/A";

  return new Date(dateValue).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateObj) {
  return dateObj.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(dateValue) {
  const date = new Date(dateValue);
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}