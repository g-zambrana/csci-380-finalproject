// /js/staff-dashboard.js
// Controller for /pages/staff/staff-dashboard
// Staff-only dashboard for MindBloom

import { supabase, requireAuth } from '../supabase.js';

const PROFILE_TABLE = 'profile'; // change to 'profiles' if your real table is plural
const ALLOWED_ROLES = ['staff', 'admin', 'therapist'];
const LOGIN_PATH = '/staff-login';

const els = {
  todayDate: document.getElementById('today-date'),
  logoutBtn: document.getElementById('logoutBtn'),
  avatarInitials: document.getElementById('avatar-initials'),
  sbUsername: document.getElementById('sb-username'),
  sbUseremail: document.getElementById('sb-useremail'),
  notifBadge: document.getElementById('notif-badge'),

  totalUsers: document.getElementById('total-users'),
  upcomingAppts: document.getElementById('upcoming-appts'),
  activeTherapists: document.getElementById('active-therapists'),
  openAlerts: document.getElementById('open-alerts'),

  usersTableBody: document.getElementById('users-table-body'),
  appointmentsTableBody: document.getElementById('appointments-table-body'),
  alertList: document.getElementById('alert-list'),
  activityList: document.getElementById('activity-list'),
  recentNotesList: document.getElementById('recent-notes-list'),

  userSearch: document.getElementById('user-search'),
  userFilter: document.getElementById('user-filter'),

  quickNoteForm: document.getElementById('quick-note-form'),
  noteUser: document.getElementById('note-user'),
  noteBody: document.getElementById('note-body'),
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

function formatDate(dateValue, options = {}) {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', options);
}

function formatDateTime(dateValue) {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function combineAppointmentDateTime(appointment) {
  if (!appointment?.appointment_date) return null;

  const datePart = appointment.appointment_date;
  const timePart = appointment.appointment_time || '00:00:00';

  const combined = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(combined.getTime()) ? null : combined;
}

function getUserStatus(profileRow) {
  const anxiety = Number(profileRow?.anxiety_level ?? 0);
  const energy = Number(profileRow?.energy_level ?? 0);
  const sleep = Number(profileRow?.sleep_hours ?? 0);

  if ((anxiety >= 8 && energy <= 4) || sleep <= 4) {
    return { label: 'Needs review', className: 'badge-danger' };
  }

  if (anxiety >= 6 || energy <= 5 || sleep <= 5) {
    return { label: 'Monitor', className: 'badge-warn' };
  }

  return { label: 'Stable', className: 'badge-success' };
}

function getAlertReason(profileRow) {
  const anxiety = Number(profileRow?.anxiety_level ?? 0);
  const energy = Number(profileRow?.energy_level ?? 0);
  const sleep = Number(profileRow?.sleep_hours ?? 0);

  if (anxiety >= 8 && energy <= 4 && sleep <= 5) {
    return 'Low energy, high anxiety, and reduced sleep in latest check-in.';
  }

  if (anxiety >= 8) {
    return 'Elevated anxiety level in latest check-in.';
  }

  if (sleep <= 4) {
    return 'Very low sleep hours reported in latest check-in.';
  }

  if (energy <= 4) {
    return 'Low energy level reported recently.';
  }

  return 'Recent activity suggests this user may need follow-up.';
}

async function requireStaffUser() {
  const user = await requireAuth();
  if (!user) throw new Error('Not authenticated');

  const { data: profile, error } = await supabase
    .from(PROFILE_TABLE)
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[staff-dashboard] role lookup failed:', error);
    throw error;
  }

  const role = profile?.role ?? user.user_metadata?.role ?? null;

  if (!ALLOWED_ROLES.includes(role)) {
    await supabase.auth.signOut();
    window.location.replace(LOGIN_PATH);
    throw new Error('Unauthorized');
  }

  return { user, profile };
}

function renderStaffIdentity(user, profile) {
  const displayName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Staff Member';

  els.sbUsername.textContent = displayName;
  els.sbUseremail.textContent = user.email || '';
  els.avatarInitials.textContent = getInitials(displayName);

  if (els.todayDate) {
    els.todayDate.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

async function fetchProfiles() {
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('id, full_name, email, role, energy_level, anxiety_level, sleep_hours, logged_at, created_at')
    .order('logged_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

async function fetchAppointments() {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      user_id,
      therapist_id,
      appointment_date,
      appointment_time,
      status,
      notes,
      created_at
    `)
    .order('appointment_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchTherapists() {
  const { data, error } = await supabase
    .from('therapists')
    .select('id, profile_id, specialty, phone, bio, is_available, created_at');

  if (error) throw error;
  return data || [];
}

async function fetchStaffNotes() {
  const { data, error } = await supabase
    .from('staff_notes')
    .select('id, staff_id, user_id, appointment_id, note, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function fetchStaffLogs() {
  const { data, error } = await supabase
    .from('staff_actions_log')
    .select('id, staff_id, action_type, target_id, description, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function fetchMoodEntries() {
  const { data, error } = await supabase
    .from('mood_entries')
    .select('id, user_id, mood_rating, mood_label, entry_date, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

function buildProfileMap(profiles) {
  return new Map(profiles.map(profile => [profile.id, profile]));
}

function buildTherapistMaps(therapists, profileMap) {
  const therapistById = new Map();
  const therapistNameById = new Map();

  for (const therapist of therapists) {
    therapistById.set(therapist.id, therapist);

    const therapistProfile = profileMap.get(therapist.profile_id);
    const therapistName =
      therapistProfile?.full_name ||
      therapist.specialty ||
      'Therapist';

    therapistNameById.set(therapist.id, therapistName);
  }

  return { therapistById, therapistNameById };
}

function renderStats(profiles, therapists, appointments, alerts, notesToday) {
  const clientProfiles = profiles.filter(p => p.role === 'client');
  const now = new Date();

  const upcomingAppointments = appointments.filter(appt => {
    const apptDate = combineAppointmentDateTime(appt);
    return apptDate && apptDate >= now;
  });

  const activeTherapists = therapists.filter(t => t.is_available !== false);

  els.totalUsers.textContent = String(clientProfiles.length);
  els.upcomingAppts.textContent = String(upcomingAppointments.length);
  els.activeTherapists.textContent = String(activeTherapists.length);
  els.openAlerts.textContent = String(alerts.length);

  const statSubs = document.querySelectorAll('.stat-sub');
  if (statSubs[0]) statSubs[0].textContent = `${profiles.filter(p => isCreatedThisMonth(p.created_at)).length} new this month`;
  if (statSubs[1]) statSubs[1].textContent = `${upcomingAppointments.filter(a => isToday(a.appointment_date)).length} scheduled today`;
  if (statSubs[2]) statSubs[2].textContent = `${therapists.filter(t => t.is_available === false).length} marked unavailable`;
  if (statSubs[3]) statSubs[3].textContent = notesToday > 0 ? `${notesToday} notes added today` : 'Needs follow-up review';

  if (els.notifBadge) {
    els.notifBadge.textContent = String(alerts.length);
    els.notifBadge.style.display = alerts.length > 0 ? 'flex' : 'none';
  }
}

function isCreatedThisMonth(dateValue) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function isToday(dateValue) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function renderUsersTable(allProfiles) {
  const query = (els.userSearch?.value || '').trim().toLowerCase();
  const filter = els.userFilter?.value || 'All users';

  const clientProfiles = allProfiles.filter(profile => profile.role === 'client');

  const filtered = clientProfiles.filter(profile => {
    const fullName = (profile.full_name || '').toLowerCase();
    const email = (profile.email || '').toLowerCase();
    const matchesSearch = !query || fullName.includes(query) || email.includes(query);

    if (!matchesSearch) return false;

    const status = getUserStatus(profile).label;

    if (filter === 'Needs review') return status === 'Needs review';
    if (filter === 'Recent signups') return isCreatedThisMonth(profile.created_at);
    if (filter === 'High anxiety') return Number(profile.anxiety_level ?? 0) >= 8;

    return true;
  });

  const rows = filtered.slice(0, 8).map(profile => {
    const status = getUserStatus(profile);

    return `
      <tr>
        <td>
          <div class="user-meta">
            <span class="user-name">${escapeHtml(profile.full_name || 'Unnamed User')}</span>
            <span class="user-email">${escapeHtml(profile.email || '')}</span>
          </div>
        </td>
        <td>${escapeHtml(profile.role || 'client')}</td>
        <td>${escapeHtml(String(profile.energy_level ?? '—'))}/10</td>
        <td>${escapeHtml(String(profile.anxiety_level ?? '—'))}/10</td>
        <td>${escapeHtml(String(profile.sleep_hours ?? '—'))} hrs</td>
        <td><span class="badge ${status.className}">${status.label}</span></td>
      </tr>
    `;
  }).join('');

  els.usersTableBody.innerHTML = rows || `
    <tr>
      <td colspan="6">No matching users found.</td>
    </tr>
  `;
}

function renderAppointmentsTable(appointments, profileMap, therapistNameById) {
  const now = new Date();

  const upcoming = appointments
    .map(appt => ({ ...appt, dateObj: combineAppointmentDateTime(appt) }))
    .filter(appt => appt.dateObj && appt.dateObj >= now)
    .sort((a, b) => a.dateObj - b.dateObj)
    .slice(0, 8);

  const rows = upcoming.map(appt => {
    const userProfile = profileMap.get(appt.user_id);
    const therapistName = therapistNameById.get(appt.therapist_id) || 'Unassigned';
    const status = String(appt.status || 'pending').toLowerCase();

    let badgeClass = 'badge-neutral';
    if (status === 'confirmed') badgeClass = 'badge-success';
    else if (status === 'rescheduled') badgeClass = 'badge-warn';
    else if (status === 'cancelled' || status === 'canceled') badgeClass = 'badge-danger';

    return `
      <tr>
        <td>${escapeHtml(userProfile?.full_name || 'Unknown User')}</td>
        <td>${escapeHtml(therapistName)}</td>
        <td>${escapeHtml(formatDate(appt.dateObj, { month: 'short', day: 'numeric' }))}</td>
        <td>${escapeHtml(appt.dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(appt.status || 'pending')}</span></td>
      </tr>
    `;
  }).join('');

  els.appointmentsTableBody.innerHTML = rows || `
    <tr>
      <td colspan="5">No upcoming appointments found.</td>
    </tr>
  `;
}

function buildAlerts(profiles, appointments, moodEntries) {
  const now = new Date();
  const moodByUser = new Map();

  for (const entry of moodEntries) {
    if (!moodByUser.has(entry.user_id)) {
      moodByUser.set(entry.user_id, entry);
    }
  }

  return profiles
    .filter(profile => profile.role === 'client')
    .map(profile => {
      const status = getUserStatus(profile);
      const recentMood = moodByUser.get(profile.id);

      let score = 0;
      if (status.label === 'Needs review') score += 3;
      if (Number(profile.anxiety_level ?? 0) >= 8) score += 2;
      if (Number(profile.sleep_hours ?? 0) <= 4) score += 2;
      if (Number(profile.energy_level ?? 0) <= 4) score += 1;

      const upcomingUserAppointments = appointments
        .filter(a => a.user_id === profile.id)
        .map(a => combineAppointmentDateTime(a))
        .filter(Boolean)
        .filter(date => date >= now);

      if (upcomingUserAppointments.length === 0) score += 1;
      if (recentMood && Number(recentMood.mood_rating ?? 10) <= 3) score += 2;

      return {
        profile,
        score,
        reason: getAlertReason(profile),
        loggedAt: profile.logged_at || profile.created_at || null,
      };
    })
    .filter(item => item.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function renderAlerts(alerts) {
  const items = alerts.map(({ profile, reason, loggedAt }) => `
    <div class="alert-item">
      <div class="alert-head">
        <div class="alert-title">${escapeHtml(profile.full_name || 'Unknown User')}</div>
        <div class="small-time">${escapeHtml(formatDate(loggedAt, { month: 'short', day: 'numeric' }))}</div>
      </div>
      <div class="alert-body">${escapeHtml(reason)}</div>
    </div>
  `).join('');

  els.alertList.innerHTML = items || `
    <div class="alert-item">
      <div class="alert-body">No open alerts right now.</div>
    </div>
  `;
}

function renderActivity(logs, profileMap) {
  const items = logs.slice(0, 5).map(log => {
    const staffProfile = profileMap.get(log.staff_id);
    const staffName = staffProfile?.full_name || 'Staff member';
    const title = log.action_type
      ? log.action_type.replaceAll('_', ' ')
      : 'Staff action';

    return `
      <div class="activity-item">
        <div class="activity-head">
          <div class="activity-title">${escapeHtml(title)}</div>
          <div class="small-time">${escapeHtml(formatDateTime(log.created_at))}</div>
        </div>
        <div class="activity-body">${escapeHtml(log.description || `${staffName} completed an action.`)}</div>
      </div>
    `;
  }).join('');

  els.activityList.innerHTML = items || `
    <div class="activity-item">
      <div class="activity-body">No recent staff activity found.</div>
    </div>
  `;
}

function renderRecentNotes(notes, profileMap) {
  const items = notes.slice(0, 5).map(note => {
    const userProfile = profileMap.get(note.user_id);

    return `
      <div class="note-item">
        <div class="note-head">
          <div class="note-title">${escapeHtml(userProfile?.full_name || 'Unknown User')}</div>
          <div class="small-time">${escapeHtml(formatDateTime(note.created_at))}</div>
        </div>
        <div class="note-body">${escapeHtml(note.note || '')}</div>
      </div>
    `;
  }).join('');

  els.recentNotesList.innerHTML = items || `
    <div class="note-item">
      <div class="note-body">No recent notes yet.</div>
    </div>
  `;
}

function renderQuickNoteUsers(profiles) {
  const clientProfiles = profiles
    .filter(profile => profile.role === 'client')
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

  const options = [
    `<option value="">Select user</option>`,
    ...clientProfiles.map(profile => `
      <option value="${escapeHtml(profile.id)}">${escapeHtml(profile.full_name || profile.email || 'Unnamed User')}</option>
    `)
  ];

  els.noteUser.innerHTML = options.join('');
}

function renderMiniStats(profiles, moodEntries, notes) {
  const moodValues = moodEntries
    .map(entry => Number(entry.mood_rating))
    .filter(value => Number.isFinite(value));

  const avgMood = moodValues.length
    ? (moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length).toFixed(1)
    : '—';

  const clientProfiles = profiles.filter(profile => profile.role === 'client');

  const sleepValues = clientProfiles
    .map(profile => Number(profile.sleep_hours))
    .filter(value => Number.isFinite(value));

  const avgSleep = sleepValues.length
    ? (sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length).toFixed(1)
    : '—';

  const highAnxietyCount = clientProfiles.filter(
    profile => Number(profile.anxiety_level ?? 0) >= 8
  ).length;

  const notesToday = notes.filter(note => {
    const created = new Date(note.created_at);
    const now = new Date();

    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }).length;

  const statValues = document.querySelectorAll('.mini-stat-value');
  if (statValues[0]) statValues[0].textContent = avgMood;
  if (statValues[1]) statValues[1].textContent = avgSleep === '—' ? '—' : `${avgSleep}h`;
  if (statValues[2]) statValues[2].textContent = String(highAnxietyCount);
  if (statValues[3]) statValues[3].textContent = String(notesToday);
}

async function handleQuickNoteSubmit(staffUserId) {
  if (!els.quickNoteForm) return;

  els.quickNoteForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const userId = els.noteUser.value;
    const note = els.noteBody.value.trim();

    if (!userId) {
      alert('Please select a user first.');
      return;
    }

    if (!note) {
      alert('Please write a note first.');
      return;
    }

    const submitButton = els.quickNoteForm.querySelector('button[type="submit"]');
    const originalText = submitButton?.textContent || 'Save note';

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
      }

      const { error } = await supabase
        .from('staff_notes')
        .insert({
          staff_id: staffUserId,
          user_id: userId,
          note,
        });

      if (error) throw error;

      const { error: logError } = await supabase
        .from('staff_actions_log')
        .insert({
          staff_id: staffUserId,
          action_type: 'note_created',
          target_id: userId,
          description: 'Created a staff note from the staff dashboard.',
        });

      if (logError) {
        console.warn('[staff-dashboard] log insert failed (non-fatal):', logError.message);
      }

      els.noteBody.value = '';
      els.noteUser.value = '';

      alert('Note saved successfully.');
      window.location.reload();
    } catch (err) {
      console.error('[staff-dashboard] quick note failed:', err);
      alert('Could not save the staff note.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  });
}

try {
  const { user, profile } = await requireStaffUser();
  renderStaffIdentity(user, profile);

  const [
    profiles,
    appointments,
    therapists,
    notes,
    logs,
    moodEntries,
  ] = await Promise.all([
    fetchProfiles(),
    fetchAppointments(),
    fetchTherapists(),
    fetchStaffNotes(),
    fetchStaffLogs(),
    fetchMoodEntries(),
  ]);

  const profileMap = buildProfileMap(profiles);
  const { therapistNameById } = buildTherapistMaps(therapists, profileMap);
  const alerts = buildAlerts(profiles, appointments, moodEntries);

  renderStats(
    profiles,
    therapists,
    appointments,
    alerts,
    notes.filter(note => isToday(new Date(note.created_at).toISOString().slice(0, 10))).length
  );

  renderUsersTable(profiles);
  renderAppointmentsTable(appointments, profileMap, therapistNameById);
  renderAlerts(alerts);
  renderActivity(logs, profileMap);
  renderRecentNotes(notes, profileMap);
  renderQuickNoteUsers(profiles);
  renderMiniStats(profiles, moodEntries, notes);
  await handleQuickNoteSubmit(user.id);

  if (els.userSearch) {
    els.userSearch.addEventListener('input', () => renderUsersTable(profiles));
  }

  if (els.userFilter) {
    els.userFilter.addEventListener('change', () => renderUsersTable(profiles));
  }
} catch (err) {
  console.error('Staff dashboard error:', err);
}

if (els.logoutBtn) {
  els.logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/staff-login';
  });
}