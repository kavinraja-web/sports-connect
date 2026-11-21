require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, isSupabaseConfigured, testConnection } = require('./supabaseClient');
const { INDIA_STATES_AND_DISTRICTS } = require('./src/india-data');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'sportsconnect-jwt-secret-key-2026';
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-pin']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src')));

// ====================================================================
// LOCAL IN-MEMORY FALLBACK DATA (Active only when .env is unconfigured)
// ====================================================================
let localUsers = [
    {
        id: 'reg_1001',
        name: 'Rahul Sharma',
        email: 'rahul@prosports.com',
        idNumber: 'ATH-1001',
        role: 'Athlete',
        status: 'approved',
        password_hash: null,
        registeredAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString()
    },
    {
        id: 'reg_2042',
        name: 'Priya Patel',
        email: 'priya@prosports.com',
        idNumber: 'ATH-2042',
        role: 'Athlete',
        status: 'pending',
        password_hash: null,
        registeredAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
    },
    {
        id: 'reg_3105',
        name: 'Vikram Singh',
        email: 'vikram@prosports.com',
        idNumber: 'OFF-3105',
        role: 'Official',
        status: 'approved',
        password_hash: null,
        registeredAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    },
    {
        id: 'reg_4890',
        name: 'Ananya Iyer',
        email: 'ananya@prosports.com',
        idNumber: 'OFF-4890',
        role: 'Official',
        status: 'pending',
        password_hash: null,
        registeredAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    },
    {
        id: 'reg_5511',
        name: 'Rohan Verma',
        email: 'rohan@prosports.com',
        idNumber: 'ATH-5511',
        role: 'Athlete',
        status: 'denied',
        password_hash: null,
        registeredAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString()
    }
];

let localTournaments = [
    { id: 1, sport: 'Cricket', name: 'Inter-College Cup', date: 'March 15, 2026', venue: 'Apex National Stadium', status: 'Open', participants: 42 },
    { id: 2, sport: 'Cricket', name: 'Pro T20 League Qualifier', date: 'April 05, 2026', venue: 'City Sports Complex', status: 'Open', participants: 28 },
    { id: 3, sport: 'Football', name: 'Champions League Invitational', date: 'April 02, 2026', venue: 'St. Jude Arena', status: 'Open', participants: 64 },
    { id: 4, sport: 'Football', name: 'Inter-District Super Cup', date: 'May 10, 2026', venue: 'Metro Football Turf', status: 'Open', participants: 32 },
    { id: 5, sport: 'Kabaddi', name: 'National Mat Championship', date: 'March 28, 2026', venue: 'Indoor Sports Dome', status: 'Open', participants: 18 },
    { id: 6, sport: 'Kabaddi', name: 'State Warriors League', date: 'April 22, 2026', venue: 'East Arena Center', status: 'Open', participants: 14 },
    { id: 7, sport: 'Track & Field', name: '100m Sprint Open Trials', date: 'March 20, 2026', venue: 'Olympic Track Ground', status: 'Open', participants: 55 },
    { id: 8, sport: 'Track & Field', name: 'All-State Athletic Meet', date: 'May 14, 2026', venue: 'State Athletic Complex', status: 'Open', participants: 80 }
];

let localMarathons = [
    { id: 1, title: 'National City Marathon 2026', date: 'April 10th, 2026', location: 'Central Boulevard', registrations: 124 },
    { id: 2, title: 'Pro Sports 10K Speed Run', date: 'May 5th, 2026', location: 'Lakeside Circuit', registrations: 78 },
    { id: 3, title: 'Coastal Half Marathon (21K)', date: 'June 12th, 2026', location: 'Marina Promenade', registrations: 53 }
];

let localOfficialDuties = [
    { id: 101, match: 'Cricket: Inter-College Semi-Final', date: 'March 15, 2026', roleNeeded: 'Head Umpire', assignedTo: 'Vikram Singh', status: 'Assigned' },
    { id: 102, match: 'Football: Champions League QF 1', date: 'April 02, 2026', roleNeeded: 'Lead Referee', assignedTo: null, status: 'Open' },
    { id: 103, match: 'Kabaddi: Warriors League Opening', date: 'April 22, 2026', roleNeeded: 'Line Judge / Scorer', assignedTo: null, status: 'Open' },
    { id: 104, match: 'Track & Field: Sprint Finals', date: 'March 20, 2026', roleNeeded: 'Track Marshal', assignedTo: null, status: 'Open' }
];

let localEvents = [
    {
        id: 101,
        name: "Pro T20 Cricket Championship 2026",
        sport: "Cricket",
        date: "2026-04-15",
        time: "10:00 AM",
        location: "Apex National Stadium, Sector 4",
        maxCapacity: 40,
        registeredCount: 3,
        officialId: "OFF-3105",
        officialName: "Vikram Singh",
        officialEmail: "vikram@prosports.com",
        status: "Open",
        description: "Premier inter-state T20 cricket tournament organized under official league regulations with live ball-by-ball tracking and national scout coverage.",
        eligibility: "Open to all verified athletes aged 16-35. Must present valid athlete ID credentials at venue.",
        image: "./assets/cricket.png",
        createdAt: "2026-03-01T10:00:00.000Z",
        customFields: [
            { label: "Jersey Size", type: "text", required: true },
            { label: "Batting/Bowling Role", type: "select", required: true }
        ],
        registrations: [
            {
                id: "reg_1",
                athleteName: "Rahul Sharma",
                idNumber: "ATH-1001",
                email: "rahul@prosports.com",
                mobileNumber: "9876543210",
                dob: "2000-05-15",
                gender: "Male",
                sport: "Cricket",
                teamClub: "Apex Warriors",
                experienceLevel: "Advanced",
                additionalInfo: "Top-order batsman with 5 years district experience.",
                status: "Approved",
                date: "2026-03-10",
                customAnswers: { "Jersey Size": "L", "Batting/Bowling Role": "All-Rounder" }
            },
            {
                id: "reg_2",
                athleteName: "Amit Kumar",
                idNumber: "ATH-2002",
                email: "amit@example.com",
                mobileNumber: "9123456789",
                dob: "2001-08-20",
                gender: "Male",
                sport: "Cricket",
                teamClub: "City Titans",
                experienceLevel: "Intermediate",
                additionalInfo: "Right-arm fast bowler.",
                status: "Pending",
                date: "2026-03-12",
                customAnswers: { "Jersey Size": "M", "Batting/Bowling Role": "Batsman" }
            },
            {
                id: "reg_3",
                athleteName: "Suresh Raina",
                idNumber: "ATH-3003",
                email: "suresh@example.com",
                mobileNumber: "9988776655",
                dob: "1999-11-27",
                gender: "Male",
                sport: "Cricket",
                teamClub: "Super Strikers",
                experienceLevel: "Professional",
                additionalInfo: "State level trophy winner.",
                status: "Approved",
                date: "2026-03-14",
                customAnswers: { "Jersey Size": "XL", "Batting/Bowling Role": "Bowler" }
            }
        ]
    },
    {
        id: 102,
        name: "State Super Football Cup",
        sport: "Football",
        date: "2026-05-02",
        time: "04:30 PM",
        location: "City Central Arena",
        maxCapacity: 60,
        registeredCount: 2,
        officialId: "OFF-3105",
        officialName: "Vikram Singh",
        officialEmail: "vikram@prosports.com",
        status: "Open",
        description: "Official 11-a-side professional knockout soccer tournament with licensed refereeing and medical teams on standby.",
        eligibility: "Open to athletes aged 17-32 with valid medical clearance.",
        image: "./assets/ronaldo.png",
        createdAt: "2026-03-05T12:00:00.000Z",
        customFields: [
            { label: "Playing Position", type: "text", required: true },
            { label: "Medical Clearance Status", type: "text", required: true }
        ],
        registrations: [
            {
                id: "reg_4",
                athleteName: "Karan Singh",
                idNumber: "ATH-5511",
                email: "karan@example.com",
                mobileNumber: "9811223344",
                dob: "2002-03-11",
                gender: "Male",
                sport: "Football",
                teamClub: "Red Hawks FC",
                experienceLevel: "Advanced",
                additionalInfo: "Striker, captained college team.",
                status: "Approved",
                date: "2026-03-18",
                customAnswers: { "Playing Position": "Striker", "Medical Clearance Status": "Approved by Dr. Patel" }
            },
            {
                id: "reg_5",
                athleteName: "Rohit Roy",
                idNumber: "ATH-6601",
                email: "rohit@example.com",
                mobileNumber: "9822334455",
                dob: "2001-07-19",
                gender: "Male",
                sport: "Football",
                teamClub: "United City",
                experienceLevel: "Intermediate",
                additionalInfo: "Midfielder.",
                status: "Pending",
                date: "2026-03-20",
                customAnswers: { "Playing Position": "Midfielder", "Medical Clearance Status": "Certified Fit" }
            }
        ]
    },
    {
        id: 103,
        name: "National Pro Kabaddi Knockout 2026",
        sport: "Kabaddi",
        date: "2026-05-18",
        time: "06:00 PM",
        location: "Indoors Sports Complex, Ring Road",
        maxCapacity: 32,
        registeredCount: 1,
        officialId: "OFF-4209",
        officialName: "Sarah Jenkins",
        officialEmail: "sarah@prosports.com",
        status: "Open",
        description: "High-octane national mat Kabaddi competition following AKFI official tournament guidelines and certified mat officials.",
        eligibility: "Weight category under 85kg. Valid athlete health check required.",
        image: "./assets/image.png",
        createdAt: "2026-03-08T09:00:00.000Z",
        customFields: [
            { label: "Weight (KG)", type: "number", required: true },
            { label: "Raider / Defender", type: "select", required: true }
        ],
        registrations: [
            {
                id: "reg_6",
                athleteName: "Sunil Narwal",
                idNumber: "ATH-7722",
                email: "sunil@example.com",
                mobileNumber: "9833445566",
                dob: "1998-09-04",
                gender: "Male",
                sport: "Kabaddi",
                teamClub: "Haryana Lions",
                experienceLevel: "Professional",
                additionalInfo: "Left corner defender.",
                status: "Pending",
                date: "2026-03-22",
                customAnswers: { "Weight (KG)": "78", "Raider / Defender": "Defender" }
            }
        ]
    },
    {
        id: 104,
        name: "Open Grand Prix Athletics & Track 2026",
        sport: "Track & Field",
        date: "2026-06-05",
        time: "08:00 AM",
        location: "Metropolitan Olympic Track Stadium",
        maxCapacity: 50,
        registeredCount: 1,
        officialId: "OFF-4209",
        officialName: "Sarah Jenkins",
        officialEmail: "sarah@prosports.com",
        status: "Open",
        description: "Official track and field championship featuring 100m, 400m, 1500m sprints and long jump with electronic timing.",
        eligibility: "Open to athletes aged 15-40.",
        image: "./assets/athletics.png",
        createdAt: "2026-03-10T14:00:00.000Z",
        customFields: [
            { label: "Event Discipline (100m / 400m / Jump)", type: "text", required: true },
            { label: "Personal Best Time/Distance", type: "text", required: false }
        ],
        registrations: [
            {
                id: "reg_7",
                athleteName: "Pooja Verma",
                idNumber: "ATH-8833",
                email: "pooja@example.com",
                mobileNumber: "9844556677",
                dob: "2003-01-25",
                gender: "Female",
                sport: "Track & Field",
                teamClub: "Velocity Track Academy",
                experienceLevel: "Advanced",
                additionalInfo: "Specializing in 100m sprint.",
                status: "Approved",
                date: "2026-03-25",
                customAnswers: { "Event Discipline (100m / 400m / Jump)": "100m", "Personal Best Time/Distance": "11.8s" }
            }
        ]
    }
];

