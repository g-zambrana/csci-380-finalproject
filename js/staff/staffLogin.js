// /js/staff/staffLogin.js
import { supabase } from '../supabase.js';

const form = document.getElementById('staffLoginForm');
const emailInput = document.getElementById('staffEmail');
const passwordInput = document.getElementById('staffPassword');
const message = document.getElementById('message');

const ALLOWED_ROLES = ['staff', 'admin', 'therapist'];
const STAFF_DASHBOARD_PATH = '/staff/staff-dashboard';

function setMessage(text, color = '') {
  message.textContent = text;
  message.style.color = color;
}

async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data?.role ?? null;
}

// Redirect already-logged-in users only if they are valid staff
(async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Session check failed:', error.message);
      document.body.style.visibility = 'visible';
      return;
    }

    const session = data?.session;

    if (!session?.user) {
      document.body.style.visibility = 'visible';
      return;
    }

    const role = await getUserRole(session.user.id);

    if (ALLOWED_ROLES.includes(role)) {
      window.location.replace(STAFF_DASHBOARD_PATH);
      return;
    }

    await supabase.auth.signOut();
    setMessage('This portal is only for authorized staff accounts.', '#c0392b');
    document.body.style.visibility = 'visible';
  } catch (err) {
    console.error('Startup auth check failed:', err);
    document.body.style.visibility = 'visible';
  }
})();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  setMessage('Logging in...');
  message.style.color = '';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage(error.message, '#c0392b');
      return;
    }

    const user = data?.user;

    if (!user?.id) {
      setMessage('Unable to verify account.', '#c0392b');
      await supabase.auth.signOut();
      return;
    }

    const role = await getUserRole(user.id);

    if (!ALLOWED_ROLES.includes(role)) {
      await supabase.auth.signOut();
      setMessage('Access denied. Only staff, admin, or therapist accounts can sign in here.', '#c0392b');
      return;
    }

    window.location.href = STAFF_DASHBOARD_PATH;
  } catch (err) {
    console.error('Staff login failed:', err);
    setMessage('Something went wrong. Please try again.', '#c0392b');
  }
});