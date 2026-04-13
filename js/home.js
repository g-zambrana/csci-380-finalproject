import { supabase } from './supabase.js';

const logoutBtn = document.getElementById('logoutBtn');

async function protectHomePage() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = '/login';
    return;
  }
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login';
});

protectHomePage();