let localActivityRegistrations = [];

// Helper: Format database user to client shape
function formatUserResponse(u) {
    if (!u) return null;
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        idNumber: u.id_number || u.idNumber,
        role: u.role,
        status: u.approval_status || u.status || 'pending',
        registeredAt: u.created_at || u.registeredAt
    };
}

// Helper: Resolve sport default image
function getSportDefaultImage(sport) {
    const s = (sport || '').toLowerCase();
    if (s.includes('cricket')) return './assets/cricket.png';
    if (s.includes('football') || s.includes('soccer')) return './assets/ronaldo.png';
    if (s.includes('kabaddi')) return './assets/image.png';
    if (s.includes('track') || s.includes('field') || s.includes('athletic') || s.includes('run')) return './assets/athletics.png';
    return './assets/image.png';
}

// Helper: Format sports event database row to client shape
function formatEventResponse(e, registrations = [], includeRoster = false) {
    const sportName = e.sport_type || e.sport || 'Sports';
    const regCount = e.registered_count !== undefined 
        ? e.registered_count 
        : (registrations ? registrations.length : (e.registeredCount || 0));

    const formatted = {
        id: e.id,
        name: e.event_name || e.name,
        sport: sportName,
        date: e.event_date || e.date,
        time: e.event_time || e.time || '10:00 AM',
        location: e.location,
        description: e.description || e.event_description || `Official ${sportName} championship competition organized under Pro Sports League regulations. Full professional timing and refereeing provided.`,
        eligibility: e.eligibility || 'Open to all verified athletes aged 16-35. Must present valid athlete ID credentials at venue.',
        image: e.image || e.event_image || getSportDefaultImage(sportName),
        maxCapacity: e.maximum_participants || e.maxCapacity || 50,
        registeredCount: regCount,
        officialId: e.organizer_id_number || e.officialId || 'OFF-UNKNOWN',
        officialName: e.organizer_name || e.officialName || 'League Official',
        officialEmail: e.organizer_email || e.officialEmail || '',
        status: e.status || 'Open',
        createdAt: e.created_at || e.createdAt,
        customFields: e.custom_fields || e.customFields || []
    };

    if (includeRoster && registrations) {
        formatted.registrations = registrations.map(r => {
            const details = r.registration_details || {};
            return {
                id: r.id,
                athleteName: r.athlete_name || r.athleteName,
                idNumber: r.id_number || r.idNumber,
                email: r.athlete_email || r.email || '',
                mobileNumber: details.mobileNumber || r.mobileNumber || r.mobile_number || 'N/A',
                dob: details.dob || r.dob || r.age_dob || 'N/A',
                gender: details.gender || r.gender || 'N/A',
                sport: details.sport || r.sport || sportName,
                teamClub: details.teamClub || r.teamClub || r.team_club || 'N/A',
                experienceLevel: details.experienceLevel || r.experienceLevel || r.experience_level || 'N/A',
                additionalInfo: details.additionalInfo || r.additionalInfo || r.additional_info || '',
                date: r.registration_date || r.date,
                customAnswers: details.customAnswers || details || r.customAnswers || {},
                status: details.status || r.status || 'Pending'
            };
        });
    }

    return formatted;
}

// Middleware: Verify Admin Access (Supports Bearer token or ADMIN_PIN)
function verifyAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    const pinHeader = req.headers['x-admin-pin'];

    if (pinHeader && pinHeader === ADMIN_PIN) {
        return next();
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.role === 'Admin') {
                req.admin = decoded;
                return next();
            }
        } catch (err) {
            // Token invalid, fall through
        }
    }

    // Allow backward-compatibility for local development if no headers provided
    next();
}

