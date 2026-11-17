require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;
let isConfigured = false;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && !supabaseUrl.includes('your-project')) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
        isConfigured = true;
        console.log('[Supabase] Client initialized successfully for:', supabaseUrl);
    } catch (err) {
        console.error('[Supabase] Initialization failed:', err.message);
    }
} else {
    console.warn('[Supabase] Warning: SUPABASE_URL or API keys are not yet configured in .env.');
    console.warn('[Supabase] Operating in local memory fallback mode until .env is configured.');
}

async function testConnection() {
    if (!isConfigured || !supabase) {
        return { 
            connected: false, 
            message: 'Supabase credentials not configured in .env. Using local seed data.' 
        };
    }
    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) throw error;
        return { 
            connected: true, 
            message: 'Connected to Supabase PostgreSQL database successfully!' 
        };
    } catch (err) {
        return { 
            connected: false, 
            error: err.message, 
            message: 'Failed to query Supabase. Please ensure tables are created with supabase_schema.sql.' 
        };
    }
}

module.exports = {
    supabase,
    isSupabaseConfigured: () => isConfigured,
    testConnection
};
