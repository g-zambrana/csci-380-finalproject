// js/therapist-page.js
// Controller for pages/therapist.html — Supabase-connected therapist browsing
// and appointment booking, using profiles/therapists/appointments schema.

import {
  listTherapists,
  bookAppointment,
  getUpcomingAppointments,
  cancelAppointment,
} from './services/therapistService.js';
import { initSidebar } from './sidebar.js';

// initSidebar should load the signed-in user and sidebar info from profiles
const user = await initSidebar();
if (!user) throw new Error('Not authenticated');

// ── Tab switching ─────────────────────────────────────────────
const tabBrowse = document.getElementById('tab-browse');
const tabUpcoming = document.getElementById('tab-upcoming');
const tabBook = document.getElementById('tab-book');

const panelBrowse = document.getElementById('panel-browse');
const panelUpcoming = document.getElementById('panel-upcoming');
const panelBook = document.getElementById('panel-book');

function setTab(name) {
  [tabBrowse, tabUpcoming, tabBook].forEach((t) =>
    t.setAttribute('aria-selected', 'false')
  );

  [panelBrowse, panelUpcoming, panelBook].forEach((p) => {
    p.style.display = 'none';
    p.hidden = true;
  });

  document.getElementById(`tab-${name}`).setAttribute('aria-selected', 'true');

  const panel = document.getElementById(`panel-${name}`);
  panel.style.display = 'block';
  panel.hidden = false;
}

tabBrowse.addEventListener('click', () => setTab('browse'));
tabBook.addEventListener('click', () => setTab('book'));
tabUpcoming.addEventListener('click', async () => {
  setTab('upcoming');
  await loadUpcoming();
});

// ── Browse therapists ─────────────────────────────────────────
const therapistGrid = document.getElementById('therapistGrid');

// Fallback mock therapists if DB is empty or blocked
const MOCK_THERAPISTS = [
  {
    id: 'mock-1',
    credentials: ['LCSW'],
    specializations: ['anxiety', 'depression'],
    treatment_approaches: ['CBT', 'Mindfulness'],
    languages: ['en'],
    bio: 'Specializes in anxiety and depression using evidence-based Cognitive Behavioral Therapy.',
    session_rate_cents: 15000,
    accepts_insurance: true,
    session_formats: ['video', 'phone'],
    rating_avg: 4.9,
    rating_count: 47,
    profiles: {
      full_name: 'Dr. Sarah Chen',
      display_name: null,
      avatar_url: null,
    },
  },
  {
    id: 'mock-2',
    credentials: ['LCSW'],
    specializations: ['trauma', 'PTSD', 'grief'],
    treatment_approaches: ['EMDR', 'Trauma-informed'],
    languages: ['en', 'es'],
    bio: 'Trauma-informed therapist with 10+ years helping clients heal from complex PTSD and grief.',
    session_rate_cents: 12000,
    accepts_insurance: false,
    session_formats: ['video'],
    rating_avg: 4.8,
    rating_count: 31,
    profiles: {
      full_name: 'James Okonkwo, LCSW',
      display_name: null,
      avatar_url: null,
    },
  },
  {
    id: 'mock-3',
    credentials: ['PhD'],
    specializations: ['family therapy', 'relationships'],
    treatment_approaches: ['Systems therapy', 'EFT'],
    languages: ['en', 'es'],
    bio: 'Family and couples therapist focused on communication patterns and relational dynamics.',
    session_rate_cents: 17500,
    accepts_insurance: true,
    session_formats: ['video', 'in_person'],
    rating_avg: 4.7,
    rating_count: 23,
    profiles: {
      full_name: 'Dr. Maria Santos',
      display_name: null,
      avatar_url: null,
    },
  },
  {
    id: 'mock-4',
    credentials: ['LMFT'],
    specializations: ['couples', 'relationships', 'communication'],
    treatment_approaches: ['Gottman Method', 'EFT'],
    languages: ['en'],
    bio: 'Couples therapist helping partners build stronger, more intentional connections.',
    session_rate_cents: 13500,
    accepts_insurance: false,
    session_formats: ['video', 'phone'],
    rating_avg: 4.6,
    rating_count: 19,
    profiles: {
      full_name: 'Alex Rivera, LMFT',
      display_name: null,
      avatar_url: null,
    },
  },
];

async function loadTherapists() {
  therapistGrid.innerHTML = '<p class="loading-text">Loading therapists…</p>';

  try {
    let therapists = await listTherapists({ pageSize: 12 });

    if (!Array.isArray(therapists) || therapists.length === 0) {
      therapists = MOCK_THERAPISTS;
    }

    renderTherapists(therapists);
  } catch (err) {
    console.error('Therapist load failed:', err);
    renderTherapists(MOCK_THERAPISTS);
  }
}