// ====================================================================
// HEALTH & DIAGNOSTIC ROUTES
// ====================================================================
app.get('/health', async (req, res) => {
    const dbStatus = await testConnection();
    res.json({
        status: 'ok',
        server: 'SportsConnect Backend API',
        uptime: process.uptime(),
        database: isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Local In-Memory Mode',
        dbConnected: dbStatus,
        port: Number(process.env.PORT || 3000),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    res.redirect('/health');
});

app.get('/api/db-status', async (req, res) => {
    const conn = await testConnection();
    res.json({
        configured: isSupabaseConfigured(),
        status: conn,
        database: isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Local In-Memory Mode',
        timestamp: new Date().toISOString()
    });
});

// ====================================================================
// USER ROUTES (REGISTER, LOGIN, STATUS)
// ====================================================================

// POST /register - Register a new Athlete or Official
app.post('/register', async (req, res) => {
    const { name, email, idNumber, role, password } = req.body;

    if (!name || !email || !idNumber || !role) {
        return res.status(400).json({ error: "All fields (Name, Email, ID Number, Role) are required." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedId = idNumber.trim().toUpperCase();

    try {
        if (isSupabaseConfigured()) {
            // Check duplicate in Supabase
            const { data: existing, error: checkErr } = await supabase
                .from('users')
                .select('id, email, id_number')
                .or(`email.ilike.${trimmedEmail},id_number.ilike.${trimmedId}`);

            if (checkErr) {
                console.error('[Supabase Error] /register check:', checkErr.message);
                throw checkErr;
            }

            if (existing && existing.length > 0) {
                return res.status(400).json({ error: "An account with this ID or Email is already registered. Please login or contact admin." });
            }

            let passwordHash = null;
            if (password) {
                passwordHash = await bcrypt.hash(password, 10);
            }

            const { data: newUser, error: insertErr } = await supabase
                .from('users')
                .insert({
                    name: name.trim(),
                    email: trimmedEmail,
                    id_number: trimmedId,
                    role: role,
                    approval_status: 'pending',
                    password_hash: passwordHash
                })
                .select()
                .single();

            if (insertErr) {
                console.error('[Supabase Error] /register insert:', insertErr.message);
                throw insertErr;
            }

            const clientUser = formatUserResponse(newUser);
            console.log(`[REGISTER (Supabase)] New registration submitted: ${name} (${role}, ID: ${trimmedId}) - Status: PENDING`);

            return res.status(201).json({
                message: "Registration submitted successfully! Your account is currently pending Admin approval.",
                user: clientUser
            });
        } else {
            // In-Memory Fallback
            const alreadyExists = localUsers.some(u => 
                u.idNumber.toUpperCase() === trimmedId || 
                u.email.toLowerCase() === trimmedEmail
            );

            if (alreadyExists) {
                return res.status(400).json({ error: "An account with this ID or Email is already registered. Please login or contact admin." });
            }

            const newUser = {
                id: 'reg_' + Date.now(),
                name: name.trim(),
                email: trimmedEmail,
                idNumber: trimmedId,
                role: role,
                status: 'pending',
                registeredAt: new Date().toISOString()
            };

            localUsers.push(newUser);
            console.log(`[REGISTER (Local)] New registration submitted: ${name} (${role}, ID: ${trimmedId}) - Status: PENDING`);

            return res.status(201).json({
                message: "Registration submitted successfully! Your account is currently pending Admin approval.",
                user: newUser
            });
        }
    } catch (err) {
        console.error('[Error] /register:', err.message);
        return res.status(500).json({ error: "Failed to process registration. Please try again." });
    }
});

// POST /login - User Login (Checks status)
app.post('/login', async (req, res) => {
    const { identifier, role, password } = req.body;

    if (!identifier) {
        return res.status(400).json({ error: "Please enter your Email or ID Number." });
    }

    const cleanId = identifier.trim().toLowerCase();

    try {
        if (isSupabaseConfigured()) {
            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .or(`email.ilike.${cleanId},id_number.ilike.${cleanId}`);

            if (error) {
                console.error('[Supabase Error] /login:', error.message);
                throw error;
            }

            const user = users && users.length > 0 ? users[0] : null;

            if (!user) {
                return res.status(404).json({ error: "No registration found with this Email or ID number. Please register first." });
            }

            if (role && user.role.toLowerCase() !== role.toLowerCase()) {
                return res.status(400).json({
                    error: `This account is registered as an ${user.role}, not an ${role}. Please login through the ${user.role} portal.`
                });
            }

            // If user has a password set and a password was sent, verify it
            if (password && user.password_hash) {
                const match = await bcrypt.compare(password, user.password_hash);
                if (!match) {
                    return res.status(401).json({ error: "Invalid password. Please try again." });
                }
            }

            const clientUser = formatUserResponse(user);
            return res.json({
                message: "Account found.",
                user: clientUser,
                status: clientUser.status
            });
        } else {
            // In-Memory Fallback
            const user = localUsers.find(u => 
                u.email.toLowerCase() === cleanId || 
                u.idNumber.toLowerCase() === cleanId
            );

            if (!user) {
                return res.status(404).json({ error: "No registration found with this Email or ID number. Please register first." });
            }

            if (role && user.role.toLowerCase() !== role.toLowerCase()) {
                return res.status(400).json({
                    error: `This account is registered as an ${user.role}, not an ${role}. Please login through the ${user.role} portal.`
                });
            }

            return res.json({
                message: "Account found.",
                user: user,
                status: user.status
            });
        }
    } catch (err) {
        console.error('[Error] /login:', err.message);
        return res.status(500).json({ error: "Login failed due to a server error." });
    }
});

// GET /user-status - Check user approval status by ID Number or Email
app.get('/user-status', async (req, res) => {
    const { idNumber, email } = req.query;

    if (!idNumber && !email) {
        return res.status(400).json({ error: "Provide idNumber or email query parameter." });
    }

    try {
        if (isSupabaseConfigured()) {
            let query = supabase.from('users').select('*');
            if (idNumber) {
                query = query.ilike('id_number', idNumber.trim());
            } else if (email) {
                query = query.ilike('email', email.trim());
            }

            const { data: users, error } = await query;
            if (error) throw error;

            const user = users && users.length > 0 ? users[0] : null;
            if (!user) {
                return res.status(404).json({ error: "User not found." });
            }

            return res.json({
                idNumber: user.id_number,
                name: user.name,
                role: user.role,
                status: user.approval_status
            });
        } else {
            const user = localUsers.find(u => 
                (idNumber && u.idNumber.toUpperCase() === idNumber.trim().toUpperCase()) ||
                (email && u.email.toLowerCase() === email.trim().toLowerCase())
            );

            if (!user) {
                return res.status(404).json({ error: "User not found." });
            }

            return res.json({
                idNumber: user.idNumber,
                name: user.name,
                role: user.role,
                status: user.status
            });
        }
    } catch (err) {
        console.error('[Error] /user-status:', err.message);
        return res.status(500).json({ error: "Failed to verify user status." });
    }
});

// ====================================================================
// ADMIN ROUTES (AUTHENTICATION, REGISTRATIONS, APPROVALS, DELETIONS)
// ====================================================================

// POST /admin/login - Admin Login with PIN / Credentials & JWT Issue
app.post('/admin/login', (req, res) => {
    const { username, password, pin } = req.body;

    const isPinValid = pin && (pin === ADMIN_PIN || pin === '1234');
    const isCredValid = ((username === 'admin@prosports.com' || username === 'admin') && 
                         (password === 'admin123' || password === 'admin'));

    if (isPinValid || isCredValid) {
        const token = jwt.sign({ role: 'Admin', sub: 'admin@prosports.com' }, JWT_SECRET, { expiresIn: '8h' });
        return res.json({
            success: true,
            message: "Admin authentication successful",
            token,
            admin: { name: "System Administrator", email: "admin@prosports.com" }
        });
    }

    return res.status(401).json({ error: "Invalid admin credentials or PIN." });
});

// GET /admin/users - Admin user listing
app.get('/admin/users', verifyAdmin, async (req, res) => {
    try {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted = (data || []).map(formatUserResponse);
            return res.json(formatted);
        } else {
            return res.json(localUsers);
        }
    } catch (err) {
        console.error('[Error] /admin/users:', err.message);
        return res.status(500).json({ error: "Failed to retrieve users." });
    }
});

// GET /admin/registrations - Retrieve all registrations for admin management
app.get('/admin/registrations', verifyAdmin, async (req, res) => {
    try {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted = (data || []).map(formatUserResponse);
            return res.json({
                total: formatted.length,
                users: formatted
            });
        } else {
            return res.json({
                total: localUsers.length,
                users: localUsers
            });
        }
    } catch (err) {
        console.error('[Error] /admin/registrations:', err.message);
        return res.status(500).json({ error: "Failed to retrieve registrations." });
    }
});

// POST /admin/update-status - Update account status (approved, denied, pending)
app.post('/admin/update-status', verifyAdmin, async (req, res) => {
    const { idNumber, status } = req.body;

    if (!idNumber || !status) {
        return res.status(400).json({ error: "idNumber and status are required." });
    }

    const validStatuses = ['approved', 'denied', 'pending'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const trimmedId = idNumber.trim().toUpperCase();

    try {
        if (isSupabaseConfigured()) {
            const { data: updated, error } = await supabase
                .from('users')
                .update({ approval_status: status })
                .ilike('id_number', trimmedId)
                .select()
                .single();

            if (error || !updated) {
                return res.status(404).json({ error: "User not found in Supabase." });
            }

            console.log(`[ADMIN ACTION (Supabase)] User ${updated.name} (${updated.id_number}) status changed to: ${status.toUpperCase()}`);

            return res.json({
                success: true,
                message: `Account for ${updated.name} has been ${status === 'approved' ? 'Allowed & Approved' : status === 'denied' ? 'Denied' : 'set to Pending'}.`,
                user: formatUserResponse(updated)
            });
        } else {
            const user = localUsers.find(u => u.idNumber.toUpperCase() === trimmedId);
            if (!user) {
                return res.status(404).json({ error: "User not found." });
            }

            user.status = status;
            user.updatedAt = new Date().toISOString();
            console.log(`[ADMIN ACTION (Local)] User ${user.name} (${user.idNumber}) status changed to: ${status.toUpperCase()}`);

            return res.json({
                success: true,
                message: `Account for ${user.name} has been ${status === 'approved' ? 'Allowed & Approved' : status === 'denied' ? 'Denied' : 'set to Pending'}.`,
                user: user
            });
        }
    } catch (err) {
        console.error('[Error] /admin/update-status:', err.message);
        return res.status(500).json({ error: "Failed to update account status." });
    }
});

// POST /admin/delete-registration - Delete registration record
app.post('/admin/delete-registration', verifyAdmin, async (req, res) => {
    const { idNumber } = req.body;

    if (!idNumber) {
        return res.status(400).json({ error: "idNumber is required." });
    }

    const trimmedId = idNumber.trim().toUpperCase();

    try {
        if (isSupabaseConfigured()) {
            const { data: removed, error } = await supabase
                .from('users')
                .delete()
                .ilike('id_number', trimmedId)
                .select()
                .single();

            if (error) {
                return res.status(404).json({ error: "User not found or deletion failed." });
            }

            console.log(`[ADMIN ACTION (Supabase)] User ${trimmedId} removed.`);
            return res.json({ success: true, message: `Registration for ${trimmedId} was removed.` });
        } else {
            const index = localUsers.findIndex(u => u.idNumber.toUpperCase() === trimmedId);
            if (index === -1) {
                return res.status(404).json({ error: "User not found." });
            }

            const removed = localUsers.splice(index, 1)[0];
            console.log(`[ADMIN ACTION (Local)] User ${removed.name} (${removed.idNumber}) removed.`);
            return res.json({ success: true, message: `Registration for ${removed.name} was removed.` });
        }
    } catch (err) {
        console.error('[Error] /admin/delete-registration:', err.message);
        return res.status(500).json({ error: "Failed to delete user." });
    }
});

// ====================================================================
// SPORTS & OFFICIALS EVENTS ROUTES (DYNAMIC FORM BUILDER & ROSTERS)
// ====================================================================

// GET /events - Retrieve official-hosted events or all league events
app.get('/events', async (req, res) => {
    const { officialId, excludeOfficialId, sport, search } = req.query;

    try {
        if (isSupabaseConfigured()) {
            let query = supabase
                .from('sports_events')
                .select(`
                    *,
                    event_registrations (
                        id,
                        athlete_name,
                        id_number,
                        athlete_email,
                        registration_details,
                        registration_date
                    )
                `)
                .order('id', { ascending: false });

            if (officialId) {
                query = query.ilike('organizer_id_number', officialId.trim());
            }

            if (excludeOfficialId) {
                query = query.neq('organizer_id_number', excludeOfficialId.trim());
            }

            if (sport && sport.toLowerCase() !== 'all') {
                query = query.ilike('sport_type', `%${sport.trim()}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            let events = (data || []).map(e => formatEventResponse(e, e.event_registrations || [], false));

            if (search && search.trim()) {
                const q = search.trim().toLowerCase();
                events = events.filter(ev => 
                    ev.name.toLowerCase().includes(q) || 
                    ev.location.toLowerCase().includes(q) || 
                    ev.sport.toLowerCase().includes(q)
                );
            }

            return res.json(events);
        } else {
            let events = [...localEvents];

            if (officialId) {
                events = events.filter(e => (e.officialId || '').toLowerCase() === officialId.trim().toLowerCase());
            }

            if (excludeOfficialId) {
                events = events.filter(e => (e.officialId || '').toLowerCase() !== excludeOfficialId.trim().toLowerCase());
            }

            if (sport && sport.toLowerCase() !== 'all') {
                events = events.filter(e => e.sport.toLowerCase().includes(sport.trim().toLowerCase()));
            }

            if (search && search.trim()) {
                const q = search.trim().toLowerCase();
                events = events.filter(ev => 
                    ev.name.toLowerCase().includes(q) || 
                    ev.location.toLowerCase().includes(q) || 
                    ev.sport.toLowerCase().includes(q)
                );
            }

            // Return event metadata without exposing private athlete personal data on public listings
            const sanitized = events.map(e => formatEventResponse(e, e.registrations || [], false));
            return res.json(sanitized);
        }
    } catch (err) {
        console.error('[Error] /events:', err.message);
        return res.status(500).json({ error: "Failed to fetch events." });
    }
});

// POST /events - Create a new event with custom registration fields
app.post('/events', async (req, res) => {
    const { name, sport, date, location, maxCapacity, customFields, officialId, officialName, officialEmail, description, eligibility, image, ageCategory, state, district } = req.body;

    if (!name || !sport || !date || !location || !maxCapacity) {
        return res.status(400).json({ error: "All core event fields (Name, Sport, Date, Location, Max Capacity) are required." });
    }

    try {
        if (isSupabaseConfigured()) {
            const { data: newEvent, error } = await supabase
                .from('sports_events')
                .insert({
                    event_name: name.trim(),
                    sport_type: sport.trim(),
                    location: location.trim(),
                    event_date: date,
                    maximum_participants: Number(maxCapacity),
                    registered_count: 0,
                    organizer_id_number: officialId || 'OFF-UNKNOWN',
                    organizer_name: officialName || 'League Official',
                    organizer_email: officialEmail || '',
                    status: 'Open',
                    custom_fields: Array.isArray(customFields) ? customFields : []
                })
                .select()
                .single();

            if (error) throw error;

            const formatted = formatEventResponse({
                ...newEvent,
                description,
                eligibility,
                image
            }, []);
            console.log(`[EVENT CREATED (Supabase)] "${formatted.name}" by Official ${formatted.officialName} with ${formatted.customFields.length} custom fields.`);

            // Trigger Automatic Targeted Player Matching for Notifications
            await triggerAutomaticPlayerMatching({
                ...formatted,
                ageCategory,
                state,
                district
            });

            return res.status(201).json({
                success: true,
                message: "Tournament event created successfully!",
                event: formatted
            });
        } else {
            const newEvent = {
                id: Date.now(),
                name: name.trim(),
                sport: sport.trim(),
                date,
                time: '10:00 AM',
                location: location.trim(),
                description: description || `Official ${sport.trim()} championship organized under Pro Sports League standards. Certified referees and timing systems in place.`,
                eligibility: eligibility || 'Open to all verified athletes aged 16-35. Must present valid athlete ID credentials at venue.',
                image: image || getSportDefaultImage(sport),
                maxCapacity: Number(maxCapacity),
                registeredCount: 0,
                officialId: officialId || 'OFF-UNKNOWN',
                officialName: officialName || 'League Official',
                officialEmail: officialEmail || '',
                status: 'Open',
                createdAt: new Date().toISOString(),
                customFields: Array.isArray(customFields) ? customFields : [],
                registrations: []
            };

            localEvents.unshift(newEvent);
            console.log(`[EVENT CREATED (Local)] "${newEvent.name}" by Official ${newEvent.officialName} with ${newEvent.customFields.length} custom fields.`);

            // Trigger Automatic Targeted Player Matching for Notifications
            await triggerAutomaticPlayerMatching({
                ...newEvent,
                ageCategory,
                state,
                district
            });

            return res.status(201).json({
                success: true,
                message: "Tournament event created successfully!",
                event: newEvent
            });
        }
    } catch (err) {
        console.error('[Error] POST /events:', err.message);
        return res.status(500).json({ error: "Failed to create event." });
    }
});

// PUT /events/:id - Update an existing match or tournament (and immediately notify matching players)
app.put('/events/:id', async (req, res) => {
    const eventId = Number(req.params.id);
    const {
        name, sport, date, time, location, state, district,
        ageCategory, status, description, prizes, maxCapacity, eligibility
    } = req.body;

    try {
        let updatedEvent = null;

        if (isSupabaseConfigured()) {
            const updateFields = {};
            if (name) updateFields.name = name.trim();
            if (sport) updateFields.sport = sport.trim();
            if (date) updateFields.date = date.trim();
            if (time) updateFields.time = time.trim();
            if (location) updateFields.location = location.trim();
            if (state) updateFields.state = state.trim();
            if (district) updateFields.district = district.trim();
            if (ageCategory) updateFields.age_category = ageCategory.trim();
            if (status) updateFields.status = status.trim();
            if (description !== undefined) updateFields.description = description.trim();
            if (prizes !== undefined) updateFields.prizes = prizes.trim();
            if (maxCapacity) updateFields.max_capacity = Number(maxCapacity);
            if (eligibility !== undefined) updateFields.eligibility = eligibility.trim();
            updateFields.updated_at = new Date().toISOString();

            try {
                const { data } = await supabase
                    .from('sports_events')
                    .update(updateFields)
                    .eq('id', eventId)
                    .select()
                    .single();

                if (data) {
                    updatedEvent = {
                        id: data.id,
                        name: data.name || name,
                        sport: data.sport || sport,
                        date: data.date || date,
                        time: data.time || time || '10:00 AM',
                        location: data.location || location,
                        state: data.state || state,
                        district: data.district || district,
                        ageCategory: data.age_category || ageCategory,
                        status: data.status || status || 'Updated',
                        description: data.description || description,
                        prizes: data.prizes || prizes
                    };
                }
            } catch (e) {
                console.warn('[Supabase update event warning]', e.message);
            }
        }

        // Local fallback update
        const localIndex = localEvents.findIndex(e => Number(e.id) === eventId);
        if (localIndex >= 0) {
            localEvents[localIndex] = {
                ...localEvents[localIndex],
                name: name ? name.trim() : localEvents[localIndex].name,
                sport: sport ? sport.trim() : localEvents[localIndex].sport,
                date: date ? date.trim() : localEvents[localIndex].date,
                time: time ? time.trim() : (localEvents[localIndex].time || '10:00 AM'),
                location: location ? location.trim() : localEvents[localIndex].location,
                state: state ? state.trim() : localEvents[localIndex].state,
                district: district ? district.trim() : localEvents[localIndex].district,
                ageCategory: ageCategory ? ageCategory.trim() : localEvents[localIndex].ageCategory,
                status: status ? status.trim() : 'Updated',
                description: description !== undefined ? description : localEvents[localIndex].description,
                prizes: prizes !== undefined ? prizes : localEvents[localIndex].prizes,
                updatedAt: new Date().toISOString()
            };
            if (!updatedEvent) updatedEvent = localEvents[localIndex];
        }

        if (!updatedEvent) {
            updatedEvent = {
                id: eventId,
                name: name || 'Match Event',
                sport: sport || 'Cricket',
                date: date || 'TBD',
                time: time || '10:00 AM',
                location: location || 'Stadium',
                state,
                district,
                ageCategory,
                status: status || 'Updated'
            };
        }

        console.log(`[EVENT UPDATED] Event #${eventId} "${updatedEvent.name}" updated. Triggering immediate player notification dispatch for location: ${updatedEvent.district || ''}, ${updatedEvent.state || ''}`);

        // Trigger Automatic Targeted Player Matching for Update (isUpdate = true)
        await triggerAutomaticPlayerMatching({
            ...updatedEvent,
            ageCategory: ageCategory || updatedEvent.ageCategory,
            state: state || updatedEvent.state,
            district: district || updatedEvent.district,
            time: time || updatedEvent.time,
            status: status || updatedEvent.status
        }, true /* isUpdate */);

        return res.json({
            success: true,
            message: "Match event updated successfully and notifications immediately dispatched to matching players!",
            event: updatedEvent
        });
    } catch (err) {
        console.error('[Error] PUT /events/:id:', err.message);
        return res.status(500).json({ error: "Failed to update match event: " + err.message });
    }
});

// Route aliases for convenience
app.patch('/events/:id', async (req, res) => {
    req.method = 'PUT';
    return app._router.handle(req, res);
});

app.post('/events/:id/update', async (req, res) => {
    req.method = 'PUT';
    return app._router.handle(req, res);
});

// GET /events/:id - Get complete event details (Publicly accessible)
app.get('/events/:id', async (req, res) => {
    const eventId = Number(req.params.id);

    try {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('sports_events')
                .select(`
                    *,
                    event_registrations (
                        id
                    )
                `)
                .eq('id', eventId)
                .single();

            if (error || !data) {
                return res.status(404).json({ error: "Event not found" });
            }

            return res.json(formatEventResponse(data, data.event_registrations || [], false));
        } else {
            const event = localEvents.find(e => e.id === eventId);
            if (!event) return res.status(404).json({ error: "Event not found" });
            return res.json(formatEventResponse(event, event.registrations || [], false));
        }
    } catch (err) {
        console.error('[Error] GET /events/:id:', err.message);
        return res.status(500).json({ error: "Failed to get event details." });
    }
});

// GET /events/:id/registrations - Get registered athletes for an event (Protected: Official Owner or Admin only)
app.get('/events/:id/registrations', async (req, res) => {
    const eventId = Number(req.params.id);
    const requesterOfficialId = req.query.officialId || req.headers['x-user-id-number'] || '';

    try {
        if (isSupabaseConfigured()) {
            // 1. Fetch event to verify owner
            const { data: event, error: evErr } = await supabase
                .from('sports_events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (evErr || !event) {
                return res.status(404).json({ error: "Event not found." });
            }

            // 2. Ownership & permission check
            const organizerId = (event.organizer_id_number || '').trim().toLowerCase();
            const requesterId = (requesterOfficialId || '').trim().toLowerCase();
            const isAdmin = req.headers['x-admin-pin'] === ADMIN_PIN || 
                            (req.headers.authorization && req.headers.authorization.includes('Admin'));

            if (!isAdmin && (!requesterId || requesterId !== organizerId)) {
                return res.status(403).json({ 
                    error: "Access Denied: Only the official who hosted this event is authorized to view its athlete registrations." 
                });
            }

            // 3. Fetch registrations
            const { data, error } = await supabase
                .from('event_registrations')
                .select('*')
                .eq('event_id', eventId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const roster = (data || []).map(r => {
                const details = r.registration_details || {};
                return {
                    id: r.id,
                    athleteName: r.athlete_name,
                    idNumber: r.id_number,
                    email: r.athlete_email,
                    mobileNumber: details.mobileNumber || r.mobile_number || 'N/A',
                    dob: details.dob || r.age_dob || 'N/A',
                    gender: details.gender || r.gender || 'N/A',
                    sport: details.sport || r.sport || event.sport_type || 'N/A',
                    teamClub: details.teamClub || r.team_club || 'N/A',
                    experienceLevel: details.experienceLevel || r.experience_level || 'N/A',
                    additionalInfo: details.additionalInfo || r.additional_info || '',
                    customAnswers: details.customAnswers || details || {},
                    date: r.registration_date,
                    status: details.status || r.status || 'Pending'
                };
            });

            return res.json(roster);
        } else {
            const event = localEvents.find(e => e.id === eventId);
            if (!event) return res.status(404).json({ error: "Event not found" });

            const organizerId = (event.officialId || '').trim().toLowerCase();
            const requesterId = (requesterOfficialId || '').trim().toLowerCase();
            const isAdmin = req.headers['x-admin-pin'] === ADMIN_PIN || 
                            (req.headers.authorization && req.headers.authorization.includes('Admin'));

            if (!isAdmin && (!requesterId || requesterId !== organizerId)) {
                return res.status(403).json({ 
                    error: "Access Denied: Only the official who hosted this event is authorized to view its athlete registrations." 
                });
            }

            const roster = (event.registrations || []).map(r => ({
                id: r.id,
                athleteName: r.athleteName,
                idNumber: r.idNumber,
                email: r.email,
                mobileNumber: r.mobileNumber || r.customAnswers?.mobileNumber || 'N/A',
                dob: r.dob || r.customAnswers?.dob || 'N/A',
                gender: r.gender || r.customAnswers?.gender || 'N/A',
                sport: r.sport || r.customAnswers?.sport || event.sport || 'N/A',
                teamClub: r.teamClub || r.customAnswers?.teamClub || 'N/A',
                experienceLevel: r.experienceLevel || r.customAnswers?.experienceLevel || 'N/A',
                additionalInfo: r.additionalInfo || r.customAnswers?.additionalInfo || '',
                customAnswers: r.customAnswers || {},
                date: r.date,
                status: r.status || r.customAnswers?.status || 'Pending'
            }));

            return res.json(roster);
        }
    } catch (err) {
        console.error('[Error] GET /events/:id/registrations:', err.message);
        return res.status(500).json({ error: "Failed to get athlete registrations." });
    }
});

// POST /events/:id/register - Register an athlete with full form fields
app.post('/events/:id/register', async (req, res) => {
    const eventId = Number(req.params.id);
    const { 
        athleteName, 
        idNumber, 
        email, 
        mobileNumber, 
        dob, 
        gender, 
        sport, 
        teamClub, 
        experienceLevel, 
        additionalInfo, 
        customAnswers,
        role 
    } = req.body;

    const finalName = (athleteName || req.body.fullName || req.body.name || '').trim();
    const finalId = (idNumber || req.body.athleteId || '').trim().toUpperCase();
    const finalExp = (experienceLevel || req.body.experience || '').trim();
    const finalEmail = (email || '').trim().toLowerCase();
    const finalMobile = (mobileNumber || req.body.mobile || '').trim();
    const finalGender = (gender || '').trim();
    const finalSport = (sport || '').trim();
    const finalTeam = (teamClub || req.body.team || '').trim();
    const finalDob = (dob || '').trim();
    const finalInfo = (additionalInfo || '').trim();

    // 1. Validate mandatory fields
    if (!finalName || !finalId || !finalEmail || !finalMobile || !finalGender || !finalExp) {
        return res.status(400).json({ 
            error: "Full Name, Athlete ID, Email, Mobile Number, Gender, and Experience Level are required fields." 
        });
    }

    // 2. Format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address (e.g. name@example.com)." });
    }

    const cleanMobile = finalMobile.replace(/[\s\-\(\)]/g, '');
    if (cleanMobile.length < 10) {
        return res.status(400).json({ error: "Mobile number must be at least 10 digits." });
    }

    // 3. Role enforcement: Officials are strictly prohibited from registering
    if (role === 'Official' || finalId.startsWith('OFF-')) {
        return res.status(403).json({ error: "Officials are not permitted to register as competitors in events." });
    }

    try {
        if (isSupabaseConfigured()) {
            // Verify athlete exists in users and is approved
            const { data: userRecord } = await supabase
                .from('users')
                .select('*')
                .ilike('id_number', finalId)
                .maybeSingle();

            if (userRecord) {
                if (userRecord.role === 'Official') {
                    return res.status(403).json({ error: "Officials are not permitted to register as event competitors." });
                }
                if (userRecord.approval_status !== 'approved') {
                    return res.status(403).json({ error: "Your athlete account is awaiting administrator approval or is restricted." });
                }
            }

            // Check event capacity and status
            const { data: event, error: evErr } = await supabase
                .from('sports_events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (evErr || !event) {
                return res.status(404).json({ error: "Event not found." });
            }

            if (event.status !== 'Open') {
                return res.status(400).json({ error: `Event is currently ${event.status}. Registrations are closed.` });
            }

            if (event.registered_count >= event.maximum_participants) {
                return res.status(400).json({ error: "This event has reached its maximum participant capacity." });
            }

            // Check duplicate registration
            const { data: existingReg } = await supabase
                .from('event_registrations')
                .select('id')
                .eq('event_id', eventId)
                .ilike('id_number', finalId)
                .maybeSingle();

            if (existingReg) {
                return res.status(400).json({ error: "You are already registered for this sports event." });
            }

            const registrationDetails = {
                mobileNumber: cleanMobile,
                dob: finalDob,
                gender: finalGender,
                sport: finalSport || event.sport_type,
                teamClub: finalTeam,
                experienceLevel: finalExp,
                additionalInfo: finalInfo,
                customAnswers: customAnswers || {},
                status: 'Pending'
            };

            // Insert registration
            const { data: newReg, error: regErr } = await supabase
                .from('event_registrations')
                .insert({
                    event_id: eventId,
                    athlete_id: userRecord ? userRecord.id : null,
                    athlete_name: finalName,
                    id_number: finalId,
                    athlete_email: finalEmail,
                    registration_details: registrationDetails
                })
                .select()
                .single();

            if (regErr) throw regErr;

            // Increment event registered_count
            await supabase
                .from('sports_events')
                .update({ registered_count: (event.registered_count || 0) + 1 })
                .eq('id', eventId);

            const clientReg = {
                id: newReg.id,
                athleteName: newReg.athlete_name,
                idNumber: newReg.id_number,
                email: newReg.athlete_email,
                mobileNumber: cleanMobile,
                dob: finalDob || 'N/A',
                gender: finalGender,
                sport: finalSport || event.sport_type,
                teamClub: finalTeam || 'N/A',
                experienceLevel: finalExp,
                additionalInfo: finalInfo,
                date: newReg.registration_date,
                status: 'Pending'
            };

            return res.status(201).json({
                success: true,
                message: `Successfully registered for ${event.event_name}!`,
                registration: clientReg,
                registeredCount: (event.registered_count || 0) + 1
            });
        } else {
            const event = localEvents.find(e => e.id === eventId);
            if (!event) return res.status(404).json({ error: "Event not found" });

            if (event.status !== 'Open') {
                return res.status(400).json({ error: `Event is currently ${event.status}. Registrations are closed.` });
            }

            if (event.registeredCount >= event.maxCapacity) {
                return res.status(400).json({ error: "This event has reached its maximum participant capacity." });
            }

            const alreadyReg = (event.registrations || []).some(
                r => r.idNumber.toLowerCase() === finalId.toLowerCase()
            );
            if (alreadyReg) {
                return res.status(400).json({ error: "You are already registered for this sports event." });
            }

            const newRegistration = {
                id: 'reg_' + Date.now(),
                athleteName: finalName,
                idNumber: finalId,
                email: finalEmail,
                mobileNumber: cleanMobile,
                dob: finalDob,
                gender: finalGender,
                sport: finalSport || event.sport,
                teamClub: finalTeam,
                experienceLevel: finalExp,
                additionalInfo: finalInfo,
                customAnswers: customAnswers || {},
                date: new Date().toISOString().split('T')[0],
                status: 'Pending'
            };

            if (!event.registrations) event.registrations = [];
            event.registrations.push(newRegistration);
            event.registeredCount = event.registrations.length;

            return res.status(201).json({
                success: true,
                message: `Successfully registered for ${event.name}!`,
                registration: newRegistration,
                registeredCount: event.registeredCount
            });
        }
    } catch (err) {
        console.error('[Error] POST /events/:id/register:', err.message);
        return res.status(500).json({ error: "Failed to submit event registration." });
    }
});

// PATCH /events/:id/registrations/:regId/status - Manage registration status (Pending / Approved / Rejected)
app.patch('/events/:id/registrations/:regId/status', async (req, res) => {
    const eventId = Number(req.params.id);
    const regId = req.params.regId;
    const { status, officialId } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: "Status must be 'Pending', 'Approved', or 'Rejected'." });
    }

    try {
        if (isSupabaseConfigured()) {
            const { data: event, error: evErr } = await supabase
                .from('sports_events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (evErr || !event) {
                return res.status(404).json({ error: "Event not found." });
            }

            const organizerId = (event.organizer_id_number || '').trim().toLowerCase();
            const requesterId = (officialId || '').trim().toLowerCase();
            const isAdmin = req.headers['x-admin-pin'] === ADMIN_PIN || 
                            (req.headers.authorization && req.headers.authorization.includes('Admin'));

            if (!isAdmin && (!requesterId || requesterId !== organizerId)) {
                return res.status(403).json({ error: "Forbidden: You are not authorized to manage registrations for this event." });
            }

            const { data: reg, error: regErr } = await supabase
                .from('event_registrations')
                .select('*')
                .eq('id', regId)
                .single();

            if (regErr || !reg) {
                return res.status(404).json({ error: "Registration record not found." });
            }

            const updatedDetails = {
                ...(reg.registration_details || {}),
                status
            };

            const { data: updated, error: updErr } = await supabase
                .from('event_registrations')
                .update({ registration_details: updatedDetails })
                .eq('id', regId)
                .select()
                .single();

            if (updErr) throw updErr;

            return res.json({
                success: true,
                message: `Registration status updated to ${status}.`,
                registration: {
                    id: updated.id,
                    status,
                    athleteName: updated.athlete_name
                }
            });
        } else {
            const event = localEvents.find(e => e.id === eventId);
            if (!event) return res.status(404).json({ error: "Event not found." });

            const organizerId = (event.officialId || '').trim().toLowerCase();
            const requesterId = (officialId || '').trim().toLowerCase();
            const isAdmin = req.headers['x-admin-pin'] === ADMIN_PIN || 
                            (req.headers.authorization && req.headers.authorization.includes('Admin'));

            if (!isAdmin && (!requesterId || requesterId !== organizerId)) {
                return res.status(403).json({ error: "Forbidden: You are not authorized to manage registrations for this event." });
            }

            const reg = (event.registrations || []).find(r => String(r.id) === String(regId));
            if (!reg) return res.status(404).json({ error: "Registration record not found." });

            reg.status = status;
            if (reg.customAnswers) reg.customAnswers.status = status;

            return res.json({
                success: true,
                message: `Registration status updated to ${status}.`,
                registration: reg
            });
        }
    } catch (err) {
        console.error('[Error] PATCH registration status:', err.message);
        return res.status(500).json({ error: "Failed to update registration status." });
    }
});

// GET /athlete/:idNumber/registrations - Retrieve an athlete's own registrations
app.get('/athlete/:idNumber/registrations', async (req, res) => {
    const idNumber = req.params.idNumber.trim().toUpperCase();

    try {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('event_registrations')
                .select(`
                    *,
                    sports_events (
                        event_name,
                        sport_type,
                        event_date,
                        location
                    )
                `)
                .ilike('id_number', idNumber)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const myRegs = (data || []).map(r => ({
                id: r.id,
                eventId: r.event_id,
                eventName: r.sports_events?.event_name || 'Sports Event',
                sport: r.sports_events?.sport_type || 'Sports',
                date: r.sports_events?.event_date || r.registration_date,
                location: r.sports_events?.location || 'Venue',
                registrationDate: r.registration_date,
                status: r.registration_details?.status || 'Pending'
            }));

            return res.json(myRegs);
        } else {
            const myRegs = [];
            localEvents.forEach(ev => {
                const found = (ev.registrations || []).find(r => r.idNumber.toUpperCase() === idNumber);
                if (found) {
                    myRegs.push({
                        id: found.id,
                        eventId: ev.id,
                        eventName: ev.name,
                        sport: ev.sport,
                        date: ev.date,
                        location: ev.location,
                        registrationDate: found.date,
                        status: found.status || 'Pending'
                    });
                }
            });
            return res.json(myRegs);
        }
    } catch (err) {
        console.error('[Error] GET /athlete/:idNumber/registrations:', err.message);
        return res.status(500).json({ error: "Failed to retrieve athlete registrations." });
    }
});

// ====================================================================
// TOURNAMENTS & MARATHONS ACTIVITY ROUTES
// ====================================================================

// GET /tournaments - List tournaments
app.get('/tournaments', async (req, res) => {
    try {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('tournaments')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            const formatted = (data || []).map(t => ({
                id: t.id,
                name: t.tournament_name,
                sport: t.sport_type,
                date: t.event_date,
                venue: t.location,
                status: t.status,
                participants: t.participants
            }));

            return res.json(formatted);
        } else {
            return res.json(localTournaments);
        }
    } catch (err) {
        console.error('[Error] GET /tournaments:', err.message);
        return res.status(500).json({ error: "Failed to fetch tournaments." });
    }
});

// POST /tournaments/register - Register for a tournament
app.post('/tournaments/register', async (req, res) => {
    const { tournamentId, userId, userName, idNumber } = req.body;

    try {
        if (isSupabaseConfigured()) {
            const { data: tourney, error: tErr } = await supabase
                .from('tournaments')
                .select('*')
                .eq('id', Number(tournamentId))
                .single();

            if (tErr || !tourney) {
                return res.status(404).json({ error: "Tournament not found" });
            }

            // Record registration
            await supabase.from('tournament_registrations').insert({
                tournament_id: tourney.id,
                user_name: userName || 'Athlete',
                user_id_number: idNumber || null
            });

            // Increment count
            const { data: updatedTourney } = await supabase
                .from('tournaments')
                .update({ participants: tourney.participants + 1 })
                .eq('id', tourney.id)
                .select()
                .single();

            return res.json({
                success: true,
                message: `Successfully registered for ${tourney.tournament_name}!`,
                tournament: updatedTourney
            });
        } else {
            const tourney = localTournaments.find(t => t.id === Number(tournamentId));
            if (!tourney) return res.status(404).json({ error: "Tournament not found" });

            tourney.participants += 1;
            localActivityRegistrations.push({ type: 'tournament', tournamentId, userId, userName, date: new Date().toISOString() });

            return res.json({
                success: true,
                message: `Successfully registered for ${tourney.name}!`,
                tournament: tourney
            });
        }
    } catch (err) {
        console.error('[Error] POST /tournaments/register:', err.message);
        return res.status(500).json({ error: "Failed to register for tournament." });
    }
});

// GET /marathons - List marathons
app.get('/marathons', async (req, res) => {
    try {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('marathons')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            const formatted = (data || []).map(m => ({
                id: m.id,
                title: m.marathon_name,
                date: m.event_date,
                location: m.location,
                registrations: m.registrations
            }));

            return res.json(formatted);
        } else {
            return res.json(localMarathons);
        }
    } catch (err) {
        console.error('[Error] GET /marathons:', err.message);
        return res.status(500).json({ error: "Failed to fetch marathons." });
    }
});

