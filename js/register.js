// js/register.js
import { supabase } from './supabase.js';

const form          = document.getElementById('registerForm');
const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const fullNameInput = document.getElementById('fullName');
const message       = document.getElementById('message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email    = emailInput.value.trim();
  const password = passwordInput.value;
  const fullName = fullNameInput?.value.trim() || email.split('@')[0];

  if (password.length < 6) {
    message.textContent = 'Password must be at least 6 characters.';
    message.style.color = '#c0392b';
    return;
  }

  message.textContent = 'Creating account…';
  message.style.color = '';

  // 1. Sign up in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: 'client' } },
  });

  if (error) {
    message.textContent = error.message;
    message.style.color = '#c0392b';
    return;
  }

  // 2. Insert public profile row (best-effort — also handled by dashboard on first load)
  if (data.user) {
    await supabase.from('users').upsert({
      id:        data.user.id,
      email,
      full_name: fullName,
      role:      'client',
    }, { onConflict: 'id' });

    // Seed streak row so the dashboard stat never shows null
    await supabase.from('user_streaks').upsert(
      { user_id: data.user.id },
      { onConflict: 'user_id' }
    );
  }

  message.textContent = '✓ Account created! Check your email to confirm, then log in.';
  message.style.color = '#3D6B35';

  setTimeout(() => { window.location.href = '/login'; }, 2500);
});
