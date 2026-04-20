// js/profile.js
// Controller for pages/profile.html — Profile Settings

import { supabase, requireAuth }                 from './supabase.js';
import { getUserProfile, updateUserProfile,
         updateClientProfile }                   from './services/userService.js';

// ── Auth guard ─────────────────────────────────────────────────
const user = await requireAuth();
if (!user) throw new Error('Not authenticated');

// ── Toast helper ──────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = `show ${type}`;
  toastTimer = setTimeout(() => { toastEl.className = ''; }, 3200);
}

// ── Tab logic ─────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.setAttribute('aria-selected', 'false'));
    document.querySelectorAll('.panel').forEach(p => p.setAttribute('aria-selected', 'false'));
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(btn.dataset.panel).setAttribute('aria-selected', 'true');
  });
});

// ── Load profile ──────────────────────────────────────────────
let profile = null;
let clientProfile = null;
let goals = [];

try {
  profile = await getUserProfile(user.id);
  clientProfile = profile?.client_profiles ?? null;
  goals = clientProfile?.goals ?? [];
} catch (e) {
  console.warn('[profile] load failed:', e.message);
}

// ── Populate sidebar + avatar ─────────────────────────────────
function applyDisplayName(name) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('avatar-initials').textContent      = initials;
  document.getElementById('profile-avatar-large').textContent = initials;
  document.getElementById('sb-username').textContent          = name;
  document.getElementById('profile-display-name').textContent = name;
}

const displayName =
  profile?.display_name ||
  profile?.full_name    ||
  user.user_metadata?.full_name ||
  user.email.split('@')[0];

applyDisplayName(displayName);
document.getElementById('sb-useremail').textContent        = user.email;
document.getElementById('profile-email-display').textContent = user.email;

// ── Populate personal info form ───────────────────────────────
const $ = id => document.getElementById(id);
$('full-name').value    = profile?.full_name    ?? '';
$('display-name').value = profile?.display_name ?? '';
$('email-field').value  = user.email;
$('phone').value        = profile?.phone        ?? '';
$('dob').value          = profile?.date_of_birth?.slice(0, 10) ?? '';
$('timezone').value     = profile?.timezone     ?? 'America/New_York';

// ── Populate emergency contact ────────────────────────────────
const ec = clientProfile?.emergency_contact ?? {};
$('ec-name').value  = ec.name         ?? '';
$('ec-phone').value = ec.phone        ?? '';
$('ec-rel').value   = ec.relationship ?? '';

// ── Populate preferences form ─────────────────────────────────
$('pref-lang').value = clientProfile?.preferred_language ?? 'en';
$('referral').value  = clientProfile?.referral_source    ?? '';

// ── Populate security tab ─────────────────────────────────────
$('sec-email').value    = user.email;
$('sec-role').value     = profile?.role
  ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
  : 'Client';
$('sec-created').value  = profile?.created_at
  ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  : new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