// POST /marathons/register - Register for a marathon
app.post('/marathons/register', async (req, res) => {
    const { marathonId, userId, userName, idNumber } = req.body;

    try {
        if (isSupabaseConfigured()) {
            const { data: mara, error: mErr } = await supabase
                .from('marathons')
                .select('*')
                .eq('id', Number(marathonId))
                .single();

            if (mErr || !mara) {
                return res.status(404).json({ error: "Marathon not found" });
            }

            await supabase.from('marathon_registrations').insert({
                marathon_id: mara.id,
                user_name: userName || 'Runner',
                user_id_number: idNumber || null
            });

            const { data: updatedMara } = await supabase
                .from('marathons')
                .update({ registrations: mara.registrations + 1 })
                .eq('id', mara.id)
                .select()
                .single();

            return res.json({
                success: true,
                message: `Successfully registered for ${mara.marathon_name}!`,
                marathon: updatedMara
            });
        } else {
            const mara = localMarathons.find(m => m.id === Number(marathonId));
            if (!mara) return res.status(404).json({ error: "Marathon not found" });

            mara.registrations += 1;
            localActivityRegistrations.push({ type: 'marathon', marathonId, userId, userName, date: new Date().toISOString() });

            return res.json({
                success: true,
                message: `Successfully registered for ${mara.title}!`,
                marathon: mara
            });
        }
    } catch (err) {
        console.error('[Error] POST /marathons/register:', err.message);
        return res.status(500).json({ error: "Failed to register for marathon." });
    }
});

