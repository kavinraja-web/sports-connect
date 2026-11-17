require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testPermissions() {
    console.log('--- Testing Anon Key Permissions ---');

    // 1. Read sports_events
    const r1 = await anonClient.from('sports_events').select('*').limit(2);
    console.log('1. Read sports_events:', r1.error ? `FAIL: ${r1.error.message}` : `OK (${r1.data.length} rows)`);

    // 2. Read tournaments
    const r2 = await anonClient.from('tournaments').select('*').limit(2);
    console.log('2. Read tournaments:', r2.error ? `FAIL: ${r2.error.message}` : `OK (${r2.data.length} rows)`);

    // 3. Read marathons
    const r3 = await anonClient.from('marathons').select('*').limit(2);
    console.log('3. Read marathons:', r3.error ? `FAIL: ${r3.error.message}` : `OK (${r3.data.length} rows)`);

    // 4. Read official_duties
    const r4 = await anonClient.from('official_duties').select('*').limit(2);
    console.log('4. Read official_duties:', r4.error ? `FAIL: ${r4.error.message}` : `OK (${r4.data.length} rows)`);

    // 5. Read event_registrations
    const r5 = await anonClient.from('event_registrations').select('*').limit(2);
    console.log('5. Read event_registrations:', r5.error ? `FAIL: ${r5.error.message}` : `OK (${r5.data.length} rows)`);

    // 6. Read users
    const r6 = await anonClient.from('users').select('*').limit(2);
    console.log('6. Read users:', r6.error ? `FAIL: ${r6.error.message}` : `OK (${r6.data.length} rows)`);

    // 7. Test Insert into event_registrations
    const testReg = {
        event_id: 101,
        athlete_id: 'TEST-ATH',
        athlete_name: 'Test Athlete',
        athlete_email: 'test@example.com',
        id_number: 'TEST-ATH',
        registration_details: { test: true },
        registration_date: new Date().toISOString()
    };
    const r7 = await anonClient.from('event_registrations').insert(testReg).select();
    if (r7.error) {
        console.log('7. Insert event_registrations: FAIL:', r7.error.message);
    } else {
        console.log('7. Insert event_registrations: OK! (Created ID:', r7.data[0].id, ')');
        // Clean up
        await anonClient.from('event_registrations').delete().eq('id', r7.data[0].id);
        console.log('   Cleaned up test record.');
    }
}

testPermissions();
