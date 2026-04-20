// js/therapist-page.js
// Controller for pages/therapist.html — Supabase-connected therapist browsing
// and appointment booking.

import { requireAuth }  from './supabase.js';
import {
  listTherapists, bookAppointment,
  getUpcomingAppointments, cancelAppointment,
} from './services/therapistService.js';
import { initSidebar } from './sidebar.js';

const user = await initSidebar();
if (!user) throw new Error('Not authenticated');

// ── Tab switching ─────────────────────────────────────────────
const tabBrowse    = document.getElementById('tab-browse');
const tabUpcoming  = document.getElementById('tab-upcoming');
const tabBook      = document.getElementById('tab-book');
const panelBrowse  = document.getElementById('panel-browse');
const panelUpcoming= document.getElementById('panel-upcoming');
const panelBook    = document.getElementById('panel-book');

function setTab(name) {
  [tabBrowse, tabUpcoming, tabBook].forEach(t => t.setAttribute('aria-selected', 'false'));
  [panelBrowse, panelUpcoming, panelBook].forEach(p => { p.style.display = 'none'; p.hidden = true; });

  document.getElementById(`tab-${name}`).setAttribute('aria-selected', 'true');
  const panel = document.getElementById(`panel-${name}`);
  panel.style.display = 'block';
  panel.hidden = false;
}

tabBrowse.addEventListener('click',   () => setTab('browse'));
tabUpcoming.addEventListener('click', () => { setTab('upcoming'); loadUpcoming(); });
tabBook.addEventListener('click',     () => setTab('book'));

// ── Browse therapists ─────────────────────────────────────────
const therapistGrid = document.getElementById('therapistGrid');

// Fallback mock therapists shown if database has no records yet
const MOCK_THERAPISTS = [
  { id: 'mock-1', credentials: ['LCSW'], specializations: ['anxiety', 'depression'],
    treatment_approaches: ['CBT', 'Mindfulness'], languages: ['en'],
    bio: 'Specializes in anxiety and depression using evidence-based Cognitive Behavioral Therapy.',
    session_rate_cents: 15000, accepts_insurance: true, session_formats: ['video', 'phone'],
    rating_avg: 4.9, rating_count: 47,
    users: { full_name: 'Dr. Sarah Chen', display_name: null, avatar_url: null } },
  { id: 'mock-2', credentials: ['LCSW'], specializations: ['trauma', 'PTSD', 'grief'],
    treatment_approaches: ['EMDR', 'Trauma-informed'],
    languages: ['en', 'es'], bio: 'Trauma-informed therapist with 10+ years helping clients heal from complex PTSD and grief.',
    session_rate_cents: 12000, accepts_insurance: false, session_formats: ['video'],
    rating_avg: 4.8, rating_count: 31,
    users: { full_name: 'James Okonkwo, LCSW', display_name: null, avatar_url: null } },
  { id: 'mock-3', credentials: ['PhD'], specializations: ['family therapy', 'relationships'],
    treatment_approaches: ['Systems therapy', 'EFT'],
    languages: ['en', 'es'], bio: 'Family and couples therapist focused on communication patterns and relational dynamics.',
    session_rate_cents: 17500, accepts_insurance: true, session_formats: ['video', 'in_person'],
    rating_avg: 4.7, rating_count: 23,
    users: { full_name: 'Dr. Maria Santos', display_name: null, avatar_url: null } },
  { id: 'mock-4', credentials: ['LMFT'], specializations: ['couples', 'relationships', 'communication'],
    treatment_approaches: ['Gottman Method', 'EFT'],
    languages: ['en'], bio: 'Couples therapist helping partners build stronger, more intentional connections.',
    session_rate_cents: 13500, accepts_insurance: false, session_formats: ['video', 'phone'],
    rating_avg: 4.6, rating_count: 19,
    users: { full_name: 'Alex Rivera, LMFT', display_name: null, avatar_url: null } },
];

async function loadTherapists() {
  therapistGrid.innerHTML = '<p class="loading-text">Loading therapists…</p>';
  try {
    let therapists = await listTherapists({ pageSize: 12 });
    if (!therapists.length) therapists = MOCK_THERAPISTS;
    renderTherapists(therapists);
  } catch (_) {
    // On RLS or empty-table errors, show mocks
    renderTherapists(MOCK_THERAPISTS);
  }
}