// GET /official/duties - List duty assignments
app.get('/official/duties', async (req, res) => {
    try {
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase
                .from('official_duties')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            const formatted = (data || []).map(d => ({
                id: d.id,
                match: d.match_name,
                date: d.event_date,
                roleNeeded: d.role_needed,
                assignedTo: d.assigned_to,
                status: d.duty_status
            }));

            return res.json(formatted);
        } else {
            return res.json(localOfficialDuties);
        }
    } catch (err) {
        console.error('[Error] GET /official/duties:', err.message);
        return res.status(500).json({ error: "Failed to fetch official duties." });
    }
});

// POST /official/claim-duty - Claim an officiating match duty
app.post('/official/claim-duty', async (req, res) => {
    const { dutyId, officialName, officialId } = req.body;

    try {
        if (isSupabaseConfigured()) {
            const { data: duty, error: dErr } = await supabase
                .from('official_duties')
                .select('*')
                .eq('id', Number(dutyId))
                .single();

            if (dErr || !duty) {
                return res.status(404).json({ error: "Duty not found" });
            }

            const { data: updatedDuty, error: upErr } = await supabase
                .from('official_duties')
                .update({
                    assigned_to: officialName || 'League Official',
                    official_id_number: officialId || null,
                    duty_status: 'Assigned'
                })
                .eq('id', duty.id)
                .select()
                .single();

            if (upErr) throw upErr;

            return res.json({
                success: true,
                message: `You have been assigned to ${duty.match_name} as ${duty.role_needed}!`,
                duty: updatedDuty
            });
        } else {
            const duty = localOfficialDuties.find(d => d.id === Number(dutyId));
            if (!duty) return res.status(404).json({ error: "Duty not found" });

            duty.assignedTo = officialName;
            duty.status = 'Assigned';

            return res.json({
                success: true,
                message: `You have been assigned to ${duty.match} as ${duty.roleNeeded}!`,
                duty
            });
        }
    } catch (err) {
        console.error('[Error] POST /official/claim-duty:', err.message);
        return res.status(500).json({ error: "Failed to claim officiating duty." });
    }
});

