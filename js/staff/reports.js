// js/staff/reports.js

import { supabase, requireAuth } from "../supabase.js";

const user = await requireAuth();
const STAFF_LOGIN_PATH = "/pages/staff/login.html";
if (!user) throw new Error("Not authenticated");

const usersTableBody = document.querySelector("#users-table-body");
const appointmentsTableBody = document.querySelector("#appointments-table-body");
const activityList = document.querySelector("#activity-list");
const alertList = document.querySelector("#alert-list");
const noteUserSelect = document.querySelector("#note-user");
const noteForm = document.querySelector("#quick-note-form");
const noteBody = document.querySelector("#note-body");
const recentNotesList = document.querySelector("#recent-notes-list");
const logoutBtn = document.getElementById("logoutBtn");

const sbUsername = document.querySelector("#sb-username");
const sbUserEmail = document.querySelector("#sb-useremail");
const avatarInitials = document.querySelector("#avatar-initials");
const todayDate = document.querySelector("#today-date");

let allClients = [];
let noteRecipients = [];

initReports();

async function initReports() {
  setTodayDate();

  const staffProfile = await loadStaffProfile();
  await guardStaffAccess(staffProfile);

  allClients = await loadClients();
  noteRecipients = await loadNoteRecipients();

  await Promise.all([
    renderUsersTable(),
    renderAppointments(),
    renderActivity(),
    renderAlerts(),
    renderRecentNotes(),
  ]);

  populateNoteUserDropdown();
  setupQuickNoteForm();
  setupLogout();
}

function setTodayDate() {
  todayDate.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function loadStaffProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email, role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error loading staff profile:", error);
    return null;
  }

  const name = data.display_name || data.full_name || "Staff Member";

  sbUsername.textContent = name;
  sbUserEmail.textContent = data.email || user.email;
  avatarInitials.textContent = getInitials(name);

  return data;
}

async function guardStaffAccess(profile) {
  const allowedRoles = ["staff", "admin", "therapist"];

  if (!profile || !allowedRoles.includes(profile.role)) {
    alert("You do not have permission to view this page.");
    window.location.href = "/home";
  }
}

async function loadClients() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email, created_at, role")
    .eq("role", "user")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading clients:", error);
    return [];
  }

  return data || [];
}

