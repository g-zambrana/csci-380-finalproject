// js/update-password.js
import { supabase } from './supabase.js';

const form                = document.getElementById('updatePasswordForm');
const passwordInput       = document.getElementById('password');
const confirmPasswordInput= document.getElementById('confirmPassword');
const message             = document.getElementById('message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const password        = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (password !== confirmPassword) {
    message.textContent = 'Passwords do not match.';
    message.style.color = '#c0392b';
    return;
  }
  if (password.length < 6) {
    message.textContent = 'Password must be at least 6 characters.';
    message.style.color = '#c0392b';
    return;
  }

  message.textContent = 'Updating password…';
  message.style.color = '';

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    message.textContent = error.message;
    message.style.color = '#c0392b';
    return;
  }

  message.textContent = '✓ Password updated! Redirecting to login…';
  message.style.color = '#3D6B35';

  setTimeout(() => { window.location.href = '/login'; }, 1500);
});