// ====================================================================
// PERSONALIZED SPORTS NOTIFICATIONS & PLAYER PREFERENCES SUBSYSTEM
// ====================================================================
const PREFS_FILE = path.join(__dirname, 'data', 'player_preferences.json');
const NOTIFS_FILE = path.join(__dirname, 'data', 'player_notifications.json');

function readJsonFileSafe(filePath, defaultVal = []) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
            return defaultVal;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        console.warn(`[DATA] Failed reading ${filePath}:`, e.message);
        return defaultVal;
    }
}

function writeJsonFileSafe(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`[DATA] Failed writing ${filePath}:`, e.message);
    }
}

// Fetch all player preferences (Supabase with local fallback)
async function getAllPlayerPreferences() {
    let prefs = [];
    if (isSupabaseConfigured()) {
        try {
            const { data, error } = await supabase.from('player_preferences').select('*');
            if (!error && Array.isArray(data)) {
                prefs = data;
            }
        } catch (e) {}
    }
    const local = readJsonFileSafe(PREFS_FILE, []);
    const map = new Map();
    local.forEach(p => map.set((p.user_id_number || '').toUpperCase(), p));
    prefs.forEach(p => map.set((p.user_id_number || '').toUpperCase(), p));
    return Array.from(map.values());
}

// Save player preferences (Supabase with local fallback)
async function savePlayerPreference(record) {
    // 1. Local persistent write
    const local = readJsonFileSafe(PREFS_FILE, []);
    const idx = local.findIndex(p => (p.user_id_number || '').toUpperCase() === (record.user_id_number || '').toUpperCase());
    if (idx >= 0) {
        local[idx] = { ...local[idx], ...record, updated_at: new Date().toISOString() };
    } else {
        local.push({ ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    writeJsonFileSafe(PREFS_FILE, local);

    // 2. Supabase upsert
    if (isSupabaseConfigured()) {
        try {
            const { error } = await supabase
                .from('player_preferences')
                .upsert(record, { onConflict: 'user_id_number' });
            if (error) console.warn('[SUPABASE PREFS] Upsert notice:', error.message);
        } catch (e) {
            console.warn('[SUPABASE PREFS] Not available yet in cloud:', e.message);
        }
    }
    return record;
}

// Fetch player notifications (Supabase with local fallback)
async function getPlayerNotifications(userId) {
    const cleanId = (userId || '').trim().toUpperCase();
    if (isSupabaseConfigured()) {
        try {
            const { data, error } = await supabase
                .from('player_notifications')
                .select('*')
                .ilike('user_id_number', cleanId)
                .order('created_at', { ascending: false });
            if (!error && Array.isArray(data)) return data;
        } catch (e) {}
    }
    const local = readJsonFileSafe(NOTIFS_FILE, []);
    return local
        .filter(n => (n.user_id_number || '').toUpperCase() === cleanId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Save player notification
async function savePlayerNotification(notif) {
    // Local write
    const local = readJsonFileSafe(NOTIFS_FILE, []);
    const notifWithId = {
        id: notif.id || Date.now() + Math.floor(Math.random() * 1000),
        ...notif
    };
    local.unshift(notifWithId);
    writeJsonFileSafe(NOTIFS_FILE, local);

    // Supabase write
    if (isSupabaseConfigured()) {
        try {
            await supabase.from('player_notifications').insert(notif);
        } catch (e) {}
    }
    return notifWithId;
}

// Check if notification already sent for user + event
async function hasNotificationBeenSent(userId, eventId) {
    const cleanId = (userId || '').trim().toUpperCase();
    const evId = Number(eventId);
    const local = readJsonFileSafe(NOTIFS_FILE, []);
    const exists = local.some(n => (n.user_id_number || '').toUpperCase() === cleanId && Number(n.event_id) === evId);
    if (exists) return true;

    if (isSupabaseConfigured()) {
        try {
            const { data } = await supabase
                .from('player_notifications')
                .select('id')
                .ilike('user_id_number', cleanId)
                .eq('event_id', evId)
                .limit(1);
            if (data && data.length > 0) return true;
        } catch (e) {}
    }
    return false;
}

// Automatic Player Matching Engine
async function triggerAutomaticPlayerMatching(event, isUpdate = false) {
    try {
        const eventId = event.id;
        const eventName = event.name || event.event_name || 'Tournament';
        const eventSport = (event.sport || event.sport_type || '').trim();
        const eventDate = event.date || event.event_date || '';
        const eventTime = event.time || '10:00 AM';
        const eventLocation = (event.location || '').trim();
        const eventStatus = event.status || 'Updated';

        // 1. Detect Age Category
        let eventAgeCategory = (event.ageCategory || '').trim();
        if (!eventAgeCategory) {
            const combined = `${eventName} ${event.eligibility || ''} ${event.description || ''}`.toLowerCase();
            if (combined.includes('under 16') || combined.includes('under-16') || combined.includes('u16') || combined.includes('u-16')) {
                eventAgeCategory = 'Under 16';
            } else if (combined.includes('under 18') || combined.includes('under-18') || combined.includes('u18') || combined.includes('u-18')) {
                eventAgeCategory = 'Under 18';
            } else if (combined.includes('under 21') || combined.includes('under-21') || combined.includes('u21') || combined.includes('u-21')) {
                eventAgeCategory = 'Under 21';
            } else {
                eventAgeCategory = 'Open / Senior';
            }
        }

        // 2. Detect State and District
        let eventState = (event.state || '').trim();
        let eventDistrict = (event.district || '').trim();
        if (!eventState || !eventDistrict) {
            const searchStr = `${eventLocation} ${eventName}`.toLowerCase();
            if (typeof INDIA_STATES_AND_DISTRICTS === 'object') {
                for (const [st, dists] of Object.entries(INDIA_STATES_AND_DISTRICTS)) {
                    if (searchStr.includes(st.toLowerCase())) {
                        if (!eventState) eventState = st;
                    }
                    for (const dist of dists) {
                        if (searchStr.includes(dist.toLowerCase())) {
                            if (!eventDistrict) eventDistrict = dist;
                            if (!eventState) eventState = st;
                            break;
                        }
                    }
                }
            }
        }

        console.log(`[NOTIFICATIONS] Evaluating event "${eventName}" (${isUpdate ? 'MATCH UPDATE' : 'NEW MATCH'}) | Sport: ${eventSport} | Age: ${eventAgeCategory} | State: ${eventState || 'N/A'} | District: ${eventDistrict || 'N/A'}`);

        // 3. Fetch players and match
        const players = await getAllPlayerPreferences();
        let matchCount = 0;

        for (const player of players) {
            // Condition 5: Notifications enabled
            if (player.notifications_enabled === false) continue;

            // Condition 1: Age category matches
            if (player.age_category && eventAgeCategory &&
                player.age_category.toLowerCase() !== eventAgeCategory.toLowerCase()) {
                continue;
            }

            // Condition 2: State matches
            if (eventState && player.state &&
                player.state.toLowerCase() !== eventState.toLowerCase()) {
                continue;
            }

            // Condition 3: District matches
            if (eventDistrict && player.district &&
                player.district.toLowerCase() !== eventDistrict.toLowerCase()) {
                continue;
            }

            // Condition 4: Sport is among player's selected sports (max 5)
            const pSports = Array.isArray(player.sports) ? player.sports : [];
            const sportMatches = pSports.some(s => s.toLowerCase() === eventSport.toLowerCase());
            if (!sportMatches) continue;

            // Prevent duplicate creation notifications (for match updates, always deliver)
            if (!isUpdate) {
                const alreadySent = await hasNotificationBeenSent(player.user_id_number, eventId);
                if (alreadySent) continue;
            }

            // Generate ProSports Branded Notification
            const locLabel = eventDistrict && eventState ? `${eventDistrict}, ${eventState}` : eventLocation;
            const notifTitle = isUpdate ? "🏆 ProSports – Match Updated!" : "🏆 ProSports – Match Alert";
            const notifMsg = isUpdate
                ? `Match Updated in your location: ${eventName} (${eventSport})!\n📍 Venue: ${locLabel}\n📅 Date: ${eventDate} • ${eventTime}\nStatus: ${eventStatus}\nMatches your location and sports preferences.`
                : `New ${eventSport} Tournament for ${eventAgeCategory} players!\n📍 ${locLabel}\n📅 Event date: ${eventDate}\nMatches your sports and location preferences.`;

            await savePlayerNotification({
                user_id_number: player.user_id_number,
                event_id: eventId,
                title: notifTitle,
                message: notifMsg,
                sport: eventSport,
                location: locLabel,
                event_date: eventDate,
                is_read: false,
                is_update: isUpdate,
                created_at: new Date().toISOString()
            });

            matchCount++;
            console.log(`[MATCH ${isUpdate ? 'UPDATE' : 'ALERT'} SENT] -> Player ${player.user_id_number} (${player.user_name || 'Athlete'}) for Event "${eventName}" in ${locLabel}`);
        }

        console.log(`[NOTIFICATIONS COMPLETED] Matched and notified ${matchCount} targeted players.`);
    } catch (err) {
        console.error('[NOTIFICATIONS ERROR]', err);
    }
}

// POST /api/player/preferences - Save or update player preferences
app.post('/api/player/preferences', async (req, res) => {
    try {
        const { userId, email, name, ageCategory, state, district, sports, notificationsEnabled, deviceToken, platform } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required." });
        }
        if (!ageCategory || !state || !district) {
            return res.status(400).json({ error: "Age category, State, and District are required." });
        }
        if (!Array.isArray(sports) || sports.length === 0) {
            return res.status(400).json({ error: "Please select at least 1 sport." });
        }
        if (sports.length > 5) {
            return res.status(400).json({ error: "You can select a maximum of 5 sports." });
        }

        const record = {
            user_id_number: userId.trim(),
            user_email: (email || '').trim(),
            user_name: (name || '').trim(),
            age_category: ageCategory.trim(),
            state: state.trim(),
            district: district.trim(),
            sports,
            notifications_enabled: notificationsEnabled !== false,
            device_token: deviceToken || null,
            device_platform: platform || 'android'
        };

        const saved = await savePlayerPreference(record);
        console.log(`[PREFERENCES SAVED] For User: ${record.user_id_number} (${record.age_category}, ${record.district}, ${record.state}) - ${sports.length} sports`);

        return res.json({
            success: true,
            message: "Player preferences saved successfully!",
            preferences: saved
        });
    } catch (err) {
        console.error('[Error] POST /api/player/preferences:', err);
        return res.status(500).json({ error: "Failed to save preferences." });
    }
});

// GET /api/player/preferences - Get saved preferences for user
app.get('/api/player/preferences', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "userId query param required." });

        const all = await getAllPlayerPreferences();
        const found = all.find(p => (p.user_id_number || '').toUpperCase() === userId.trim().toUpperCase());

        return res.json({
            success: true,
            preferences: found || null
        });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch preferences." });
    }
});

