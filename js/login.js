// js/login.js
import { supabase } from './supabase.js';

const form          = document.getElementById('loginForm');
const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const message       = document.getElementById('message');

// Redirect already-logged-in users straight to the dashboard
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    window.location.replace('/home');
    return;
  }
  document.body.style.visibility = 'visible';
})();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  message.textContent = 'Logging in…';
  message.style.color = '';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    message.textContent = error.message;
    message.style.color = '#c0392b';
    return;
  }

  window.location.href = '/home';
});
