require('dotenv').config();
const { supabase } = require('./supabaseClient');

async function inspectTables() {
    const tables = [
        'users',
        'sports_events',
        'event_registrations',
        'tournaments',
        'tournament_registrations',
        'marathons',
        'marathon_registrations',
        'official_duties'
    ];
    for (const t of tables) {
        const { data, error } = await supabase.from(t).select('*').limit(2);
        if (error) {
            console.log(`Table [${t}]: ERROR: ${error.message}`);
        } else {
            console.log(`Table [${t}]: SUCCESS (${data.length} sample rows). Columns:`, data.length > 0 ? Object.keys(data[0]) : 'empty table');
        }
    }
}
inspectTables();
