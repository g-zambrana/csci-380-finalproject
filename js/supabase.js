import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://vlsjefufwdxilvibouyx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsc2plZnVmd2R4aWx2aWJvdXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjU0MjIsImV4cCI6MjA5MTI0MTQyMn0.ueI8iY9M9X6JYm_dTjaR7v7Z6By-2fU0iBUthWiVKF8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


/*
mood_entries
id, user_id, mood_rating, mood_label, note, entry_date, created_at

tasks
id, user_id, title, description, due_date, status, priority, created_at, updated_at

journal_entries
id, user_id, title, category, content, entry_date, created_at, updated_at

therapists
id, profile_id, specialty, phone, bio, is_available, created_at

appointments
id, user_id, therapist_id, appointment_date, appointment_time, status, notes, created_at, updated_at

therapist_availability
id, therapist_id, available_date, start_time, end_time, is_booked

staff_notes
id, staff_id, user_id, appointment_id, note, created_at

staff_actions_log
id, staff_id, action_type, target_id, description, created_at
*/