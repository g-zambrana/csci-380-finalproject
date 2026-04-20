-- ============================================================
--  MindBloom × Therapal — Supabase Database Schema
--  Version: 1.0 | Stack: PostgreSQL (Supabase)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  ENUMS
-- ============================================================

CREATE TYPE user_role         AS ENUM ('client', 'therapist', 'staff', 'admin');
CREATE TYPE session_status    AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE session_format    AS ENUM ('video', 'phone', 'in_person');
CREATE TYPE mood_level        AS ENUM ('very_bad', 'bad', 'neutral', 'good', 'very_good');
CREATE TYPE resource_type     AS ENUM ('article', 'exercise', 'video', 'audio', 'worksheet');
CREATE TYPE notification_type AS ENUM ('appointment_reminder', 'mood_reminder', 'journal_prompt',
                                       'new_message', 'resource_shared', 'system');
CREATE TYPE staff_role        AS ENUM ('admin', 'support', 'billing', 'clinical_coordinator');
CREATE TYPE therapist_status  AS ENUM ('active', 'inactive', 'pending_verification');
CREATE TYPE match_status      AS ENUM ('pending', 'active', 'ended');

-- ============================================================
--  CORE TABLES
-- ============================================================

-- ----------------------------------------------------------
--  users  (mirrors Supabase auth.users; extended profile)
-- ----------------------------------------------------------
CREATE TABLE public.users (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email               TEXT UNIQUE NOT NULL,
    full_name           TEXT NOT NULL,
    display_name        TEXT,
    avatar_url          TEXT,
    date_of_birth       DATE,
    phone               TEXT,
    timezone            TEXT DEFAULT 'America/New_York',
    role                user_role NOT NULL DEFAULT 'client',
    is_active           BOOLEAN DEFAULT TRUE,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Client-specific profile (1-to-1 with users where role = 'client')
CREATE TABLE public.client_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emergency_contact   JSONB,           -- { name, phone, relationship }
    insurance_info      JSONB,           -- { provider, member_id, group_id }
    referral_source     TEXT,
    goals               TEXT[],
    preferred_language  TEXT DEFAULT 'en',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
--  staff
-- ----------------------------------------------------------
CREATE TABLE public.staff (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    staff_role      staff_role NOT NULL DEFAULT 'support',
    department      TEXT,
    employee_id     TEXT UNIQUE,
    hire_date       DATE,
    is_active       BOOLEAN DEFAULT TRUE,
    permissions     TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
--  therapists
-- ----------------------------------------------------------
CREATE TABLE public.therapists (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    license_number      TEXT NOT NULL,
    license_state       TEXT NOT NULL,
    license_expiry      DATE NOT NULL,
    npi_number          TEXT,                          -- National Provider Identifier
    credentials         TEXT[],                        -- ['LCSW', 'PhD', 'LPC', ...]
    specializations     TEXT[],                        -- ['anxiety', 'depression', 'trauma', ...]
    treatment_approaches TEXT[],                       -- ['CBT', 'DBT', 'EMDR', ...]
    languages           TEXT[] DEFAULT '{en}',
    bio                 TEXT,
    session_rate_cents  INTEGER,                       -- in cents (e.g. 15000 = $150.00)
    accepts_insurance   BOOLEAN DEFAULT FALSE,
    insurance_accepted  TEXT[],
    session_formats     session_format[] DEFAULT '{video}',
    availability        JSONB,                         -- weekly schedule template
    status              therapist_status DEFAULT 'pending_verification',
    rating_avg          NUMERIC(3,2),
    rating_count        INTEGER DEFAULT 0,
    verified_at         TIMESTAMPTZ,
    verified_by         UUID REFERENCES public.staff(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------
--  user ↔ therapist matches
-- ----------------------------------------------------------
CREATE TABLE public.user_therapist_matches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    therapist_id    UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    status          match_status DEFAULT 'pending',
    matched_at      TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    ended_reason    TEXT,
    notes           TEXT,
    UNIQUE (user_id, therapist_id)
);

-- ============================================================
--  APPOINTMENTS / SESSIONS
-- ============================================================

CREATE TABLE public.appointments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    therapist_id    UUID NOT NULL REFERENCES public.therapists(id) ON DELETE SET NULL,
    title           TEXT DEFAULT 'Therapy Session',
    scheduled_at    TIMESTAMPTZ NOT NULL,
    duration_mins   INTEGER DEFAULT 50,
    format          session_format DEFAULT 'video',
    status          session_status DEFAULT 'scheduled',
    meeting_url     TEXT,                    -- video link (Zoom, Google Meet, etc.)
    notes_client    TEXT,                    -- pre-session notes from client
    notes_therapist TEXT,                    -- therapist's session notes (private)
    cancelled_by    UUID REFERENCES public.users(id),
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,
    reminder_sent   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Appointment reminders log
CREATE TABLE public.appointment_reminders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id  UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    channel         TEXT DEFAULT 'push',     -- 'push' | 'email' | 'sms'
    delivered       BOOLEAN DEFAULT FALSE
);

-- ============================================================
--  MOOD TRACKER
-- ============================================================

CREATE TABLE public.mood_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mood            mood_level NOT NULL,
    energy_level    INTEGER CHECK (energy_level BETWEEN 1 AND 10),
    anxiety_level   INTEGER CHECK (anxiety_level BETWEEN 1 AND 10),
    sleep_hours     NUMERIC(4,1),
    emotions        TEXT[],             -- ['calm', 'hopeful', 'anxious', ...]
    notes           TEXT,
    logged_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Day streak tracking
CREATE TABLE public.user_streaks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    current_streak  INTEGER DEFAULT 0,
    longest_streak  INTEGER DEFAULT 0,
    last_logged_at  DATE,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  JOURNAL
-- ============================================================

CREATE TABLE public.journal_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title           TEXT,
    body            TEXT NOT NULL,
    mood            mood_level,
    tags            TEXT[],
    is_private      BOOLEAN DEFAULT TRUE,
    word_count      INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Journal prompts library
CREATE TABLE public.journal_prompts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_text     TEXT NOT NULL,
    category        TEXT,              -- 'gratitude', 'reflection', 'growth', 'anxiety'
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES public.staff(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  RESOURCES (Articles, Exercises, Videos, etc.)
-- ============================================================

CREATE TABLE public.resources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           TEXT NOT NULL,
    description     TEXT,
    body            TEXT,
    resource_type   resource_type NOT NULL,
    category        TEXT[],           -- ['anxiety', 'mindfulness', 'sleep', ...]
    thumbnail_url   TEXT,
    external_url    TEXT,
    duration_mins   INTEGER,          -- for audio/video
    is_published    BOOLEAN DEFAULT FALSE,
    is_featured     BOOLEAN DEFAULT FALSE,
    created_by      UUID REFERENCES public.staff(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Track which resources a user has saved or completed
CREATE TABLE public.user_resources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    resource_id     UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    is_saved        BOOLEAN DEFAULT FALSE,
    is_completed    BOOLEAN DEFAULT FALSE,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, resource_id)
);

-- Therapist-to-client resource shares
CREATE TABLE public.resource_shares (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id     UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    shared_by       UUID NOT NULL REFERENCES public.users(id),
    shared_with     UUID NOT NULL REFERENCES public.users(id),
    message         TEXT,
    shared_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  DAILY AFFIRMATIONS
-- ============================================================

CREATE TABLE public.affirmations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text            TEXT NOT NULL,
    author          TEXT,
    category        TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES public.staff(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    data            JSONB,            -- arbitrary payload (appointment_id, etc.)
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  MESSAGES (Secure therapist–client messaging)
-- ============================================================

CREATE TABLE public.messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID NOT NULL REFERENCES public.user_therapist_matches(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES public.users(id),
    body            TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  THERAPIST REVIEWS
-- ============================================================

CREATE TABLE public.therapist_reviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id    UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    appointment_id  UUID REFERENCES public.appointments(id),
    rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text     TEXT,
    is_anonymous    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (therapist_id, user_id, appointment_id)
);

-- ============================================================
--  INDEXES
-- ============================================================

CREATE INDEX idx_appointments_user_id      ON public.appointments(user_id);
CREATE INDEX idx_appointments_therapist_id ON public.appointments(therapist_id);
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_mood_logs_user_id         ON public.mood_logs(user_id);
CREATE INDEX idx_mood_logs_logged_at       ON public.mood_logs(logged_at DESC);
CREATE INDEX idx_journal_entries_user_id   ON public.journal_entries(user_id);
CREATE INDEX idx_journal_entries_created   ON public.journal_entries(created_at DESC);
CREATE INDEX idx_notifications_user_id     ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread      ON public.notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_messages_match_id         ON public.messages(match_id);
CREATE INDEX idx_resources_published       ON public.resources(is_published) WHERE is_published = TRUE;

-- ============================================================
--  UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','client_profiles','staff','therapists','appointments',
    'journal_entries','resources','user_therapist_matches'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t
    );
  END LOOP;
END $$;

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapists             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_therapist_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_resources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_reviews      ENABLE ROW LEVEL SECURITY;

-- Helper: check if the current user is staff/admin
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('staff', 'admin')
  );
$$;

-- Helper: check if current user is a therapist
CREATE OR REPLACE FUNCTION public.is_therapist()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'therapist'
  );
$$;

-- users — can read own row; staff can read all
CREATE POLICY "users_select_own"    ON public.users FOR SELECT USING (auth.uid() = id OR public.is_staff());
CREATE POLICY "users_update_own"    ON public.users FOR UPDATE USING (auth.uid() = id);

-- client_profiles
CREATE POLICY "client_profile_own"  ON public.client_profiles FOR ALL USING (auth.uid() = user_id OR public.is_staff());

-- staff — visible to staff and admins only
CREATE POLICY "staff_own"           ON public.staff FOR ALL USING (auth.uid() = user_id OR public.is_staff());

-- therapists — public read of active profiles; write by owner or staff
CREATE POLICY "therapists_read"     ON public.therapists FOR SELECT USING (status = 'active' OR auth.uid() = user_id OR public.is_staff());
CREATE POLICY "therapists_write"    ON public.therapists FOR UPDATE USING (auth.uid() = user_id OR public.is_staff());

-- appointments — client or assigned therapist can access own rows
CREATE POLICY "appointments_access" ON public.appointments FOR ALL USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT user_id FROM public.therapists WHERE id = therapist_id)
    OR public.is_staff()
);

