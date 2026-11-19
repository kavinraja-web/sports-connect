/**
 * SportsConnect - Direct Supabase Cloud Service
 * Connects mobile and web clients directly to Supabase Cloud PostgreSQL
 * Zero dependency on local Express server or Wi-Fi network
 */
const SupabaseService = {
    URL: 'https://aykhkbaawwiknqxyrkta.supabase.co',
    KEY: 'sb_publishable_FtfOjpEkChqBpg7Phsuv7A_AeqoIe8g',

    getHeaders() {
        return {
            'apikey': this.KEY,
            'Authorization': `Bearer ${this.KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    },

    getSportImage(sport) {
        const s = (sport || '').toLowerCase();
        if (s.includes('cricket')) return './assets/cricket.png';
        if (s.includes('football')) return './assets/ronaldo.png';
        if (s.includes('kabaddi')) return './assets/kabaddi.png';
        if (s.includes('track') || s.includes('athletics')) return './assets/athletics.png';
        return './assets/sports_hero.png';
    },

    formatEvent(e) {
        return {
            id: e.id,
            name: e.event_name,
            sport: e.sport_type,
            date: e.event_date,
            time: '10:00 AM',
            location: e.location,
            description: `Official ${e.sport_type} championship competition organized under Pro Sports League regulations. Full professional timing and refereeing provided.`,
            eligibility: "Open to all verified athletes aged 16-35. Must present valid athlete ID credentials at venue.",
            image: this.getSportImage(e.sport_type),
            maxCapacity: e.maximum_participants || 50,
            registeredCount: e.registered_count || 0,
            officialId: e.organizer_id_number || 'OFF-3105',
            officialName: e.organizer_name || 'League Official',
            officialEmail: e.organizer_email || '',
            status: e.status || 'Open',
            createdAt: e.created_at,
            customFields: e.custom_fields || []
        };
    },

    formatUser(u) {
        return {
            id: u.id,
            name: u.name,
            email: u.email,
            idNumber: u.id_number,
            role: u.role,
            status: u.approval_status || 'pending',
            registeredAt: u.created_at
        };
    },

    formatRegistration(r) {
        const details = r.registration_details || {};
        return {
            id: r.id,
            eventId: r.event_id,
            athleteName: r.athlete_name,
            idNumber: r.id_number,
            email: r.athlete_email,
            mobileNumber: details.mobileNumber || 'N/A',
            dob: details.dob || 'N/A',
            gender: details.gender || 'N/A',
            sport: details.sport || 'N/A',
            teamClub: details.teamClub || 'N/A',
            experienceLevel: details.experienceLevel || 'N/A',
            additionalInfo: details.additionalInfo || '',
            date: r.registration_date,
            status: details.status || 'Pending',
            customAnswers: details.customAnswers || {}
        };
    },

    // 1. Health / Live Ping Check
    async testConnection() {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`${this.URL}/rest/v1/sports_events?select=id&limit=1`, {
                headers: this.getHeaders(),
                signal: controller.signal
            });
            clearTimeout(id);
            return res.ok;
        } catch (e) {
            return false;
        }
    },

    // 2. Public Sports Events
    async getPublicEvents() {
        try {
            const res = await fetch(`${this.URL}/rest/v1/sports_events?select=*&order=id.asc`, {
                headers: this.getHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return (data || []).map(e => this.formatEvent(e));
        } catch (e) {
            console.error('[SupabaseService] getPublicEvents error:', e);
            throw e;
        }
    },

    // 3. Single Event by ID
    async getEventById(eventId) {
        try {
            const res = await fetch(`${this.URL}/rest/v1/sports_events?id=eq.${eventId}&select=*`, {
                headers: this.getHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!data || data.length === 0) return null;
            return this.formatEvent(data[0]);
        } catch (e) {
            console.error('[SupabaseService] getEventById error:', e);
            throw e;
        }
    },

    // 4. User Login
    async login(identifier, role) {
        const clean = (identifier || '').trim().toLowerCase();
        if (!clean) throw new Error("Please enter your Email or ID Number.");

        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(`${this.URL}/rest/v1/users?or=(email.ilike.${clean},id_number.ilike.${clean})&select=*`, {
                headers: this.getHeaders(),
                signal: controller.signal
            });
            clearTimeout(tid);
            if (!res.ok) throw new Error("Failed to query user database.");
            const users = await res.json();
            if (!users || users.length === 0) {
                throw new Error("No registration found with this Email or ID number. Please register first.");
            }

            const user = users[0];
            return {
                user: this.formatUser(user),
                status: user.approval_status || 'pending'
            };
        } catch (e) {
            console.error('[SupabaseService] login error:', e);
            throw e;
        }
    },

    // 5. User Registration
    async registerUser(userData) {
        const { name, email, idNumber, role } = userData;
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanId = (idNumber || '').trim().toUpperCase();

        if (!name || !cleanEmail || !cleanId) {
            throw new Error("Please provide Full Name, Email, and ID Number.");
        }

        try {
            // Check if user already exists
            const checkRes = await fetch(`${this.URL}/rest/v1/users?or=(email.ilike.${cleanEmail},id_number.ilike.${cleanId})&select=id`, {
                headers: this.getHeaders()
            });
            if (checkRes.ok) {
                const existing = await checkRes.json();
                if (existing && existing.length > 0) {
                    throw new Error("An account with this ID or Email is already registered. Please login or contact admin.");
                }
            }

            const insertRes = await fetch(`${this.URL}/rest/v1/users`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    name: name.trim(),
                    email: cleanEmail,
                    id_number: cleanId,
                    role: role || 'Athlete',
                    approval_status: 'pending'
                })
            });

            if (!insertRes.ok) {
                const err = await insertRes.json().catch(() => ({}));
                throw new Error(err.message || "Failed to register user account in Supabase.");
            }

            const inserted = await insertRes.json();
            const newUser = (inserted && inserted.length > 0) ? inserted[0] : { name, email: cleanEmail, id_number: cleanId, role, approval_status: 'pending' };
            return this.formatUser(newUser);
        } catch (e) {
            console.error('[SupabaseService] registerUser error:', e);
            throw e;
        }
    },

    // 6. User Status Live Check
    async checkUserStatus(idNumber) {
        const cleanId = (idNumber || '').trim().toUpperCase();
        try {
            const res = await fetch(`${this.URL}/rest/v1/users?id_number=ilike.${cleanId}&select=id_number,name,role,approval_status`, {
                headers: this.getHeaders()
            });
            if (!res.ok) return null;
            const data = await res.json();
            return (data && data.length > 0) ? data[0] : null;
        } catch (e) {
            return null;
        }
    },

    // 7. Athlete Event Registration
    async registerAthlete(eventId, payload) {
        const { athleteName, idNumber, email, mobileNumber, dob, gender, sport, teamClub, experienceLevel, additionalInfo, customAnswers, role } = payload;
        const finalName = (athleteName || payload.fullName || payload.name || '').trim();
        const finalId = (idNumber || payload.athleteId || '').trim().toUpperCase();
        const finalEmail = (email || '').trim().toLowerCase();
        const finalExp = (experienceLevel || payload.experience || '').trim();
        const finalMobile = (mobileNumber || payload.mobile || '').replace(/[\s\-\(\)]/g, '');

        if (!finalName || !finalId || !finalEmail || !finalMobile || !gender || !finalExp) {
            throw new Error("Full Name, Athlete ID, Email, Mobile Number, Gender, and Experience Level are required fields.");
        }

        if (role === 'Official' || finalId.startsWith('OFF-')) {
            throw new Error("Officials are not permitted to register as competitors in events.");
        }

        try {
            // Check athlete approval status in users table
            const uRes = await fetch(`${this.URL}/rest/v1/users?id_number=ilike.${finalId}&select=*`, {
                headers: this.getHeaders()
            });
            let athleteDbId = null;
            if (uRes.ok) {
                const users = await uRes.json();
                if (users && users.length > 0) {
                    const u = users[0];
                    if (u.role === 'Official') throw new Error("Officials are not permitted to register as competitors.");
                    if (u.approval_status !== 'approved') throw new Error("Your athlete account is awaiting administrator approval or is restricted.");
                    athleteDbId = u.id;
                }
            }

            // Check event capacity
            const evRes = await fetch(`${this.URL}/rest/v1/sports_events?id=eq.${eventId}&select=*`, {
                headers: this.getHeaders()
            });
            if (!evRes.ok) throw new Error("Event not found.");
            const events = await evRes.json();
            if (!events || events.length === 0) throw new Error("Event not found.");
            const event = events[0];

            if (event.status !== 'Open') throw new Error(`Event is currently ${event.status}. Registrations are closed.`);
            if ((event.registered_count || 0) >= (event.maximum_participants || 50)) {
                throw new Error("This event has reached its maximum participant capacity.");
            }

            // Check duplicate registration
            const dupRes = await fetch(`${this.URL}/rest/v1/event_registrations?event_id=eq.${eventId}&id_number=ilike.${finalId}&select=id`, {
                headers: this.getHeaders()
            });
            if (dupRes.ok) {
                const dups = await dupRes.json();
                if (dups && dups.length > 0) throw new Error("You are already registered for this sports event.");
            }

            const regDetails = {
                mobileNumber: finalMobile,
                dob: dob || '',
                gender: gender.trim(),
                sport: sport || event.sport_type,
                teamClub: teamClub || '',
                experienceLevel: finalExp,
                additionalInfo: additionalInfo || '',
                customAnswers: customAnswers || {},
                status: 'Pending'
            };

            const insRes = await fetch(`${this.URL}/rest/v1/event_registrations`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    event_id: Number(eventId),
                    athlete_id: athleteDbId,
                    athlete_name: finalName,
                    id_number: finalId,
                    athlete_email: finalEmail,
                    registration_details: regDetails
                })
            });

            if (!insRes.ok) {
                const err = await insRes.json().catch(() => ({}));
                throw new Error(err.message || "Failed to submit event registration.");
            }

            const inserted = await insRes.json();
            const newReg = (inserted && inserted.length > 0) ? inserted[0] : { id: 'reg_' + Date.now(), event_id: eventId };

            // Increment registered_count on event
            const newCount = (event.registered_count || 0) + 1;
            fetch(`${this.URL}/rest/v1/sports_events?id=eq.${eventId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({ registered_count: newCount })
            }).catch(e => console.warn('Count update async notice:', e));

            return {
                registration: this.formatRegistration(newReg),
                registeredCount: newCount
            };
        } catch (e) {
            console.error('[SupabaseService] registerAthlete error:', e);
            throw e;
        }
    },

    // 8. Official Hosted Events
    async getHostedEvents(officialId) {
        const cleanId = (officialId || '').trim();
        try {
            const res = await fetch(`${this.URL}/rest/v1/sports_events?organizer_id_number=ilike.${cleanId}&select=*&order=id.asc`, {
                headers: this.getHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return (data || []).map(e => this.formatEvent(e));
        } catch (e) {
            console.error('[SupabaseService] getHostedEvents error:', e);
            throw e;
        }
    },

    // 9. Official View Event Registrations
    async getEventRegistrations(eventId, officialId) {
        try {
            // Verify event ownership
            if (officialId) {
                const evRes = await fetch(`${this.URL}/rest/v1/sports_events?id=eq.${eventId}&select=organizer_id_number`, {
                    headers: this.getHeaders()
                });
                if (evRes.ok) {
                    const evData = await evRes.json();
                    if (evData && evData.length > 0) {
                        const owner = (evData[0].organizer_id_number || '').trim().toUpperCase();
                        if (owner && owner !== officialId.trim().toUpperCase()) {
                            throw new Error("Access denied. You can only view registrations for events you host.");
                        }
                    }
                }
            }

            const res = await fetch(`${this.URL}/rest/v1/event_registrations?event_id=eq.${eventId}&select=*&order=created_at.desc`, {
                headers: this.getHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return (data || []).map(r => this.formatRegistration(r));
        } catch (e) {
            console.error('[SupabaseService] getEventRegistrations error:', e);
            throw e;
        }
    },

    // 10. Official Update Registration Status
    async updateRegistrationStatus(regId, newStatus) {
        try {
            const getRes = await fetch(`${this.URL}/rest/v1/event_registrations?id=eq.${regId}&select=*`, {
                headers: this.getHeaders()
            });
            if (!getRes.ok) throw new Error("Registration not found");
            const data = await getRes.json();
            if (!data || data.length === 0) throw new Error("Registration not found");

            const reg = data[0];
            const updatedDetails = { ...(reg.registration_details || {}), status: newStatus };

            const patchRes = await fetch(`${this.URL}/rest/v1/event_registrations?id=eq.${regId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({ registration_details: updatedDetails })
            });

            if (!patchRes.ok) throw new Error("Failed to update registration status");
            const patched = await patchRes.json();
            return this.formatRegistration(patched[0]);
        } catch (e) {
            console.error('[SupabaseService] updateRegistrationStatus error:', e);
            throw e;
        }
    },

    // 11. Tournaments
    async getTournaments() {
        try {
            const res = await fetch(`${this.URL}/rest/v1/tournaments?select=*&order=id.asc`, {
                headers: this.getHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return (data || []).map(t => ({
                id: t.id,
                name: t.tournament_name,
                sport: t.sport_type,
                date: t.event_date,
                venue: t.location,
                status: t.status,
                participants: t.participants
            }));
        } catch (e) {
            console.error('[SupabaseService] getTournaments error:', e);
            throw e;
        }
    },

    // 12. Marathons
    async getMarathons() {
        try {
            const res = await fetch(`${this.URL}/rest/v1/marathons?select=*&order=id.asc`, {
                headers: this.getHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return (data || []).map(m => ({
                id: m.id,
                name: m.marathon_name,
                date: m.event_date,
                location: m.location,
                registrations: m.registrations
            }));
        } catch (e) {
            console.error('[SupabaseService] getMarathons error:', e);
            throw e;
        }
    },

    // 13. Admin: Get all registered users directly from Supabase Cloud
    async getAllUsers() {
        try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(`${this.URL}/rest/v1/users?select=*&order=created_at.desc`, {
                headers: this.getHeaders(),
                signal: controller.signal
            });
            clearTimeout(tid);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return (data || []).map(u => this.formatUser(u));
        } catch (e) {
            console.error('[SupabaseService] getAllUsers error:', e);
            throw e;
        }
    },

    // 14. Admin: Update user approval status ('approved' | 'denied' | 'pending')
    async updateUserStatus(idNumber, status) {
        try {
            const cleanId = (idNumber || '').trim();
            const res = await fetch(`${this.URL}/rest/v1/users?id_number=eq.${encodeURIComponent(cleanId)}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({ approval_status: status })
            });
            if (!res.ok) throw new Error(`Failed to update status (HTTP ${res.status})`);
            const data = await res.json();
            return data && data.length > 0 ? this.formatUser(data[0]) : null;
        } catch (e) {
            console.error('[SupabaseService] updateUserStatus error:', e);
            throw e;
        }
    },

    // 15. Admin: Delete user registration
    async deleteUser(idNumber) {
        try {
            const cleanId = (idNumber || '').trim();
            const res = await fetch(`${this.URL}/rest/v1/users?id_number=eq.${encodeURIComponent(cleanId)}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            if (!res.ok) throw new Error(`Failed to delete user (HTTP ${res.status})`);
            return true;
        } catch (e) {
            console.error('[SupabaseService] deleteUser error:', e);
            throw e;
        }
    }
};

if (typeof window !== 'undefined') {
    window.SupabaseService = SupabaseService;
}
if (typeof global !== 'undefined') {
    global.SupabaseService = SupabaseService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseService;
}