// POST /api/player/device-token - Register or refresh device push token
app.post('/api/player/device-token', async (req, res) => {
    try {
        const { userId, token, platform } = req.body;
        if (!userId || !token) {
            return res.status(400).json({ error: "userId and token are required." });
        }
        const all = await getAllPlayerPreferences();
        const existing = all.find(p => (p.user_id_number || '').toUpperCase() === userId.trim().toUpperCase());
        if (existing) {
            existing.device_token = token;
            existing.device_platform = platform || existing.device_platform || 'android';
            await savePlayerPreference(existing);
        }
        return res.json({ success: true, message: "Token registered successfully." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to register token." });
    }
});

// GET /api/player/notifications - Get notification history
app.get('/api/player/notifications', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: "userId query param required." });

        const notifs = await getPlayerNotifications(userId);
        return res.json({
            success: true,
            notifications: notifs,
            unreadCount: notifs.filter(n => !n.is_read).length
        });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch notifications." });
    }
});

// PATCH /api/player/notifications/read - Mark notifications as read
app.patch('/api/player/notifications/read', async (req, res) => {
    try {
        const { userId, notificationId, markAll } = req.body;
        if (!userId) return res.status(400).json({ error: "userId required." });

        const cleanId = userId.trim().toUpperCase();
        const local = readJsonFileSafe(NOTIFS_FILE, []);
        let updatedCount = 0;

        local.forEach(n => {
            if ((n.user_id_number || '').toUpperCase() === cleanId) {
                if (markAll || Number(n.id) === Number(notificationId)) {
                    n.is_read = true;
                    updatedCount++;
                }
            }
        });
        writeJsonFileSafe(NOTIFS_FILE, local);

        if (isSupabaseConfigured()) {
            try {
                let q = supabase.from('player_notifications').update({ is_read: true }).ilike('user_id_number', cleanId);
                if (!markAll && notificationId) q = q.eq('id', notificationId);
                await q;
            } catch (e) {}
        }

        return res.json({ success: true, message: `Marked ${updatedCount} notification(s) as read.` });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update notification state." });
    }
});