-- mood_logs — private to user
CREATE POLICY "mood_own"            ON public.mood_logs FOR ALL USING (auth.uid() = user_id);

-- journal_entries — strictly private
CREATE POLICY "journal_own"         ON public.journal_entries FOR ALL USING (auth.uid() = user_id);

-- resources — published resources readable by all authenticated users
CREATE POLICY "resources_read"      ON public.resources FOR SELECT USING (is_published = TRUE OR public.is_staff());
CREATE POLICY "resources_write"     ON public.resources FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "resources_update"    ON public.resources FOR UPDATE USING (public.is_staff());

-- user_resources
CREATE POLICY "user_resources_own"  ON public.user_resources FOR ALL USING (auth.uid() = user_id);

-- notifications — private to recipient
CREATE POLICY "notifications_own"   ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- messages — sender or recipient via match
CREATE POLICY "messages_access"     ON public.messages FOR ALL USING (
    auth.uid() = sender_id
    OR auth.uid() = (SELECT user_id FROM public.user_therapist_matches WHERE id = match_id)
    OR auth.uid() = (SELECT t.user_id FROM public.therapists t
                     JOIN public.user_therapist_matches m ON t.id = m.therapist_id
                     WHERE m.id = match_id)
);

-- therapist_reviews — public read; write by the reviewing client
CREATE POLICY "reviews_read"        ON public.therapist_reviews FOR SELECT USING (TRUE);
CREATE POLICY "reviews_write"       ON public.therapist_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
--  SEED — Default affirmations
-- ============================================================