function renderTherapists(list) {
  if (!Array.isArray(list) || !list.length) {
    therapistGrid.innerHTML =
      '<p class="loading-text">No therapists found.</p>';
    return;
  }

  therapistGrid.innerHTML = list
    .map((t) => {
      const profile = t.profiles ?? {};
      const name =
        profile.display_name ||
        profile.full_name ||
        'Therapist';

      const creds = Array.isArray(t.credentials)
        ? t.credentials.join(', ')
        : '';

      const specs = Array.isArray(t.specializations)
        ? t.specializations.slice(0, 3).join(', ')
        : '';

      const rate = t.session_rate_cents
        ? `$${(t.session_rate_cents / 100).toFixed(0)}/session`
        : 'Rate on request';

      const stars = t.rating_avg
        ? `⭐ ${Number(t.rating_avg).toFixed(1)}`
        : '';

      const formats = Array.isArray(t.session_formats)
        ? t.session_formats
            .map((f) => {
              return (
                {
                  video: '📹 Video',
                  phone: '📞 Phone',
                  in_person: '🏢 In-Person',
                }[f] ?? f
              );
            })
            .join(' · ')
        : '';

      const initials = getInitials(name);

      return `
        <div class="therapist-card">
          <div class="t-header">
            <div class="t-avatar">${escHtml(initials)}</div>
            <div class="t-info">
              <div class="t-name">${escHtml(name)}</div>
              <div class="t-creds">${escHtml(creds)}</div>
              ${
                stars
                  ? `<div class="t-rating">${escHtml(stars)} (${Number(t.rating_count ?? 0)})</div>`
                  : ''
              }
            </div>
          </div>

          ${specs ? `<div class="t-specs">${escHtml(specs)}</div>` : ''}
          ${t.bio ? `<div class="t-bio">${escHtml(t.bio)}</div>` : ''}

          <div class="t-footer">
            <span class="t-rate">${escHtml(rate)}</span>
            <span class="t-formats">${escHtml(formats)}</span>
          </div>

          <button
            class="btn-book-this"
            data-id="${escAttr(t.id)}"
            data-name="${escAttr(name)}"
          >
            Book Session
          </button>
        </div>
      `;
    })
    .join('');

  therapistGrid.querySelectorAll('.btn-book-this').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('selectedTherapist').value = btn.dataset.id;
      document.getElementById('selectedTherapistName').textContent =
        btn.dataset.name;
      setTab('book');
    });
  });
}

// ── Book appointment ──────────────────────────────────────────
const bookingForm = document.getElementById('bookingForm');
const bookingStatus = document.getElementById('bookingStatus');
const therapistHidden = document.getElementById('selectedTherapist');

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const therapistId = therapistHidden.value;
  const dateVal = document.getElementById('apptDate').value;
  const timeVal = document.getElementById('apptTime').value;
  const formatVal = document.getElementById('apptFormat').value;
  const notes = document.getElementById('apptNotes').value.trim();

  if (!therapistId || !dateVal || !timeVal) {
    setBookingMessage('Please select a therapist, date, and time.', true);
    return;
  }

  const scheduledAt = makeIsoFromLocalDateTime(dateVal, timeVal);

  if (!scheduledAt) {
    setBookingMessage('Please enter a valid date and time.', true);
    return;
  }

  const submitBtn = bookingForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  setBookingMessage('Booking…', false);

  try {
    if (therapistId.startsWith('mock-')) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      await bookAppointment({
        userId: user.id,
        therapistId,
        scheduledAt,
        durationMins: 50,
        format: formatVal,
        notesClient: notes || undefined,
      });
    }

    setBookingMessage(
      '✓ Appointment confirmed! Check "Upcoming Sessions" to view it.',
      false,
      true
    );

    bookingForm.reset();
    therapistHidden.value = '';
    document.getElementById('selectedTherapistName').textContent =
      'None selected — browse the therapists tab first.';
  } catch (err) {
    console.error('Booking failed:', err);
    setBookingMessage(err?.message || 'Could not book appointment.', true);
  } finally {
    submitBtn.disabled = false;
  }
});

function setBookingMessage(message, isError = false, isSuccess = false) {
  bookingStatus.textContent = message;
  bookingStatus.style.color = isError
    ? '#c0392b'
    : isSuccess
    ? '#3D6B35'
    : '';
}

// ── Upcoming appointments ─────────────────────────────────────
const upcomingList = document.getElementById('upcomingList');

async function loadUpcoming() {
  upcomingList.innerHTML = '<p class="loading-text">Loading…</p>';

  try {
    const appts = await getUpcomingAppointments(user.id);

    if (!Array.isArray(appts) || !appts.length) {
      upcomingList.innerHTML =
        '<p class="loading-text">No upcoming sessions. Book one in the Therapists tab!</p>';
      return;
    }

    upcomingList.innerHTML = appts
      .map((a) => {
        const therapistName =
          a.therapists?.profiles?.display_name ||
          a.therapists?.profiles?.full_name ||
          'Your therapist';

        const when = new Date(a.scheduled_at).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        const formatIcon =
          {
            video: '📹',
            phone: '📞',
            in_person: '🏢',
          }[a.format] ?? '';

        return `
          <div class="appt-card">
            <div class="appt-info">
              <div class="appt-name">${escHtml(therapistName)}</div>
              <div class="appt-when">
                ${escHtml(when)} · ${Number(a.duration_mins ?? 50)} min · ${escHtml(formatIcon)} ${escHtml(a.format ?? '')}
              </div>
              ${
                a.notes_client
                  ? `<div class="appt-notes">${escHtml(a.notes_client)}</div>`
                  : ''
              }
            </div>
            <button class="btn-cancel" data-id="${escAttr(a.id)}">Cancel</button>
          </div>
        `;
      })
      .join('');

    upcomingList.querySelectorAll('.btn-cancel').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this appointment?')) return;

        btn.disabled = true;

        try {
          await cancelAppointment(btn.dataset.id, user.id, 'Cancelled by user');
          await loadUpcoming();
        } catch (err) {
          console.error('Cancel failed:', err);
          alert(`Could not cancel: ${err.message}`);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error('Upcoming appointments failed:', err);
    upcomingList.innerHTML = `
      <p style="color:#c0392b;font-size:13px;">
        ${escHtml(err?.message || 'Could not load appointments.')}
      </p>
    `;
  }
}

// ── Helpers ───────────────────────────────────────────────────
function makeIsoFromLocalDateTime(dateStr, timeStr) {
  const dt = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString();
}

function getInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr(str) {
  return escHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Init ──────────────────────────────────────────────────────
setTab('browse');
await loadTherapists();