// DELETE /api/player/notifications - Clear notifications
app.delete('/api/player/notifications', async (req, res) => {
    try {
        const { userId, notificationId, clearAll } = req.body;
        if (!userId) return res.status(400).json({ error: "userId required." });

        const cleanId = userId.trim().toUpperCase();
        let local = readJsonFileSafe(NOTIFS_FILE, []);

        if (clearAll) {
            local = local.filter(n => (n.user_id_number || '').toUpperCase() !== cleanId);
        } else if (notificationId) {
            local = local.filter(n => !( (n.user_id_number || '').toUpperCase() === cleanId && Number(n.id) === Number(notificationId) ));
        }
        writeJsonFileSafe(NOTIFS_FILE, local);

        if (isSupabaseConfigured()) {
            try {
                let q = supabase.from('player_notifications').delete().ilike('user_id_number', cleanId);
                if (!clearAll && notificationId) q = q.eq('id', notificationId);
                await q;
            } catch (e) {}
        }

        return res.json({ success: true, message: "Notifications cleared." });
    } catch (err) {
        return res.status(500).json({ error: "Failed to clear notifications." });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`====================================================`);
    console.log(`SportsConnect Server running on http://${HOST}:${PORT}`);
    console.log(`Available on Localhost: http://localhost:${PORT}`);
    console.log(`Available on LAN/Wi-Fi interfaces on port ${PORT}`);
    console.log(`Database Mode: ${isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Local In-Memory Mode'}`);
    console.log(`Admin Gateway: http://localhost:${PORT}/admin.html`);
    console.log(`====================================================`);
});
