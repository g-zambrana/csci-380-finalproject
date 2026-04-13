import { supabase } from './supabase.js';

const form = document.getElementById('resetPasswordForm');
const emailInput = document.getElementById('email');
const message = document.getElementById('message');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();

  message.textContent = 'Sending reset email...';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://YOUR-DOMAIN.com/update-password'
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  message.textContent = 'Password reset email sent. Check your inbox.';
});