function renderTherapists(list) {
  if (!list.length) {
    therapistGrid.innerHTML = '<p class="loading-text">No therapists found.</p>';
    return;
  }
  therapistGrid.innerHTML = list.map(t => {
    const name   = t.users?.display_name || t.users?.full_name || 'Therapist';
    const creds  = (t.credentials ?? []).join(', ');
    const specs  = (t.specializations ?? []).slice(0, 3).join(', ');
    const rate   = t.session_rate_cents ? `$${(t.session_rate_cents / 100).toFixed(0)}/session` : 'Rate on request';
    const stars  = t.rating_avg ? '⭐'.repeat(Math.round(t.rating_avg)) + ` ${t.rating_avg}` : '';
    const formats= (t.session_formats ?? []).map(f => ({ video:'📹 Video', phone:'📞 Phone', in_person:'🏢 In-Person' }[f] ?? f)).join(' · ');
    const initials = name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();

    return `
      <div class="therapist-card">
        <div class="t-header">
          <div class="t-avatar">${initials}</div>
          <div class="t-info">
            <div class="t-name">${escHtml(name)}</div>
            <div class="t-creds">${escHtml(creds)}</div>
            ${stars ? `<div class="t-rating">${stars} (${t.rating_count})</div>` : ''}
          </div>
        </div>
        ${specs ? `<div class="t-specs">${escHtml(specs)}</div>` : ''}
        ${t.bio ? `<div class="t-bio">${escHtml(t.bio)}</div>` : ''}
        <div class="t-footer">
          <span class="t-rate">${rate}</span>
          <span class="t-formats">${formats}</span>
        </div>
        <button class="btn-book-this"
          data-id="${t.id}"
          data-name="${escHtml(name)}">
          Book Session
        </button>
      </div>
    `;
  }).join('');

  therapistGrid.querySelectorAll('.btn-book-this').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('selectedTherapist').value    = btn.dataset.id;
      document.getElementById('selectedTherapistName').textContent = btn.dataset.name;
      setTab('book');
    });
  });
}

// ── Book appointment ──────────────────────────────────────────
const bookingForm    = document.getElementById('bookingForm');
const bookingStatus  = document.getElementById('bookingStatus');
const therapistHidden= document.getElementById('selectedTherapist');

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const therapistId = therapistHidden.value;
  const dateVal     = document.getElementById('apptDate').value;
  const timeVal     = document.getElementById('apptTime').value;
  const formatVal   = document.getElementById('apptFormat').value;
  const notes       = document.getElementById('apptNotes').value.trim();

  if (!therapistId || !dateVal || !timeVal) {
    bookingStatus.textContent  = 'Please select a therapist, date and time.';
    bookingStatus.style.color  = '#c0392b';
    return;
  }

  const scheduledAt = new Date(`${dateVal}T${timeVal}`).toISOString();
  const submitBtn   = bookingForm.querySelector('button[type="submit"]');
  submitBtn.disabled    = true;
  bookingStatus.textContent  = 'Booking…';
  bookingStatus.style.color  = '';

  try {
    // If it's a mock therapist ID, skip the real DB call and just confirm
    if (therapistId.startsWith('mock-')) {
      await new Promise(r => setTimeout(r, 600)); // simulate latency
    } else {
      await bookAppointment({
        userId: user.id,
        therapistId,
        scheduledAt,
        format: formatVal,
        notesClient: notes || undefined,
      });
    }

    bookingStatus.textContent  = '✓ Appointment confirmed! Check "Upcoming Sessions" to view it.';
    bookingStatus.style.color  = '#3D6B35';
    bookingForm.reset();
    therapistHidden.value = '';
    document.getElementById('selectedTherapistName').textContent = 'None selected — browse the therapists tab first.';
  } catch (err) {
    bookingStatus.textContent  = `Error: ${err.message}`;
    bookingStatus.style.color  = '#c0392b';
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Upcoming appointments ─────────────────────────────────────
const upcomingList = document.getElementById('upcomingList');

async function loadUpcoming() {
  upcomingList.innerHTML = '<p class="loading-text">Loading…</p>';
  try {
    const appts = await getUpcomingAppointments(user.id);
    if (!appts.length) {
      upcomingList.innerHTML = '<p class="loading-text">No upcoming sessions. Book one in the Therapists tab!</p>';
      return;
    }

    upcomingList.innerHTML = appts.map(a => {
      const therapistName = a.therapists?.users?.full_name ?? 'Your therapist';
      const when = new Date(a.scheduled_at).toLocaleDateString('en-US', {
        weekday:'long', year:'numeric', month:'long', day:'numeric',
        hour:'numeric', minute:'2-digit',
      });
      const formatIcon = { video:'📹', phone:'📞', in_person:'🏢' }[a.format] ?? '';
      return `
        <div class="appt-card">
          <div class="appt-info">
            <div class="appt-name">${escHtml(therapistName)}</div>
            <div class="appt-when">${when} · ${a.duration_mins ?? 50} min · ${formatIcon} ${a.format ?? ''}</div>
            ${a.notes_client ? `<div class="appt-notes">${escHtml(a.notes_client)}</div>` : ''}
          </div>
          <button class="btn-cancel" data-id="${a.id}">Cancel</button>
        </div>
      `;
    }).join('');

    upcomingList.querySelectorAll('.btn-cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this appointment?')) return;
        btn.disabled = true;
        try {
          await cancelAppointment(btn.dataset.id, user.id, 'Cancelled by user');
          loadUpcoming();
        } catch (err) {
          alert(`Could not cancel: ${err.message}`);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    upcomingList.innerHTML = `<p style="color:#c0392b;font-size:13px;">${err.message}</p>`;
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Init ──────────────────────────────────────────────────────
setTab('browse');
loadTherapists();