async function renderUsersTable() {
  const { data: moods, error } = await supabase
    .from("mood_entries")
    .select("user_id, entry_date, created_at, mood_rating")
    .order("entry_date", { ascending: false });

  if (error) {
    console.error("Error loading mood entries:", error);
  }

  const latestMoodByUser = {};

  (moods || []).forEach((entry) => {
    if (!latestMoodByUser[entry.user_id]) {
      latestMoodByUser[entry.user_id] = entry;
    }
  });

  if (!allClients.length) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="4">No users found.</td>
      </tr>
    `;
    return;
  }

  usersTableBody.innerHTML = allClients
    .map((client) => {
      const name = client.display_name || client.full_name || "Unnamed User";
      const latestMood = latestMoodByUser[client.id];

      return `
        <tr>
          <td>${escapeHTML(name)}</td>
          <td>${escapeHTML(client.email || "No email")}</td>
          <td>${formatDate(client.created_at)}</td>
          <td>${latestMood ? formatDate(latestMood.entry_date) : "No mood entries"}</td>
        </tr>
      `;
    })
    .join("");
}

async function renderAppointments() {
  const now = new Date().toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, therapist_id, scheduled_at, status, format")
    .gte("scheduled_at", now)
    .in("status", ["scheduled", "pending"])
    .order("scheduled_at", { ascending: true })
    .limit(8);

  if (error) {
    console.error("Error loading appointments:", error);
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

  const therapistIds = [...new Set(appointments.map((a) => a.therapist_id))];

  const { data: therapists } = await supabase
    .from("therapists")
    .select("id, user_id")
    .in("id", therapistIds);

  const therapistUserIds = [...new Set((therapists || []).map((t) => t.user_id))];

  const { data: therapistProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email")
    .in("id", therapistUserIds);

  const therapistMap = {};

  (therapists || []).forEach((therapist) => {
    const profile = (therapistProfiles || []).find(
      (p) => p.id === therapist.user_id
    );

    therapistMap[therapist.id] =
      profile?.display_name ||
      profile?.full_name ||
      profile?.email ||
      "Unknown therapist";
  });

  appointmentsTableBody.innerHTML = appointments
    .map((appointment) => {
      const dateObj = new Date(appointment.scheduled_at);

      return `
        <tr>
          <td>${escapeHTML(therapistMap[appointment.therapist_id] || "Unknown therapist")}</td>
          <td>${formatDate(appointment.scheduled_at)}</td>
          <td>${formatTime(dateObj)}</td>
        </tr>
      `;
    })
    .join("");
}

async function renderActivity() {
  const { data, error } = await supabase
    .from("staff_actions_log")
    .select("id, action_type, description, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error loading staff activity:", error);
    activityList.innerHTML = `<div class="activity-item"><div class="activity-body">Could not load activity.</div></div>`;
    return;
  }

  if (!data.length) {
    activityList.innerHTML = `<div class="activity-item"><div class="activity-body">No recent staff activity.</div></div>`;
    return;
  }

  activityList.innerHTML = data
    .map(
      (item) => `
      <div class="activity-item">
        <div class="activity-head">
          <div class="activity-title">${escapeHTML(formatActionType(item.action_type))}</div>
          <div class="small-time">${timeAgo(item.created_at)}</div>
        </div>
        <div class="activity-body">${escapeHTML(item.description || "No description provided.")}</div>
      </div>
    `
    )
    .join("");
}

async function renderAlerts() {
  const { data, error } = await supabase
    .from("mood_entries")
    .select("user_id, mood_rating, mood_label, note, entry_date, created_at")
    .lte("mood_rating", 3)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error loading alerts:", error);
    alertList.innerHTML = `<div class="alert-item"><div class="alert-body">Could not load alerts.</div></div>`;
    return;
  }

  if (!data.length) {
    alertList.innerHTML = `<div class="alert-item"><div class="alert-body">No open mood alerts.</div></div>`;
    return;
  }

  alertList.innerHTML = data
    .map((entry) => {
      const client = allClients.find((c) => c.id === entry.user_id);
      const name =
        client?.display_name || client?.full_name || client?.email || "Unknown user";

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

function populateNoteUserDropdown() {
  if (!noteRecipients.length) {
    noteUserSelect.innerHTML = `
      <option value="">No staff/admin users found</option>
    `;
    return;
  }

  noteUserSelect.innerHTML = `
    <option value="">Select staff/admin</option>
    ${noteRecipients
      .map((person) => {
        const name = person.display_name || person.full_name || person.email;
        return `<option value="${person.id}">${escapeHTML(name)} (${escapeHTML(person.role)})</option>`;
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

    const { error } = await supabase.from("staff_notes").insert({
      staff_id: user.id,
      user_id: selectedUserId,
      note,
    });

    if (error) {
      console.error("Error saving note:", error);
      alert("Could not save note.");
      return;
    }

    await supabase.from("staff_actions_log").insert({
      staff_id: user.id,
      action_type: "staff_note_added",
      target_id: selectedUserId,
      description: "A staff note was added for a user.",
    });

    noteBody.value = "";
    noteUserSelect.value = "";

    await Promise.all([renderRecentNotes(), renderActivity()]);
    alert("Note saved.");
  });
}

async function renderRecentNotes() {
  const { data, error } = await supabase
    .from("staff_notes")
    .select("id, staff_id, user_id, note, created_at")
    .or(`staff_id.eq.${user.id},user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error loading recent notes:", error);
    recentNotesList.innerHTML = `<div class="note-item"><div class="note-body">Could not load notes.</div></div>`;
    return;
  }

  if (!data.length) {
    recentNotesList.innerHTML = `<div class="note-item"><div class="note-body">No recent notes.</div></div>`;
    return;
  }

  const profileIds = [
    ...new Set(data.flatMap((note) => [note.staff_id, note.user_id]))
  ];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email, role")
    .in("id", profileIds);

  if (profileError) {
    console.error("Error loading note profiles:", profileError);
  }

  const profileMap = {};
  (profiles || []).forEach((profile) => {
    profileMap[profile.id] = profile;
  });

  recentNotesList.innerHTML = data
    .map((note) => {
      const sender = profileMap[note.staff_id];
      const receiver = profileMap[note.user_id];

      const senderName =
        sender?.display_name || sender?.full_name || sender?.email || "Unknown sender";

      const receiverName =
        receiver?.display_name || receiver?.full_name || receiver?.email || "Unknown recipient";

      return `
        <div class="note-item">
          <div class="note-head">
            <div class="note-title">
              ${escapeHTML(senderName)} → ${escapeHTML(receiverName)}
            </div>
            <div class="small-time">${timeAgo(note.created_at)}</div>
          </div>
          <div class="note-body">${escapeHTML(note.note)}</div>
        </div>
      `;
    })
    .join("");
}

async function loadNoteRecipients() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email, role")
    .in("role", ["staff", "admin"])
    .neq("id", user.id)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error loading note recipients:", error);
    return [];
  }

  return data || [];
}

function setupLogout() {
  if (!logoutBtn) {
    console.error("Logout button not found.");
    return;
  }

  logoutBtn.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      alert("Could not sign out. Please try again.");
      return;
    }

    window.location.href = STAFF_LOGIN_PATH;
  });
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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



function formatActionType(actionType) {
  if (!actionType) return "Staff activity";

  return actionType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}