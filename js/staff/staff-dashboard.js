// /js/staff/staff-dashboard.js
// MindBloom staff dashboard controller

import { supabase, requireAuth } from '../supabase.js';

const PROFILES_TABLE = 'profiles';
const STAFF_LOGIN_PATH = '/staff-login';
const ALLOWED_ROLES = ['staff', 'admin'];

const state = {
  currentUser: null,
  currentProfile: null,
  profiles: [],
  therapists: [],
  appointments: [],
  staffNotes: [],
  staffLogs: [],
  moodEntries: [],
};

const els = {
  todayDate: document.getElementById('today-date'),
  logoutBtn: document.getElementById('logoutBtn'),

  avatarInitials: document.getElementById('avatar-initials'),
  sbUsername: document.getElementById('sb-username'),
  sbUseremail: document.getElementById('sb-useremail'),

  bannerStaffName: document.getElementById('banner-staff-name'),
  bannerStaffRole: document.getElementById('banner-staff-role'),
  bannerTag: document.getElementById('banner-tag'),

  totalUsers: document.getElementById('total-users'),
  totalUsersSub: document.getElementById('total-users-sub'),
  upcomingAppts: document.getElementById('upcoming-appts'),
  upcomingApptsSub: document.getElementById('upcoming-appts-sub'),
  activeTherapists: document.getElementById('active-therapists'),
  activeTherapistsSub: document.getElementById('active-therapists-sub'),
  openAlerts: document.getElementById('open-alerts'),
  openAlertsSub: document.getElementById('open-alerts-sub'),

  usersTableBody: document.getElementById('users-table-body'),
  appointmentsTableBody: document.getElementById('appointments-table-body'),
  activityList: document.getElementById('activity-list'),
  alertList: document.getElementById('alert-list'),
  recentNotesList: document.getElementById('recent-notes-list'),

  userSearch: document.getElementById('user-search'),
  userFilter: document.getElementById('user-filter'),

  quickNoteForm: document.getElementById('quick-note-form'),
  noteUser: document.getElementById('note-user'),
  noteBody: document.getElementById('note-body'),

  avgMood: document.getElementById('avg-mood'),
  avgSleep: document.getElementById('avg-sleep'),
  highAnxietyCount: document.getElementById('high-anxiety-count'),
  notesToday: document.getElementById('notes-today'),

  statusMessage: document.getElementById('status-message'),
};

function showStatus(message, type = 'success') {
  if (!els.statusMessage) return;
  els.statusMessage.textContent = message;
  els.statusMessage.className = `status-message show ${type}`;
}