$('sec-lastlogin').value = user.last_sign_in_at
  ? new Date(user.last_sign_in_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

// ── Goals UI ─────────────────────────────────────────────────
const goalsWrap = $('goals-wrap');

function renderGoals() {
  goalsWrap.innerHTML = '';
  if (goals.length === 0) {
    goalsWrap.innerHTML = '<span style="font-size:12px;color:var(--muted);padding:4px;">No goals added yet. Add one below!</span>';
    return;
  }
  goals.forEach((g, i) => {
    const tag = document.createElement('div');
    tag.className = 'goal-tag';
    tag.innerHTML = `${g}<button title="Remove" data-i="${i}">×</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      goals.splice(i, 1);
      renderGoals();
    });
    goalsWrap.appendChild(tag);
  });
}
renderGoals();

$('add-goal-btn').addEventListener('click', () => {
  const v = $('goal-input').value.trim();
  if (!v || goals.includes(v)) return;
  goals.push(v);
  $('goal-input').value = '';
  renderGoals();
});
$('goal-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('add-goal-btn').click();
});

// ── Password strength ─────────────────────────────────────────
$('pw-new').addEventListener('input', () => {
  const pw = $('pw-new').value;
  const bar = $('pw-strength');
  const hint = $('pw-hint');
  if (!pw) { bar.style.cssText = ''; hint.textContent = ''; return; }
  let strength = 0;
  if (pw.length >= 8)  strength++;
  if (/[A-Z]/.test(pw))  strength++;
  if (/[0-9]/.test(pw))  strength++;
  if (/[^A-Za-z0-9]/.test(pw)) strength++;
  const colors = ['#e74c3c','#e67e22','#f1c40f','#27ae60'];
  const labels = ['Too weak','Weak','Good','Strong'];
  bar.style.width      = `${strength * 25}%`;
  bar.style.background = colors[strength - 1] ?? '#eee';
  bar.style.height     = '4px';
  hint.textContent     = labels[strength - 1] ?? '';
  hint.style.color     = colors[strength - 1] ?? 'var(--muted)';
});

// ── Save: Personal Info ───────────────────────────────────────
$('save-personal').addEventListener('click', async () => {
  const btn = $('save-personal');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const newName = $('full-name').value.trim() || displayName;
    await updateUserProfile(user.id, {
      full_name:     newName,
      display_name:  $('display-name').value.trim() || null,
      phone:         $('phone').value.trim()        || null,
      date_of_birth: $('dob').value                 || null,
      timezone:      $('timezone').value,
    });
    applyDisplayName($('display-name').value.trim() || newName);
    toast('Personal info saved!');
  } catch (e) {
    toast('Failed to save: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
});

$('cancel-personal').addEventListener('click', () => {
  $('full-name').value    = profile?.full_name    ?? '';
  $('display-name').value = profile?.display_name ?? '';
  $('phone').value        = profile?.phone        ?? '';
  $('dob').value          = profile?.date_of_birth?.slice(0, 10) ?? '';
  $('timezone').value     = profile?.timezone     ?? 'America/New_York';
});

// ── Save: Emergency Contact ───────────────────────────────────
$('save-emergency').addEventListener('click', async () => {
  const btn = $('save-emergency');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await updateClientProfile(user.id, {
      emergency_contact: {
        name:         $('ec-name').value.trim()  || null,
        phone:        $('ec-phone').value.trim() || null,
        relationship: $('ec-rel').value.trim()   || null,
      },
    });
    toast('Emergency contact saved!');
  } catch (e) {
    toast('Failed to save: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Emergency Contact';
  }
});

// ── Save: Preferences ─────────────────────────────────────────
$('save-prefs').addEventListener('click', async () => {
  const btn = $('save-prefs');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await updateClientProfile(user.id, {
      preferred_language: $('pref-lang').value,
      referral_source:    $('referral').value.trim() || null,
    });
    toast('Preferences saved!');
  } catch (e) {
    toast('Failed to save: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Preferences';
  }
});

// ── Save: Goals ───────────────────────────────────────────────
$('save-goals').addEventListener('click', async () => {
  const btn = $('save-goals');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await updateClientProfile(user.id, { goals });
    toast('Goals saved!');
  } catch (e) {
    toast('Failed to save: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Goals';
  }
});

// ── Save: Password ────────────────────────────────────────────
$('save-password').addEventListener('click', async () => {
  const newPw  = $('pw-new').value;
  const confPw = $('pw-confirm').value;

  if (!newPw) { toast('Please enter a new password.', 'error'); return; }
  if (newPw.length < 8) { toast('Password must be at least 8 characters.', 'error'); return; }
  if (newPw !== confPw)  { toast('Passwords do not match.', 'error'); return; }

  const btn = $('save-password');
  btn.disabled = true; btn.textContent = 'Updating…';
  try {
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) throw new Error(error.message);
    $('pw-new').value     = '';
    $('pw-confirm').value = '';
    $('pw-strength').style.cssText = '';
    $('pw-hint').textContent       = '';
    toast('Password updated successfully!');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Update Password';
  }
});

// ── Logout ────────────────────────────────────────────────────
async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/login';
}
$('logoutBtn').addEventListener('click', signOut);
$('danger-signout').addEventListener('click', async () => {
  if (confirm('Sign out of all devices? You will need to log in again.')) {
    await supabase.auth.signOut({ scope: 'global' });
    window.location.href = '/login';
  }
});
