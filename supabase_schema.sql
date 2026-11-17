-- ====================================================================
-- SPORTSCONNECT SUPABASE DATABASE SCHEMA MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean teardown if rebuilding
DROP TABLE IF EXISTS marathon_registrations CASCADE;
DROP TABLE IF EXISTS tournament_registrations CASCADE;
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS official_duties CASCADE;
DROP TABLE IF EXISTS marathons CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;
DROP TABLE IF EXISTS sports_events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ====================================================================
-- TABLE 1: USERS (Profiles & Roles)
-- ====================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE, -- Can link to auth.users(id)
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    id_number VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Athlete', 'Official', 'Admin')),
    approval_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'denied')),
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_id_number ON users(id_number);
CREATE INDEX idx_users_role_status ON users(role, approval_status);

-- ====================================================================
-- TABLE 2: SPORTS_EVENTS (Official Hosted Events with Dynamic Form)
-- ====================================================================
CREATE TABLE sports_events (
    id BIGSERIAL PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    sport_type VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    event_date VARCHAR(100) NOT NULL,
    organizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organizer_name VARCHAR(255),
    organizer_email VARCHAR(255),
    organizer_id_number VARCHAR(100),
    maximum_participants INTEGER NOT NULL DEFAULT 50 CHECK (maximum_participants > 0),
    registered_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed', 'Active', 'Cancelled')),
    custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb, -- Dynamic registration field schema
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_sports_events_sport ON sports_events(sport_type);
CREATE INDEX idx_sports_events_organizer ON sports_events(organizer_id);

-- ====================================================================
-- TABLE 3: TOURNAMENTS (Standard League Tournaments)
-- ====================================================================
CREATE TABLE tournaments (
    id BIGSERIAL PRIMARY KEY,
    tournament_name VARCHAR(255) NOT NULL,
    sport_type VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    event_date VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
    participants INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================================
-- TABLE 4: MARATHONS (Race Events)
-- ====================================================================
CREATE TABLE marathons (
    id BIGSERIAL PRIMARY KEY,
    marathon_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    event_date VARCHAR(100) NOT NULL,
    registrations INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================================
-- TABLE 5: EVENT_REGISTRATIONS (Athlete Enrollment + Custom Field Answers)
-- ====================================================================
CREATE TABLE event_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id BIGINT NOT NULL REFERENCES sports_events(id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES users(id) ON DELETE SET NULL,
    athlete_name VARCHAR(255) NOT NULL,
    athlete_email VARCHAR(255),
    id_number VARCHAR(100) NOT NULL,
    registration_details JSONB NOT NULL DEFAULT '{}'::jsonb, -- Athlete answers to custom fields
    registration_date VARCHAR(100) DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD'),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_athlete_per_event UNIQUE (event_id, id_number)
);

CREATE INDEX idx_event_reg_event ON event_registrations(event_id);
CREATE INDEX idx_event_reg_athlete ON event_registrations(athlete_id);

-- ====================================================================
-- TABLE 6: OFFICIAL_DUTIES (Match Officiating Rosters)
-- ====================================================================
CREATE TABLE official_duties (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT REFERENCES sports_events(id) ON DELETE SET NULL,
    match_name VARCHAR(255) NOT NULL,
    event_date VARCHAR(100) NOT NULL,
    role_needed VARCHAR(100) NOT NULL,
    assigned_to VARCHAR(255),
    official_id UUID REFERENCES users(id) ON DELETE SET NULL,
    official_id_number VARCHAR(100),
    duty_status VARCHAR(50) NOT NULL DEFAULT 'Open' CHECK (duty_status IN ('Open', 'Assigned', 'Completed')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================================
-- TABLE 7 & 8: TOURNAMENT & MARATHON ACTIVITY SIGNUPS
-- ====================================================================
CREATE TABLE tournament_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_id_number VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE marathon_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marathon_id BIGINT NOT NULL REFERENCES marathons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    user_id_number VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================================
-- TRIGGER: AUTO-UPDATE UPDATED_AT
-- ====================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();
CREATE TRIGGER trg_sports_events_updated_at BEFORE UPDATE ON sports_events FOR EACH ROW EXECUTE PROCEDURE update_timestamp_column();

-- ====================================================================
-- TRIGGER: AUTO-UPDATE REGISTERED_COUNT ON SPORTS_EVENTS
-- ====================================================================
CREATE OR REPLACE FUNCTION update_event_registered_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE sports_events 
        SET registered_count = (SELECT COUNT(*) FROM event_registrations WHERE event_id = NEW.event_id)
        WHERE id = NEW.event_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE sports_events 
        SET registered_count = (SELECT COUNT(*) FROM event_registrations WHERE event_id = OLD.event_id)
        WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_event_reg_count
AFTER INSERT OR DELETE ON event_registrations
FOR EACH ROW EXECUTE PROCEDURE update_event_registered_count();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marathons ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marathon_registrations ENABLE ROW LEVEL SECURITY;

-- Allow public read of active events, tournaments, and marathons
CREATE POLICY "Public read open sports events" ON sports_events FOR SELECT USING (true);
CREATE POLICY "Public read tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public read marathons" ON marathons FOR SELECT USING (true);
CREATE POLICY "Public read duties" ON official_duties FOR SELECT USING (true);

-- Allow service role full access to all tables (Express backend uses service role key)
CREATE POLICY "Service role users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role sports_events" ON sports_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role tournaments" ON tournaments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role marathons" ON marathons FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role event_registrations" ON event_registrations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role official_duties" ON official_duties FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role tournament_registrations" ON tournament_registrations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role marathon_registrations" ON marathon_registrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ====================================================================
-- SEED DATA (Pre-populating platform content)
-- ====================================================================
INSERT INTO users (id, name, email, id_number, role, approval_status) VALUES
('a0000000-0000-0000-0000-000000000001', 'Rahul Sharma', 'rahul@prosports.com', 'ATH-1001', 'Athlete', 'approved'),
('a0000000-0000-0000-0000-000000000002', 'Priya Patel', 'priya@prosports.com', 'ATH-2042', 'Athlete', 'pending'),
('a0000000-0000-0000-0000-000000000003', 'Vikram Singh', 'vikram@prosports.com', 'OFF-3105', 'Official', 'approved'),
('a0000000-0000-0000-0000-000000000004', 'Ananya Iyer', 'ananya@prosports.com', 'OFF-4890', 'Official', 'pending'),
('a0000000-0000-0000-0000-000000000005', 'Rohan Verma', 'rohan@prosports.com', 'ATH-5511', 'Athlete', 'denied')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tournaments (id, tournament_name, sport_type, location, event_date, status, participants) VALUES
(1, 'Inter-College Cup', 'Cricket', 'Apex National Stadium', 'March 15, 2026', 'Open', 42),
(2, 'Pro T20 League Qualifier', 'Cricket', 'City Sports Complex', 'April 05, 2026', 'Open', 28),
(3, 'Champions League Invitational', 'Football', 'St. Jude Arena', 'April 02, 2026', 'Open', 64),
(4, 'Inter-District Super Cup', 'Football', 'Metro Football Turf', 'May 10, 2026', 'Open', 32),
(5, 'National Mat Championship', 'Kabaddi', 'Indoor Sports Dome', 'March 28, 2026', 'Open', 18),
(6, 'State Warriors League', 'Kabaddi', 'East Arena Center', 'April 22, 2026', 'Open', 14),
(7, '100m Sprint Open Trials', 'Track & Field', 'Olympic Track Ground', 'March 20, 2026', 'Open', 55),
(8, 'All-State Athletic Meet', 'Track & Field', 'State Athletic Complex', 'May 14, 2026', 'Open', 80)
ON CONFLICT (id) DO NOTHING;

INSERT INTO marathons (id, marathon_name, location, event_date, registrations) VALUES
(1, 'National City Marathon 2026', 'Central Boulevard', 'April 10th, 2026', 124),
(2, 'Pro Sports 10K Speed Run', 'Lakeside Circuit', 'May 5th, 2026', 78),
(3, 'Coastal Half Marathon (21K)', 'Marina Promenade', 'June 12th, 2026', 53)
ON CONFLICT (id) DO NOTHING;

INSERT INTO official_duties (id, match_name, event_date, role_needed, assigned_to, duty_status) VALUES
(101, 'Cricket: Inter-College Semi-Final', 'March 15, 2026', 'Head Umpire', 'Vikram Singh', 'Assigned'),
(102, 'Football: Champions League QF 1', 'April 02, 2026', 'Lead Referee', NULL, 'Open'),
(103, 'Kabaddi: Warriors League Opening', 'April 22, 2026', 'Line Judge / Scorer', NULL, 'Open'),
(104, 'Track & Field: Sprint Finals', 'March 20, 2026', 'Track Marshal', NULL, 'Open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sports_events (id, event_name, sport_type, location, event_date, organizer_id, organizer_name, organizer_email, organizer_id_number, maximum_participants, registered_count, status, custom_fields) VALUES
(101, 'Pro T20 Cricket Championship 2026', 'Cricket', 'Apex National Stadium, Sector 4', '2026-04-15', 'a0000000-0000-0000-0000-000000000003', 'Vikram Singh', 'vikram@prosports.com', 'OFF-3105', 40, 3, 'Open', '[{"label":"Jersey Size","type":"text","required":true},{"label":"Batting/Bowling Role","type":"select","required":true}]'::jsonb),
(102, 'State Super Football Cup', 'Football', 'City Central Arena', '2026-05-02', 'a0000000-0000-0000-0000-000000000003', 'Vikram Singh', 'vikram@prosports.com', 'OFF-3105', 60, 2, 'Open', '[{"label":"Playing Position","type":"text","required":true},{"label":"Medical Clearance Status","type":"text","required":true}]'::jsonb),
(103, 'National Pro Kabaddi Knockout 2026', 'Kabaddi', 'Indoors Sports Complex, Ring Road', '2026-05-18', NULL, 'Sarah Jenkins', 'sarah@prosports.com', 'OFF-4209', 32, 1, 'Open', '[{"label":"Weight (KG)","type":"number","required":true},{"label":"Raider / Defender","type":"select","required":true}]'::jsonb),
(104, 'Open Grand Prix Athletics & Track 2026', 'Track & Field', 'Metropolitan Olympic Track Stadium', '2026-06-05', NULL, 'Sarah Jenkins', 'sarah@prosports.com', 'OFF-4209', 50, 1, 'Open', '[{"label":"Event Discipline","type":"text","required":true}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_registrations (event_id, athlete_id, athlete_name, athlete_email, id_number, registration_details, registration_date) VALUES
(101, 'a0000000-0000-0000-0000-000000000001', 'Rahul Sharma', 'rahul@prosports.com', 'ATH-1001', '{"mobileNumber":"9876543210","dob":"2000-05-15","gender":"Male","sport":"Cricket","teamClub":"Apex Warriors","experienceLevel":"Advanced","additionalInfo":"Top-order batsman","status":"Approved","customAnswers":{"Jersey Size":"L","Batting/Bowling Role":"All-Rounder"}}'::jsonb, '2026-03-10'),
(101, NULL, 'Amit Kumar', 'amit@example.com', 'ATH-2002', '{"mobileNumber":"9123456789","dob":"2001-08-20","gender":"Male","sport":"Cricket","teamClub":"City Titans","experienceLevel":"Intermediate","additionalInfo":"Right-arm fast bowler","status":"Pending","customAnswers":{"Jersey Size":"M","Batting/Bowling Role":"Batsman"}}'::jsonb, '2026-03-12'),
(101, NULL, 'Suresh Raina', 'suresh@example.com', 'ATH-3003', '{"mobileNumber":"9988776655","dob":"1999-11-27","gender":"Male","sport":"Cricket","teamClub":"Super Strikers","experienceLevel":"Professional","additionalInfo":"State level trophy winner","status":"Approved","customAnswers":{"Jersey Size":"XL","Batting/Bowling Role":"Bowler"}}'::jsonb, '2026-03-14'),
(102, 'a0000000-0000-0000-0000-000000000005', 'Karan Singh', 'karan@example.com', 'ATH-5511', '{"mobileNumber":"9811223344","dob":"2002-03-11","gender":"Male","sport":"Football","teamClub":"Red Hawks FC","experienceLevel":"Advanced","additionalInfo":"Striker, college captain","status":"Approved","customAnswers":{"Playing Position":"Striker","Medical Clearance Status":"Approved by Dr. Patel"}}'::jsonb, '2026-03-18'),
(102, NULL, 'Rohit Roy', 'rohit@example.com', 'ATH-6601', '{"mobileNumber":"9822334455","dob":"2001-07-19","gender":"Male","sport":"Football","teamClub":"United City","experienceLevel":"Intermediate","additionalInfo":"Midfielder","status":"Pending","customAnswers":{"Playing Position":"Midfielder","Medical Clearance Status":"Certified Fit"}}'::jsonb, '2026-03-20'),
(103, NULL, 'Sunil Narwal', 'sunil@example.com', 'ATH-7722', '{"mobileNumber":"9833445566","dob":"1998-09-04","gender":"Male","sport":"Kabaddi","teamClub":"Haryana Lions","experienceLevel":"Professional","additionalInfo":"Left corner defender","status":"Pending","customAnswers":{"Weight (KG)":"78","Raider / Defender":"Defender"}}'::jsonb, '2026-03-22'),
(104, NULL, 'Pooja Verma', 'pooja@example.com', 'ATH-8833', '{"mobileNumber":"9844556677","dob":"2003-01-25","gender":"Female","sport":"Track & Field","teamClub":"Velocity Track Academy","experienceLevel":"Advanced","additionalInfo":"Specializing in 100m sprint","status":"Approved","customAnswers":{"Event Discipline":"100m"}}'::jsonb, '2026-03-25')
ON CONFLICT DO NOTHING;