INSERT INTO public.affirmations (text, category) VALUES
  ('You are doing better than you think. Every small step forward is progress worth celebrating.', 'encouragement'),
  ('Healing is not linear. Be patient and gentle with yourself today.', 'self-compassion'),
  ('You have survived every difficult day so far. That is strength.', 'resilience'),
  ('Your feelings are valid. You deserve care and support.', 'validation'),
  ('Progress, not perfection. You are enough exactly as you are.', 'encouragement');

-- ============================================================
--  SEED — Sample journal prompts
-- ============================================================

INSERT INTO public.journal_prompts (prompt_text, category) VALUES
  ('What is one thing you are grateful for today?', 'gratitude'),
  ('Describe a moment this week when you felt at peace.', 'reflection'),
  ('What is one challenge you faced recently, and what did it teach you?', 'growth'),
  ('Write about a person who makes you feel safe and why.', 'connection'),
  ('What does your ideal day look like? How can you bring one element of it into tomorrow?', 'growth');


-- ============================================================
--  PATCH v1.1 — Apply these in the Supabase SQL Editor to fix
--  "Could not find the table public.users in the schema cache"
--  and profile-save failures.
-- ============================================================

-- 1. Missing INSERT policy on public.users
--    (upsert needs INSERT + UPDATE; only UPDATE existed before)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_insert_own'
  ) THEN
    EXECUTE $q$
      CREATE POLICY "users_insert_own"
      ON public.users
      FOR INSERT
      WITH CHECK (auth.uid() = id);
    $q$;
  END IF;
END $$;

-- 2. GRANT table access to the authenticated role
--    PostgREST must see these tables; without GRANT they are
--    invisible in the schema cache even if RLS policies exist.
GRANT USAGE  ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE        ON public.users             TO authenticated;
GRANT ALL                           ON public.client_profiles   TO authenticated;
GRANT ALL                           ON public.mood_logs         TO authenticated;
GRANT ALL                           ON public.user_streaks      TO authenticated;
GRANT ALL                           ON public.journal_entries   TO authenticated;
GRANT SELECT                        ON public.journal_prompts   TO authenticated;
GRANT SELECT                        ON public.therapists        TO authenticated;
GRANT ALL                           ON public.appointments           TO authenticated;
GRANT ALL                           ON public.user_therapist_matches TO authenticated;
GRANT ALL                           ON public.user_resources         TO authenticated;
GRANT SELECT                        ON public.resources              TO authenticated;
GRANT ALL                           ON public.notifications          TO authenticated;
GRANT SELECT                        ON public.affirmations           TO anon, authenticated;
GRANT SELECT                        ON public.therapist_reviews      TO authenticated;

-- Force PostgREST to reload its schema cache so all column/relationship
-- changes take effect immediately without restarting the project.
NOTIFY pgrst, 'reload schema';