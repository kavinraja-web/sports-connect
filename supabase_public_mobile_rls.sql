-- ====================================================================
-- SPORTSCONNECT: ENABLE DIRECT MOBILE ACCESS FOR SUPABASE (NO WI-FI REQUIRED)
-- Run this in your Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/aykhkbaawwiknqxyrkta/sql
-- ====================================================================

-- 1. Grant public/anon access to all tables so mobile APK can read and write directly
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sports_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE marathons DISABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE official_duties DISABLE ROW LEVEL SECURITY;

-- 2. Ensure foreign key athlete_id in event_registrations is nullable
ALTER TABLE event_registrations ALTER COLUMN athlete_id DROP NOT NULL;
