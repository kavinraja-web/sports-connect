-- ====================================================================
-- PROSPORTS MOBILE: PERSONALIZED NOTIFICATIONS & PREFERENCES SCHEMA
-- Run this in your Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/aykhkbaawwiknqxyrkta/sql
-- ====================================================================

-- 1. Table: player_preferences
CREATE TABLE IF NOT EXISTS player_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id_number VARCHAR(100) UNIQUE NOT NULL,
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    age_category VARCHAR(50) NOT NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    sports JSONB NOT NULL DEFAULT '[]'::jsonb,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    device_token TEXT,
    device_platform VARCHAR(50) DEFAULT 'android',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_prefs_location ON player_preferences(state, district);
CREATE INDEX IF NOT EXISTS idx_player_prefs_age ON player_preferences(age_category);
CREATE INDEX IF NOT EXISTS idx_player_prefs_notify ON player_preferences(notifications_enabled);

ALTER TABLE player_preferences DISABLE ROW LEVEL SECURITY;

-- 2. Table: player_notifications
CREATE TABLE IF NOT EXISTS player_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id_number VARCHAR(100) NOT NULL,
    event_id BIGINT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sport VARCHAR(100),
    location VARCHAR(255),
    event_date VARCHAR(100),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_notif_user ON player_notifications(user_id_number);
CREATE INDEX IF NOT EXISTS idx_player_notif_read ON player_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_player_notif_event ON player_notifications(event_id);

ALTER TABLE player_notifications DISABLE ROW LEVEL SECURITY;
