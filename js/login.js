import { supabase } from './supabase.js';

const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const message = document.getElementById('message');

async function startLoginPage() {
  const { data, error } = await supabase.auth.getSession();

  if (!error && data.session) {
    window.location.href = '/home';
    return;
  }

  document.body.style.visibility = 'visible';
}

startLoginPage();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  message.textContent = 'Logging in...';

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  window.location.href = '/home';
});