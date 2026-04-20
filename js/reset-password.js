// js/reset-password.js
import { supabase } from './supabase.js';

const form       = document.getElementById('resetPasswordForm');
const emailInput = document.getElementById('email');
const message    = document.getElementById('message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  message.textContent = 'Sending reset email…';
  message.style.color = '';

  // Use the Vercel deployment URL if available, otherwise fall back to current origin
  const redirectTo = `${window.location.origin}/update-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    message.textContent = error.message;
    message.style.color = '#c0392b';
    return;
  }

  message.textContent = '✓ Password reset email sent — check your inbox.';
  message.style.color = '#3D6B35';
});