function clearStatus() {
  if (!els.statusMessage) return;
  els.statusMessage.textContent = '';
  els.statusMessage.className = 'status-message';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isUserRole(role) {
  return normalizeValue(role) === 'user';
}

function isDashboardUserRole(role) {
  const normalized = normalizeValue(role);
  return normalized === 'user' || normalized === 'client';
}

function isScheduledStatus(status) {
  return normalizeValue(status) === 'scheduled';
}

function getInitials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'MB'
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeLabel(value) {
  if (!value) return 'Recent';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recent';

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${Math.max(diffMins, 1)} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return formatDateTime(value);
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isThisMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function isThisWeek(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return date >= startOfWeek && date < endOfWeek;
}

function getAppointmentStatusBadge(status) {
  const normalized = normalizeValue(status);

  if (normalized === 'scheduled' || normalized === 'completed') {
    return 'badge-success';
  }
  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'no_show') {
    return 'badge-danger';
  }
  return 'badge-neutral';
}

function getUserHealthStatus(profile) {
  const energy = Number(profile?.energy_level ?? NaN);
  const anxiety = Number(profile?.anxiety_level ?? NaN);
  const sleep = Number(profile?.sleep_hours ?? NaN);

  if (
    Number.isFinite(anxiety) &&
    Number.isFinite(energy) &&
    Number.isFinite(sleep) &&
    ((anxiety >= 8 && energy <= 4) || sleep <= 4)
  ) {
    return { label: 'Needs review', className: 'badge-danger' };
  }

  if (
    (Number.isFinite(anxiety) && anxiety >= 6) ||
    (Number.isFinite(energy) && energy <= 5) ||
    (Number.isFinite(sleep) && sleep <= 5)
  ) {
    return { label: 'Monitor', className: 'badge-warn' };
  }

  return { label: 'Stable', className: 'badge-success' };
}

function getOpenAlertsData(clientProfiles, appointments, moodEntries) {
  const now = new Date();
  const moodMap = new Map();

  for (const entry of moodEntries) {
    if (!moodMap.has(entry.user_id)) {
      moodMap.set(entry.user_id, entry);
    }
  }

  return clientProfiles
    .map(profile => {
      const energy = Number(profile.energy_level ?? NaN);
      const anxiety = Number(profile.anxiety_level ?? NaN);
      const sleep = Number(profile.sleep_hours ?? NaN);
      const latestMood = moodMap.get(profile.id);

      let score = 0;
      const reasons = [];

      if (Number.isFinite(energy) && energy <= 4) {
        score += 1;
        reasons.push('low energy');
      }

      if (Number.isFinite(anxiety) && anxiety >= 8) {
        score += 2;
        reasons.push('high anxiety');
      }

      if (Number.isFinite(sleep) && sleep <= 4) {
        score += 2;
        reasons.push('reduced sleep');
      }

      if (latestMood && Number(latestMood.mood_rating ?? 10) <= 3) {
        score += 2;
        reasons.push('very low mood');
      }

      const hasUpcomingAppointment = appointments.some(appt => {
        return (
          appt.user_id === profile.id &&
          isScheduledStatus(appt.status) &&
          appt.scheduled_at &&
          new Date(appt.scheduled_at) >= now
        );
      });

      if (!hasUpcomingAppointment) {
        score += 1;
      }

      if (score < 3) return null;

      return {
        profile,
        score,
        reason:
          reasons.length > 0
            ? `Latest check-in shows ${reasons.join(', ')}.`
            : 'Recent activity suggests this user may need follow-up.',
        time: profile.logged_at || profile.created_at,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function requireStaffUser() {
  const authUser = await requireAuth();
  if (!authUser) {
    window.location.replace(STAFF_LOGIN_PATH);
    throw new Error('Not authenticated');
  }

  const { data: profile, error } = await supabase
    .from(PROFILES_TABLE)
    .select('id, full_name, email, role, created_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw error;
  if (!profile) {
    throw new Error('Your staff profile was not found in profiles.');
  }

  if (!ALLOWED_ROLES.includes(normalizeValue(profile.role))) {
    await supabase.auth.signOut();
    window.location.replace(STAFF_LOGIN_PATH);
    throw new Error('Unauthorized staff access.');
  }

  return { authUser, profile };
}

function renderStaffIdentity(profile, authUser) {
  const displayName =
    profile.full_name ||
    profile.email?.split('@')[0] ||
    authUser.email?.split('@')[0] ||
    'Staff Member';

  const email = profile.email || authUser.email || '';

  if (els.sbUsername) els.sbUsername.textContent = displayName;
  if (els.sbUseremail) els.sbUseremail.textContent = email;
  if (els.bannerStaffName) els.bannerStaffName.textContent = `Welcome back, ${displayName}`;
  if (els.bannerStaffRole) {
    els.bannerStaffRole.textContent = `Signed in as ${profile.role}. Here is your live operations overview.`;
  }
  if (els.bannerTag) {
    els.bannerTag.textContent = String(profile.role || 'staff').toUpperCase();
  }

  if (els.avatarInitials) {
    els.avatarInitials.textContent = getInitials(displayName);
  }

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
    .from(PROFILES_TABLE)
    .select(`
      id,
      full_name,
      email,
      role,
      energy_level,
      anxiety_level,
      sleep_hours,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(profile => ({
    ...profile,
    display_name: profile.full_name ?? null,
    avatar_url: null,
    updated_at: profile.created_at ?? null,
    logged_at: null,
  }));
}

async function fetchTherapists() {
  const { data, error } = await supabase
    .from('therapists')
    .select(`
      id,
      user_id,
      status,
      credentials,
      specializations,
      languages,
      bio,
      rating_avg,
      rating_count,
      created_at
    `)
    .order('created_at', { ascending: false });

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
      scheduled_at,
      duration_mins,
      format,
      status,
      notes_client,
      created_at,
      updated_at
    `)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchStaffNotes() {
  const { data, error } = await supabase
    .from('staff_notes')
    .select(`
      id,
      staff_id,
      user_id,
      appointment_id,
      note,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function fetchStaffLogs() {
  const { data, error } = await supabase
    .from('staff_actions_log')
    .select(`
      id,
      staff_id,
      action_type,
      target_id,
      description,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function fetchMoodEntries() {
  const { data, error } = await supabase
    .from('mood_entries')
    .select(`
      id,
      user_id,
      mood_rating,
      mood_label,
      note,
      entry_date,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;
  return data || [];
}

function buildProfileMap(profiles) {
  return new Map(profiles.map(profile => [profile.id, profile]));
}

function buildTherapistNameMap(therapists, profileMap) {
  const therapistNameMap = new Map();

  for (const therapist of therapists) {
    const profile = profileMap.get(therapist.user_id);
    therapistNameMap.set(
      therapist.id,
      profile?.full_name ||
        profile?.email?.split('@')[0] ||
        'Therapist'
    );
  }

  return therapistNameMap;
}

function renderStats(profiles, therapists, appointments, moodEntries) {
  const newUsersThisMonth = profiles.filter(profile => {
    if (!profile.created_at) return false;
    return isUserRole(profile.role) && isThisMonth(profile.created_at);
  });

  const now = new Date();
  const upcomingAppointmentsThisMonth = appointments.filter(appt => {
    if (!appt.scheduled_at) return false;

    const scheduledDate = new Date(appt.scheduled_at);
    if (Number.isNaN(scheduledDate.getTime())) return false;

    return (
      scheduledDate >= now &&
      isThisMonth(appt.scheduled_at) &&
      isScheduledStatus(appt.status)
    );
  });

  const therapistIdsWorkingThisWeek = new Set(
    appointments
      .filter(appt => {
        return (
          appt.therapist_id &&
          isScheduledStatus(appt.status) &&
          isThisWeek(appt.scheduled_at)
        );
      })
      .map(appt => appt.therapist_id)
  );

  const activeTherapistsThisWeek = therapists.filter(therapist =>
    therapistIdsWorkingThisWeek.has(therapist.id)
  );

  const uniqueMoodEntriesToday = new Set(
    moodEntries
      .filter(entry => isToday(entry.created_at))
      .map(entry => entry.id)
  );

  if (els.totalUsers) {
    els.totalUsers.textContent = String(newUsersThisMonth.length);
  }
  if (els.totalUsersSub) {
    els.totalUsersSub.textContent = 'User accounts created this month';
  }

  if (els.upcomingAppts) {
    els.upcomingAppts.textContent = String(upcomingAppointmentsThisMonth.length);
  }
  if (els.upcomingApptsSub) {
    els.upcomingApptsSub.textContent = 'Appointments scheduled this month';
  }

  if (els.activeTherapists) {
    els.activeTherapists.textContent = String(activeTherapistsThisWeek.length);
  }
  if (els.activeTherapistsSub) {
    els.activeTherapistsSub.textContent = 'Therapists booked this week';
  }

  if (els.openAlerts) {
    els.openAlerts.textContent = String(uniqueMoodEntriesToday.size);
  }
  if (els.openAlertsSub) {
    els.openAlertsSub.textContent = 'Unique mood entries created today';
  }

  console.log('[staff-dashboard] total-clients debug', {
    profilesCount: profiles.length,
    userProfiles: profiles.filter(profile => isUserRole(profile.role)).length,
    newUsersThisMonth: newUsersThisMonth.length,
    userRows: profiles
      .filter(profile => isUserRole(profile.role))
      .map(profile => ({
        id: profile.id,
        role: profile.role,
        created_at: profile.created_at,
      })),
  });
}

function renderUsersTable(profiles) {
  if (!els.usersTableBody) return;

  const query = (els.userSearch?.value || '').trim().toLowerCase();
  const filter = els.userFilter?.value || 'all';

  const clientProfiles = profiles.filter(profile => isDashboardUserRole(profile.role));

  const filtered = clientProfiles.filter(profile => {
    const name = (profile.full_name || '').toLowerCase();
    const email = (profile.email || '').toLowerCase();
    const status = getUserHealthStatus(profile).label;

    const matchesSearch = !query || name.includes(query) || email.includes(query);
    if (!matchesSearch) return false;

    if (filter === 'needs_review') return status === 'Needs review';
    if (filter === 'recent_signups') return isThisMonth(profile.created_at);
    if (filter === 'high_anxiety') return Number(profile.anxiety_level ?? 0) >= 8;

    return true;
  });

  const rows = filtered.slice(0, 8).map(profile => {
    const status = getUserHealthStatus(profile);

    const energy = profile.energy_level ?? '—';
    const anxiety = profile.anxiety_level ?? '—';
    const sleep = profile.sleep_hours ?? '—';

    return `
      <tr>
        <td>
          <div class="user-meta">
            <span class="user-name">${escapeHtml(profile.full_name || 'Unnamed User')}</span>
            <span class="user-email">${escapeHtml(profile.email || '')}</span>
          </div>
        </td>
        <td>${escapeHtml(profile.role || 'user')}</td>
        <td>${escapeHtml(String(energy))}${energy !== '—' ? '/10' : ''}</td>
        <td>${escapeHtml(String(anxiety))}${anxiety !== '—' ? '/10' : ''}</td>
        <td>${escapeHtml(String(sleep))}${sleep !== '—' ? ' hrs' : ''}</td>
        <td><span class="badge ${status.className}">${escapeHtml(status.label)}</span></td>
      </tr>
    `;
  }).join('');

  els.usersTableBody.innerHTML = rows || `
    <tr>
      <td colspan="6">No matching users found.</td>
    </tr>
  `;
}

function renderAppointmentsTable(appointments, profileMap, therapistNameMap) {
  if (!els.appointmentsTableBody) return;

  const now = new Date();

  const upcoming = appointments
    .filter(appt => appt.scheduled_at && new Date(appt.scheduled_at) >= now)
    .filter(appt => isScheduledStatus(appt.status))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 8);

  const rows = upcoming.map(appt => {
    const client = profileMap.get(appt.user_id);
    const therapistName = therapistNameMap.get(appt.therapist_id) || 'Therapist';
    const badgeClass = getAppointmentStatusBadge(appt.status);

    return `
      <tr>
        <td>${escapeHtml(client?.full_name || 'Unknown User')}</td>
        <td>${escapeHtml(therapistName)}</td>
        <td>${escapeHtml(formatDateTime(appt.scheduled_at))}</td>
        <td>${escapeHtml(appt.format || '—')}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(appt.status || '—')}</span></td>
      </tr>
    `;
  }).join('');

  els.appointmentsTableBody.innerHTML = rows || `
    <tr>
      <td colspan="5">No upcoming appointments found.</td>
    </tr>
  `;
}

function renderAlerts(alerts) {
  if (!els.alertList) return;

  const markup = alerts.map(alert => `
    <div class="alert-item">
      <div class="alert-head">
        <div class="alert-title">${escapeHtml(alert.profile.full_name || 'Unknown User')}</div>
        <div class="small-time">${escapeHtml(formatRelativeLabel(alert.time))}</div>
      </div>
      <div class="alert-body">${escapeHtml(alert.reason)}</div>
    </div>
  `).join('');

  els.alertList.innerHTML = markup || `
    <div class="alert-item">
      <div class="alert-body">No open alerts right now.</div>
    </div>
  `;
}

function renderActivity(logs, profileMap) {
  if (!els.activityList) return;

  const markup = logs.slice(0, 5).map(log => {
    const staffProfile = profileMap.get(log.staff_id);
    const staffName = staffProfile?.full_name || 'Staff member';

    return `
      <div class="activity-item">
        <div class="activity-head">
          <div class="activity-title">${escapeHtml((log.action_type || 'staff_action').replaceAll('_', ' '))}</div>
          <div class="small-time">${escapeHtml(formatRelativeLabel(log.created_at))}</div>
        </div>
        <div class="activity-body">
          ${escapeHtml(log.description || `${staffName} completed a staff action.`)}
        </div>
      </div>
    `;
  }).join('');

  els.activityList.innerHTML = markup || `
    <div class="activity-item">
      <div class="activity-body">No recent staff activity found.</div>
    </div>
  `;
}

function renderRecentNotes(notes, profileMap) {
  if (!els.recentNotesList) return;

  const markup = notes.slice(0, 5).map(note => {
    const clientProfile = profileMap.get(note.user_id);
    const clientName = clientProfile?.full_name || 'Unknown User';

    return `
      <div class="note-item">
        <div class="note-head">
          <div class="note-title">${escapeHtml(clientName)}</div>
          <div class="small-time">${escapeHtml(formatRelativeLabel(note.created_at))}</div>
        </div>
        <div class="note-body">${escapeHtml(note.note || '')}</div>
      </div>
    `;
  }).join('');

  els.recentNotesList.innerHTML = markup || `
    <div class="note-item">
      <div class="note-body">No recent notes yet.</div>
    </div>
  `;
}

function renderQuickNoteUsers(profiles) {
  if (!els.noteUser) return;

  const clients = profiles
    .filter(profile => isDashboardUserRole(profile.role))
    .sort((a, b) => {
      const aName = a.full_name || '';
      const bName = b.full_name || '';
      return aName.localeCompare(bName);
    });

  els.noteUser.innerHTML = `
    <option value="">Select user</option>
    ${clients.map(client => `
      <option value="${escapeHtml(client.id)}">
        ${escapeHtml(client.full_name || client.email || 'Unnamed User')}
      </option>
    `).join('')}
  `;
}

function renderMiniStats(clientProfiles, moodEntries, staffNotes) {
  const moodValues = moodEntries
    .map(entry => Number(entry.mood_rating))
    .filter(Number.isFinite);

  const avgMood = moodValues.length
    ? (moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length).toFixed(1)
    : '—';

  const sleepValues = clientProfiles
    .map(profile => Number(profile.sleep_hours))
    .filter(Number.isFinite);

  const avgSleep = sleepValues.length
    ? (sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length).toFixed(1)
    : '—';

  const highAnxietyCountValue = clientProfiles.filter(
    profile => Number(profile.anxiety_level ?? 0) >= 8
  ).length;

  const notesTodayCount = staffNotes.filter(note => isToday(note.created_at)).length;

  if (els.avgMood) els.avgMood.textContent = avgMood;
  if (els.avgSleep) els.avgSleep.textContent = avgSleep === '—' ? '—' : `${avgSleep}h`;
  if (els.highAnxietyCount) els.highAnxietyCount.textContent = String(highAnxietyCountValue);
  if (els.notesToday) els.notesToday.textContent = String(notesTodayCount);
}

async function saveQuickNote(staffId, userId, note) {
  const { error } = await supabase
    .from('staff_notes')
    .insert({
      staff_id: staffId,
      user_id: userId,
      note,
    });

  if (error) throw error;
}

async function logStaffAction(staffId, targetId, description) {
  const { error } = await supabase
    .from('staff_actions_log')
    .insert({
      staff_id: staffId,
      action_type: 'note_created',
      target_id: targetId,
      description,
    });

  if (error) {
    console.warn('[staff-dashboard] action log insert failed:', error.message);
  }
}

function attachEvents() {
  if (els.userSearch) {
    els.userSearch.addEventListener('input', () => renderUsersTable(state.profiles));
  }

  if (els.userFilter) {
    els.userFilter.addEventListener('change', () => renderUsersTable(state.profiles));
  }

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = STAFF_LOGIN_PATH;
    });
  }

  if (els.quickNoteForm) {
    els.quickNoteForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearStatus();

      const selectedUserId = els.noteUser?.value;
      const note = els.noteBody?.value.trim() || '';
      const submitButton = els.quickNoteForm.querySelector('button[type="submit"]');

      if (!selectedUserId) {
        showStatus('Please select a user first.', 'error');
        return;
      }

      if (!note) {
        showStatus('Please write a note first.', 'error');
        return;
      }

      const originalText = submitButton?.textContent || 'Save note';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
      }

      try {
        await saveQuickNote(state.currentUser.id, selectedUserId, note);
        await logStaffAction(
          state.currentUser.id,
          selectedUserId,
          'Created a staff note from the staff dashboard.'
        );

        if (els.noteUser) els.noteUser.value = '';
        if (els.noteBody) els.noteBody.value = '';

        state.staffNotes = await fetchStaffNotes();
        renderRecentNotes(state.staffNotes, buildProfileMap(state.profiles));

        const dashboardUsers = state.profiles.filter(profile => isDashboardUserRole(profile.role));
        renderMiniStats(dashboardUsers, state.moodEntries, state.staffNotes);

        showStatus('Note saved successfully.', 'success');
      } catch (error) {
        console.error('[staff-dashboard] quick note error:', error);
        showStatus(`Could not save note: ${error.message}`, 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }
}

async function init() {
  try {
    clearStatus();

    const { authUser, profile } = await requireStaffUser();
    state.currentUser = authUser;
    state.currentProfile = profile;

    renderStaffIdentity(profile, authUser);

    const [
      profiles,
      therapists,
      appointments,
      staffNotes,
      staffLogs,
      moodEntries,
    ] = await Promise.all([
      fetchProfiles(),
      fetchTherapists(),
      fetchAppointments(),
      fetchStaffNotes(),
      fetchStaffLogs(),
      fetchMoodEntries(),
    ]);

    state.profiles = profiles;
    state.therapists = therapists;
    state.appointments = appointments;
    state.staffNotes = staffNotes;
    state.staffLogs = staffLogs;
    state.moodEntries = moodEntries;

    const dashboardUsers = profiles.filter(profile => isDashboardUserRole(profile.role));
    const alertUsers = profiles.filter(profile => isDashboardUserRole(profile.role));
    const profileMap = buildProfileMap(profiles);
    const therapistNameMap = buildTherapistNameMap(therapists, profileMap);
    const alerts = getOpenAlertsData(alertUsers, appointments, moodEntries);

    renderStats(profiles, therapists, appointments, moodEntries);
    renderUsersTable(profiles);
    renderAppointmentsTable(appointments, profileMap, therapistNameMap);
    renderAlerts(alerts);
    renderActivity(staffLogs, profileMap);
    renderRecentNotes(staffNotes, profileMap);
    renderQuickNoteUsers(profiles);
    renderMiniStats(dashboardUsers, moodEntries, staffNotes);
    attachEvents();
  } catch (error) {
    console.error('[staff-dashboard] init error:', error);
    showStatus(`Dashboard failed to load: ${error.message}`, 'error');
  }
}

await init();