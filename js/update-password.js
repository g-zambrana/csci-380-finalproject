import { supabase } from './supabase.js';

const form = document.getElementById('updatePasswordForm');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const message = document.getElementById('message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (password !== confirmPassword) {
    message.textContent = 'Passwords do not match.';
    return;
  }

  if (password.length < 6) {
    message.textContent = 'Password must be at least 6 characters.';
    return;
  }

  message.textContent = 'Updating password...';

  const { error } = await supabase.auth.updateUser({
    password: password
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  message.textContent = 'Password updated successfully. Redirecting to login...';

  setTimeout(() => {
    window.location.href = '/login';
  }, 1500);
});