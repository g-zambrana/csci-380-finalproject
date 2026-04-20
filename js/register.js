// js/register.js
import { supabase } from './supabase.js';

const form = document.getElementById('registerForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const fullNameInput = document.getElementById('fullName');
const message = document.getElementById('message');

if (!form || !emailInput || !passwordInput || !message) {
  console.error('Register page is missing required form elements.');
} else {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');

    const setMessage = (text, type = 'info') => {
      message.textContent = text;

      if (type === 'error') {
        message.style.color = '#c0392b';
      } else if (type === 'success') {
        message.style.color = '#3D6B35';
      } else {
        message.style.color = '';
      }
    };

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const fullName = fullNameInput?.value.trim() || email.split('@')[0];

    if (!email) {
      setMessage('Please enter your email.', 'error');
      return;
    }

    if (!password) {
      setMessage('Please enter your password.', 'error');
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.', 'error');
      return;
    }

    try {
      if (submitButton) submitButton.disabled = true;
      setMessage('Creating account...');

      // After email confirmation, send user back to login page.
      // Make sure this URL is also added in Supabase Auth redirect settings.
      const emailRedirectTo = `${window.location.origin}/login`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName,
            role: 'client',
          },
        },
      });

      if (error) {
        setMessage(error.message, 'error');
        return;
      }

      // On hosted Supabase projects with email confirmation enabled,
      // signUp usually returns a user but no active session until they verify email.
      const user = data?.user;

      if (user?.id) {
        // Best-effort profile row
        const { error: profileError } = await supabase.from('users').upsert(
          {
            id: user.id,
            email,
            full_name: fullName,
            role: 'client',
          },
          { onConflict: 'id' }
        );

        if (profileError) {
          console.warn('Profile upsert warning:', profileError.message);
        }

        // Best-effort streak seed row
        const { error: streakError } = await supabase.from('user_streaks').upsert(
          { user_id: user.id },
          { onConflict: 'user_id' }
        );

        if (streakError) {
          console.warn('Streak upsert warning:', streakError.message);
        }
      }

      // If email confirmations are on, user exists but session is usually null until confirmation.
      if (!data?.session) {
        setMessage(
          '✓ Account created! Check your email to confirm your account, then log in.',
          'success'
        );
        form.reset();

        setTimeout(() => {
          window.location.href = '/login';
        }, 2500);

        return;
      }

      // If email confirmations are off, user may already have a session.
      setMessage('✓ Account created successfully! Redirecting...', 'success');

      setTimeout(() => {
        window.location.href = '/home';
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage('Something went wrong. Please try again.', 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}