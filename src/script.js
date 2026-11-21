// Pro Sports League - Core Client Script
// Universal API Base URL resolved from centralized config
let API_BASE = window.CONFIG ? window.CONFIG.getApiBase() : '';

let currentSelectedRole = 'Athlete';
let currentManagedEvent = null;
let cachedHostedEvents = [];
let cachedPublicEvents = [];
let cachedAllOfficialEvents = [];
let cachedActiveRoster = [];
let currentActiveRosterEvent = null;
let activePublicSportFilter = 'all';
let currentDetailEvent = null;
let currentRegisteringEvent = null;

// Automatically probe and connect to active backend URL
async function resolveActiveBackendUrl() {
    const saved = localStorage.getItem('sportsconnect_api_override');
    if (saved && saved.trim()) {
        API_BASE = saved.trim().replace(/\/+$/, '');
        return API_BASE;
    }

    const isNative = window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
    const candidateSet = new Set();

    if (isNative) {
        // Native mobile candidates:
        if (window.CONFIG && window.CONFIG.DEV_LAN_API_URL) candidateSet.add(window.CONFIG.DEV_LAN_API_URL.replace(/\/+$/, ''));
        candidateSet.add('http://10.85.77.243:3000'); // Active LAN Wi-Fi host
        candidateSet.add('http://10.63.225.244:3000');
        candidateSet.add('http://10.0.2.2:3000'); // Android emulator loopback
        candidateSet.add('http://10.10.12.0:3000');
    } else {
        // Web browser candidates:
        if (window.location && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes(':8080')) {
            candidateSet.add(window.location.origin.replace(/\/+$/, ''));
        }
        candidateSet.add('http://localhost:3000');
        candidateSet.add('http://127.0.0.1:3000');
        if (window.CONFIG && window.CONFIG.DEV_LAN_API_URL) candidateSet.add(window.CONFIG.DEV_LAN_API_URL.replace(/\/+$/, ''));
        candidateSet.add('http://10.85.77.243:3000');
        candidateSet.add('http://10.10.12.0:3000');
    }

    const candidates = Array.from(candidateSet);

    // Fast parallel probe with Promise.any
    const probe = async (url) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        try {
            const res = await fetch(`${url}/health`, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.status === 'ok') return url;
            }
        } catch (e) {
            clearTimeout(timeoutId);
        }
        throw new Error(`Probe failed for ${url}`);
    };

    try {
        const fastest = await Promise.any(candidates.map(probe));
        if (fastest) {
            console.log('[SportsConnect] Connected to active backend:', fastest);
            API_BASE = fastest;
            const dot = document.getElementById('navServerPingDot');
            const mDot = document.getElementById('mobileServerPingDot');
            const txt = document.getElementById('navServerPingText');
            if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
            if (mDot) mDot.className = 'absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500';
            if (txt) txt.innerText = 'Backend Online';
            return fastest;
        }
    } catch (e) {
        // All probes failed or timed out
    }

    return API_BASE;
}

document.addEventListener('DOMContentLoaded', () => {
    refreshUI();

    // Check if currently stored user is pending or denied and restrict view
    const initialUser = getActiveUser();
    if (initialUser && (initialUser.status === 'pending' || initialUser.status === 'denied')) {
        document.getElementById('sportsDashboard').classList.add('hidden');
        document.getElementById('officialsDashboard').classList.add('hidden');
        document.getElementById('marathonDashboard').classList.add('hidden');
    }

    // Automatically probe backend connection and load public events
    resolveActiveBackendUrl().then(() => {
        loadPublicEvents();
    }).catch(() => {
        loadPublicEvents();
    });

    // Initialize Personalized Match Notifications & Preferences for Mobile
    initPersonalizedNotifications();

    // Hero Section SPORTS Button
    const sportsBtn = document.getElementById('heroSportsBtn') || document.querySelector('a[href="#register"]:last-child');
    if (sportsBtn) {
        sportsBtn.addEventListener('click', (e) => {
            handleHeroSportsClick(e);
        });
    }

    // Athlete Dashboard Search
    const dashSearch = document.getElementById('dashSearch');
    if (dashSearch) {
        dashSearch.addEventListener('input', (e) => {
            if (isAutofilledUserEmail(e.target.value)) {
                e.target.value = '';
                document.querySelectorAll('.dash-card').forEach(card => card.style.display = 'block');
                return;
            }
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.dash-card').forEach(card => {
                const title = card.querySelector('h3').innerText.toLowerCase();
                card.style.display = title.includes(term) ? 'block' : 'none';
            });
        });
    }

    // Attach listeners and sanitize search inputs against browser autofill
    ['publicEventSearchInput', 'officialAllEventsSearch', 'dashSearch'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('focus', () => {
                if (isAutofilledUserEmail(input.value)) {
                    input.value = '';
                    if (id === 'publicEventSearchInput') {
                        filterPublicEventsBySport(activePublicSportFilter || 'all');
                    } else if (id === 'officialAllEventsSearch') {
                        filterOfficialAllEvents('');
                    }
                }
            });
            input.addEventListener('change', () => {
                if (isAutofilledUserEmail(input.value)) {
                    input.value = '';
                    if (id === 'publicEventSearchInput') {
                        filterPublicEventsBySport(activePublicSportFilter || 'all');
                    }
                }
            });
        }
    });

    sanitizeSearchInputs();
    setTimeout(sanitizeSearchInputs, 150);
    setTimeout(sanitizeSearchInputs, 500);
    setTimeout(sanitizeSearchInputs, 1200);

    // Close on background click
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
    }
    
    const closeBtn = document.getElementById('closeModal');
    if (closeBtn) closeBtn.onclick = hideModal;

    const finalSub = document.getElementById('finalSubmit');
    if (finalSub) finalSub.onclick = submitRegistration;

    updateChatbotContext();
    initCapacitorPlugins();
    checkBackendHealthLive();
});

// ================= USER STORAGE & HELPER =================
function getActiveUser() {
    try {
        const raw = localStorage.getItem('proSportsUser');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

// Helper to detect and clear unwanted browser credential autofill in search bars
function isAutofilledUserEmail(val) {
    if (!val || typeof val !== 'string') return false;
    const clean = val.trim().toLowerCase();
    if (!clean) return false;
    const user = getActiveUser();
    if (user) {
        if (user.email && clean === user.email.toLowerCase()) return true;
        if (user.idNumber && clean === user.idNumber.toLowerCase()) return true;
        if (user.name && clean === user.name.toLowerCase()) return true;
    }
    // Detect email-shaped inputs accidentally autofilled by browser password managers
    if (clean.includes('@') && clean.includes('.')) {
        return true;
    }
    return false;
}

function sanitizeSearchInputs() {
    ['publicEventSearchInput', 'officialAllEventsSearch', 'dashSearch'].forEach(id => {
        const input = document.getElementById(id);
        if (input && isAutofilledUserEmail(input.value)) {
            input.value = '';
            if (id === 'publicEventSearchInput') {
                filterPublicEventsBySport(activePublicSportFilter || 'all');
            } else if (id === 'officialAllEventsSearch') {
                filterOfficialAllEvents('');
            }
        }
    });
}

// ================= TOAST NOTIFICATION SYSTEM =================
function showInteractiveToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const config = {
        success: { bg: 'bg-emerald-600', icon: 'fa-check-circle', border: 'border-emerald-500' },
        warning: { bg: 'bg-amber-600', icon: 'fa-clock', border: 'border-amber-500' },
        danger: { bg: 'bg-rose-600', icon: 'fa-ban', border: 'border-rose-500' },
        info: { bg: 'bg-blue-900', icon: 'fa-info-circle', border: 'border-blue-800' }
    };

    const cfg = config[type] || config.info;
    toast.className = `toast-slide-in pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl text-white text-xs border ${cfg.bg} ${cfg.border} max-w-sm`;
    toast.innerHTML = `
        <i class="fas ${cfg.icon} text-lg mt-0.5"></i>
        <div class="flex-1">
            <strong class="font-black uppercase tracking-wider block text-white text-xs mb-0.5">${title}</strong>
            <span class="font-medium text-white/90 leading-relaxed">${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="text-white/60 hover:text-white text-base ml-1 font-bold">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// ================= INTERACTIVE ACCESS & VERIFICATION MODAL =================
function showInteractiveAccessModal(user, forcedStatus) {
    if (!user) return;
    const modal = document.getElementById('accessNoticeModal');
    if (!modal) return;

    const status = forcedStatus || user.status || 'pending';
    const topBar = document.getElementById('accessModalTopBar');
    const iconBox = document.getElementById('accessModalIconBox');
    const icon = document.getElementById('accessModalIcon');
    const title = document.getElementById('accessModalTitle');
    const desc = document.getElementById('accessModalDesc');
    const nameEl = document.getElementById('accessModalUserName');
    const roleEl = document.getElementById('accessModalUserRole');
    const idEl = document.getElementById('accessModalUserId');
    const badgeEl = document.getElementById('accessModalBadge');

    nameEl.innerText = user.name || 'User';
    roleEl.innerText = user.role || 'Athlete';
    idEl.innerText = user.idNumber || 'N/A';

    if (status === 'pending') {
        topBar.className = 'h-3 w-full bg-amber-500';
        iconBox.className = 'w-20 h-20 rounded-full flex items-center justify-center mx-auto text-3xl mb-4 bg-amber-100 text-amber-600 shadow-md';
        icon.className = 'fas fa-clock animate-pulse';
        title.innerText = 'Approval Pending';
        desc.innerText = `Hello ${user.name}, your registration as an ${user.role} has been submitted. Before you can enter tournaments or access dashboard tools, the League Administrator must verify and allow your account.`;
        badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300';
        badgeEl.innerHTML = '🟡 Pending Review';
    } else if (status === 'denied') {
        topBar.className = 'h-3 w-full bg-rose-600';
        iconBox.className = 'w-20 h-20 rounded-full flex items-center justify-center mx-auto text-3xl mb-4 bg-rose-100 text-rose-600 shadow-md';
        icon.className = 'fas fa-ban';
        title.innerText = 'Access Denied';
        desc.innerText = `Account registration (ID: ${user.idNumber}) has been denied by the League Administrator. Dashboard tools and tournament participation are restricted.`;
        badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300';
        badgeEl.innerHTML = '🔴 Access Restricted';
    } else {
        topBar.className = 'h-3 w-full bg-emerald-500';
        iconBox.className = 'w-20 h-20 rounded-full flex items-center justify-center mx-auto text-3xl mb-4 bg-emerald-100 text-emerald-600 shadow-md';
        icon.className = 'fas fa-check-circle';
        title.innerText = 'Access Allowed & Active';
        desc.innerText = `Welcome ${user.name}! Your ${user.role} account is fully approved. You have complete access to tournaments and league activities.`;
        badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300';
        badgeEl.innerHTML = '🟢 Verified Active';
    }

    modal.classList.remove('hidden');
}

function closeAccessNoticeModal() {
    const modal = document.getElementById('accessNoticeModal');
    if (modal) modal.classList.add('hidden');
}

// Live Status Check from Modal Button
async function checkLiveApprovalStatus() {
    const user = getActiveUser();
    if (!user) return;

    const spinner = document.getElementById('statusCheckSpinner');
    if (spinner) spinner.classList.add('fa-spin');

    try {
        let currentStatus = null;

        // 1. Direct Supabase Cloud check
        if (window.SupabaseService && (!window.CONFIG || window.CONFIG.USE_DIRECT_SUPABASE)) {
            try {
                const checkRes = await fetch(`${window.SupabaseService.URL}/rest/v1/users?id_number=eq.${encodeURIComponent(user.idNumber)}&select=approval_status`, {
                    headers: window.SupabaseService.getHeaders()
                });
                if (checkRes.ok) {
                    const rows = await checkRes.json();
                    if (rows && rows.length > 0) {
                        currentStatus = rows[0].approval_status;
                    }
                }
            } catch (supErr) {
                console.warn('[LiveCheck] Supabase check error:', supErr);
            }
        }

        // 2. Fall back to local Express server
        if (!currentStatus) {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`${API_BASE}/user-status?idNumber=${encodeURIComponent(user.idNumber)}`, {
                signal: controller.signal
            });
            clearTimeout(tid);
            if (res.ok) {
                const data = await res.json();
                currentStatus = data.status;
            }
        }

        if (currentStatus) {
            user.status = currentStatus;
            localStorage.setItem('proSportsUser', JSON.stringify(user));
            refreshUI();

            if (user.status === 'approved') {
                showInteractiveAccessModal(user, 'approved');
                showInteractiveToast('Access Allowed!', `Your ${user.role} account has been verified! Unlocking dashboard...`, 'success');
                setTimeout(() => {
                    closeAccessNoticeModal();
                    routeUserDashboard(user);
                }, 1300);
            } else if (user.status === 'denied') {
                showInteractiveAccessModal(user, 'denied');
                showInteractiveToast('Account Denied', 'Your account registration was not approved by the League Administrator.', 'danger');
            } else {
                showInteractiveToast('Verification In Progress', 'Your account is currently awaiting administrator review.', 'warning');
            }
        } else {
            showInteractiveToast('Status Check Failed', 'Could not verify status. Please check your internet connection.', 'danger');
        }
    } catch (err) {
        showInteractiveToast('Connection Error', 'Could not reach server to verify status.', 'danger');
    } finally {
        if (spinner) spinner.classList.remove('fa-spin');
    }
}

// Live permission verification helper
async function verifyUserApprovalLive(user) {
    if (!user) {
        resetModal();
        document.getElementById('authModal').classList.remove('hidden');
        return false;
    }

    try {
        let currentStatus = null;
        if (window.SupabaseService && (!window.CONFIG || window.CONFIG.USE_DIRECT_SUPABASE)) {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 4000);
            const checkRes = await fetch(`${window.SupabaseService.URL}/rest/v1/users?id_number=eq.${encodeURIComponent(user.idNumber)}&select=approval_status`, {
                headers: window.SupabaseService.getHeaders(),
                signal: controller.signal
            });
            clearTimeout(tid);
            if (checkRes.ok) {
                const rows = await checkRes.json();
                if (rows && rows.length > 0) {
                    currentStatus = rows[0].approval_status;
                }
            }
        }

        if (!currentStatus) {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${API_BASE}/user-status?idNumber=${encodeURIComponent(user.idNumber)}`, {
                signal: controller.signal
            });
            clearTimeout(tid);
            if (res.ok) {
                const data = await res.json();
                currentStatus = data.status;
            }
        }

        if (currentStatus) {
            user.status = currentStatus;
            localStorage.setItem('proSportsUser', JSON.stringify(user));
            refreshUI();
        }
    } catch (e) {
        console.warn("Status check failed, using cached status", e);
    }

    if (user.status === 'pending') {
        showInteractiveAccessModal(user, 'pending');
        return false;
    }

    if (user.status === 'denied') {
        showInteractiveAccessModal(user, 'denied');
        return false;
    }

    return true;
}

// ================= ROLE-BASED DASHBOARD ROUTING =================
function routeUserDashboard(user) {
    if (!user) return;

    if (user.status !== 'approved') {
        showInteractiveAccessModal(user, user.status);
        return;
    }

    sanitizeSearchInputs();

    // Hide Main Landing & Footer
    document.querySelector('header').classList.add('hidden');
    const pubSec = document.getElementById('publicEventsSection');
    if (pubSec) pubSec.classList.add('hidden');
    document.querySelector('#register').classList.add('hidden');
    if (document.querySelector('footer')) document.querySelector('footer').classList.add('hidden');

    if (user.role === 'Official') {
        document.getElementById('sportsDashboard').classList.add('hidden');
        document.getElementById('marathonDashboard').classList.add('hidden');

        const offDash = document.getElementById('officialsDashboard');
        offDash.classList.remove('hidden');

        document.getElementById('officialWelcomeName').innerText = user.name;
        document.getElementById('officialInitial').innerText = user.name.charAt(0).toUpperCase();
        document.getElementById('officialIdBadge').innerText = user.idNumber || 'OFFICIAL';

        switchOfficialTab('hosted');
        window.scrollTo(0, 0);
    } else {
        document.getElementById('officialsDashboard').classList.add('hidden');
        document.getElementById('marathonDashboard').classList.add('hidden');

        const sportsDash = document.getElementById('sportsDashboard');
        sportsDash.classList.remove('hidden');

        document.getElementById('dashUserName').innerText = user.name;
        document.getElementById('dashUserInitial').innerText = user.name.charAt(0).toUpperCase();
        const roleSub = document.getElementById('dashRoleSubtitle');
        if (roleSub) roleSub.innerText = `Pro Sports ${user.role || 'Athlete'}`;

        window.scrollTo(0, 0);
    }
}

function openCurrentDashboard() {
    const user = getActiveUser();
    if (user) {
        verifyUserApprovalLive(user).then(isAllowed => {
            if (isAllowed) routeUserDashboard(user);
        });
    } else {
        resetModal();
        document.getElementById('authModal').classList.remove('hidden');
    }
}

function openStatusCheckModal() {
    const user = getActiveUser();
    if (user) {
        showInteractiveAccessModal(user);
    }
}

function returnToHome() {
    const sportsDash = document.getElementById('sportsDashboard');
    if (sportsDash) sportsDash.classList.add('hidden');
    const offDash = document.getElementById('officialsDashboard');
    if (offDash) offDash.classList.add('hidden');
    const maraDash = document.getElementById('marathonDashboard');
    if (maraDash) maraDash.classList.add('hidden');

    const header = document.querySelector('header');
    if (header) header.classList.remove('hidden');

    // Always keep public events section visible on home page so events show on scroll without login
    const pubSec = document.getElementById('publicEventsSection');
    if (pubSec) pubSec.classList.remove('hidden');

    const regSec = document.querySelector('#register');
    const isMobile = window.innerWidth < 768;
    if (regSec) {
        if (isMobile) regSec.classList.add('hidden');
        else regSec.classList.remove('hidden');
    }

    const footer = document.querySelector('footer');
    if (footer) footer.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadPublicEvents();
}

// Scroll down smoothly to Public Sports Events Section
function scrollToPublicEvents() {
    const sportsDash = document.getElementById('sportsDashboard');
    if (sportsDash) sportsDash.classList.add('hidden');
    const offDash = document.getElementById('officialsDashboard');
    if (offDash) offDash.classList.add('hidden');
    const maraDash = document.getElementById('marathonDashboard');
    if (maraDash) maraDash.classList.add('hidden');

    const header = document.querySelector('header');
    if (header) header.classList.remove('hidden');

    const pubSec = document.getElementById('publicEventsSection');
    if (pubSec) {
        pubSec.classList.remove('hidden');
        pubSec.scrollIntoView({ behavior: 'smooth' });
    }
    loadPublicEvents();
}

// Handler for Hero Sports button (scrolls directly to public events without requiring login)
function handleHeroSportsClick(e) {
    if (e) e.preventDefault();
    scrollToPublicEvents();
}

// Handler for Hero Officials button (opens Official dashboard if logged in, else Official login)
function handleHeroOfficialsClick(e) {
    if (e) e.preventDefault();
    const user = getActiveUser();
    if (user && user.role === 'Official') {
        verifyUserApprovalLive(user).then(isAllowed => {
            if (isAllowed) routeUserDashboard(user);
        });
    } else {
        openDirectLogin('Official');
    }
}

// ================= OFFICIALS DASHBOARD TABS & MANAGEMENT =================
function switchOfficialTab(tab) {
    sanitizeSearchInputs();
    const btnAll = document.getElementById('tabBtnAllEvents');
    const btnHosted = document.getElementById('tabBtnHostedEvents');
    const btnCreate = document.getElementById('tabBtnCreateEvent');
    const contentAll = document.getElementById('allEventsTabContent');
    const contentHosted = document.getElementById('hostedEventsTabContent');
    const contentCreate = document.getElementById('createEventTabContent');

    const activeClasses = 'official-tab-btn active bg-blue-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2';
    const inactiveClasses = 'official-tab-btn bg-white text-gray-700 border border-gray-200 hover:border-blue-900 hover:text-blue-900 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-2';

    if (btnAll) btnAll.className = inactiveClasses;
    if (btnHosted) btnHosted.className = inactiveClasses;
    if (btnCreate) btnCreate.className = inactiveClasses;

    if (contentAll) contentAll.classList.add('hidden');
    if (contentHosted) contentHosted.classList.add('hidden');
    if (contentCreate) contentCreate.classList.add('hidden');

    if (tab === 'all') {
        if (btnAll) btnAll.className = activeClasses;
        if (contentAll) contentAll.classList.remove('hidden');
        loadOfficialAllEvents();
    } else if (tab === 'hosted') {
        if (btnHosted) btnHosted.className = activeClasses;
        if (contentHosted) contentHosted.classList.remove('hidden');
        loadOfficialHostedEvents();
    } else if (tab === 'create') {
        if (btnCreate) btnCreate.className = activeClasses;
        if (contentCreate) contentCreate.classList.remove('hidden');
        populateEventStateAndDistricts();
    }
}

// ================= DYNAMIC FORM BUILDER INTEGRATION =================
function addCustomFieldRow() {
    const container = document.getElementById('customFieldsContainer');
    const fieldIndex = container.children.length + 1;

    const row = document.createElement('div');
    row.className = 'custom-field-row bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3 transition hover:border-yellow-500';

    row.innerHTML = `
        <div class="flex-1 w-full">
            <input
                type="text"
                placeholder="Field Label (e.g. Jersey Size, Medical Clearance, Weight)"
                class="field-label w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-900"
                required />
        </div>
        <div class="w-full sm:w-44">
            <select class="field-type w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-900">
                <option value="text">Text Input</option>
                <option value="number">Number Input</option>
                <option value="file">File Upload</option>
                <option value="select">Dropdown / Select</option>
            </select>
        </div>
        <div class="flex items-center gap-2 px-2">
            <input type="checkbox" id="req_${fieldIndex}" class="field-required rounded text-blue-900 focus:ring-0 w-4 h-4 cursor-pointer" />
            <label for="req_${fieldIndex}" class="text-[11px] font-black uppercase text-gray-600 cursor-pointer select-none">Required</label>
        </div>
        <button
            type="button"
            onclick="this.closest('.custom-field-row').remove()"
            title="Remove Field"
            class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition">
            <i class="fas fa-trash-alt text-sm"></i>
        </button>
    `;

    container.appendChild(row);
}

// ================= EVENT CREATION WIZARD (POST /events) =================
async function handleCreateEventSubmit(e) {
    e.preventDefault();
    const user = getActiveUser();
    if (!user) return showInteractiveToast('Session Expired', 'Please log in to create events.', 'danger');

    const name = document.getElementById('evName').value.trim();
    const sport = document.getElementById('evSport').value;
    const date = document.getElementById('evDate').value;
    const location = document.getElementById('evLocation').value.trim();
    const maxCapacity = document.getElementById('evCapacity').value;
    const ageCategory = document.getElementById('evAgeCategory') ? document.getElementById('evAgeCategory').value : 'Under 18';
    const state = document.getElementById('evState') ? document.getElementById('evState').value : '';
    const district = document.getElementById('evDistrict') ? document.getElementById('evDistrict').value : '';

    const customFields = [];
    document.querySelectorAll('.custom-field-row').forEach(row => {
        const label = row.querySelector('.field-label').value.trim();
        const type = row.querySelector('.field-type').value;
        const required = row.querySelector('.field-required').checked;
        if (label) {
            customFields.push({ label, type, required });
        }
    });

    const payload = {
        name,
        sport,
        date,
        location,
        maxCapacity: Number(maxCapacity),
        customFields,
        ageCategory,
        state,
        district,
        officialId: user.idNumber || 'OFF-UNKNOWN',
        officialName: user.name,
        officialEmail: user.email
    };

    const submitBtn = document.getElementById('btnPublishEvent');
    submitBtn.innerText = 'Publishing...';
    submitBtn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
            showInteractiveToast('Event Published!', `Tournament "${payload.name}" launched! Targeted notifications sent to matching players.`, 'success');
            document.getElementById('createEventForm').reset();
            document.getElementById('customFieldsContainer').innerHTML = '';
            switchOfficialTab('hosted');
        } else {
            showInteractiveToast('Publishing Failed', data.error || 'Failed to create event.', 'danger');
        }
    } catch (err) {
        showInteractiveToast('Server Error', 'Unable to reach backend server.', 'danger');
    } finally {
        submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1.5"></i> Publish Event';
        submitBtn.disabled = false;
    }
}

// ================= PUBLIC SPORTS EVENTS SECTION (NO LOGIN REQUIRED) =================
async function loadPublicEvents() {
    const grid = document.getElementById('publicEventsGrid');
    const noMsg = document.getElementById('noPublicEventsMsg');
    if (!grid) return;

    // Direct Supabase Cloud Connection (Zero local server or Wi-Fi required)
    if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
        try {
            const events = await window.SupabaseService.getPublicEvents();
            if (Array.isArray(events) && events.length > 0) {
                cachedPublicEvents = events;
                renderPublicEventsGrid(cachedPublicEvents);

                // Update server status dot to green
                const dot = document.getElementById('navServerPingDot');
                const mDot = document.getElementById('mobileServerPingDot');
                const txt = document.getElementById('navServerPingText');
                if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
                if (mDot) mDot.className = 'absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500';
                if (txt) txt.innerText = 'Supabase Cloud';
                return;
            }
        } catch (supabaseErr) {
            console.warn('[Direct Supabase] Query error, falling back to API_BASE:', supabaseErr);
        }
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE}/events`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const events = await res.json();
            cachedPublicEvents = Array.isArray(events) ? events : [];
            renderPublicEventsGrid(cachedPublicEvents);
            checkBackendHealthLive(API_BASE);
        } else {
            grid.innerHTML = '<div class="col-span-full py-16 text-center text-rose-500 font-bold">Failed to load public sports events.</div>';
        }
    } catch (err) {
        console.warn('Network issue fetching public events from:', API_BASE, err);
        checkBackendHealthLive(API_BASE);
        if (cachedPublicEvents.length > 0) {
            renderPublicEventsGrid(cachedPublicEvents);
        } else {
            grid.innerHTML = `
                <div class="col-span-full py-12 text-center bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
                    <div class="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl mb-3">
                        <i class="fas fa-server"></i>
                    </div>
                    <h3 class="text-xl font-black text-blue-950 uppercase italic">Backend Server Not Connected</h3>
                    <p class="text-xs text-gray-500 font-semibold mt-1 max-w-md mx-auto">
                        The app is attempting to connect to:<br>
                        <span class="inline-block mt-1.5 font-mono text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 break-all">${API_BASE || 'http://localhost:3000'}</span>
                    </p>
                    <p class="text-[11px] text-gray-400 mt-2 max-w-sm mx-auto">
                        If running on an Android device, ensure your computer and phone are on the same Wi-Fi network and node server is active.
                    </p>
                    <div class="flex flex-wrap items-center justify-center gap-3 mt-5">
                        <button onclick="openServerConfigModal()" class="bg-blue-900 hover:bg-yellow-500 hover:text-blue-950 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2">
                            <i class="fas fa-sliders-h text-yellow-400"></i> Configure Backend URL
                        </button>
                        <button onclick="loadPublicEvents()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

function renderPublicEventsGrid(eventsToRender) {
    const grid = document.getElementById('publicEventsGrid');
    const noMsg = document.getElementById('noPublicEventsMsg');
    if (!grid) return;

    grid.innerHTML = '';
    const user = getActiveUser();

    if (!eventsToRender || eventsToRender.length === 0) {
        if (noMsg) noMsg.classList.remove('hidden');
        return;
    }

    if (noMsg) noMsg.classList.add('hidden');

    eventsToRender.forEach(ev => {
        const currentRegs = ev.registeredCount || 0;
        const maxCap = ev.maxCapacity || 50;
        const percent = Math.min(100, Math.round((currentRegs / maxCap) * 100));
        const spotsLeft = Math.max(0, maxCap - currentRegs);

        // Action button behavior based on Role
        let actionBtnHtml = '';
        if (user && user.role === 'Official') {
            actionBtnHtml = `
                <span class="flex-1 bg-gray-100 text-gray-500 font-bold py-2.5 px-3 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 border border-gray-200" title="Officials oversee events rather than registering as competitors">
                    <i class="fas fa-shield-alt text-yellow-600"></i> Official View
                </span>
            `;
        } else {
            actionBtnHtml = `
                <button
                    onclick="handlePublicEventRegister(${ev.id})"
                    class="flex-1 bg-yellow-500 hover:bg-yellow-400 text-blue-950 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5">
                    <i class="fas fa-file-signature"></i> Register
                </button>
            `;
        }

        const card = document.createElement('div');
        card.className = 'public-event-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-2xl hover:border-yellow-500 transition-all duration-300';
        card.innerHTML = `
            <div>
                <!-- Image Header with Badges -->
                <div class="relative h-48 bg-slate-900 overflow-hidden group">
                    <img src="${ev.image || getSportDefaultImage(ev.sport)}" alt="${ev.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-700 opacity-90" onerror="this.src='./assets/cricket.png'" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
                    <div class="absolute top-3 left-3 flex items-center gap-2">
                        <span class="bg-yellow-500 text-blue-950 font-black text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md">
                            ${ev.sport}
                        </span>
                    </div>
                    <div class="absolute top-3 right-3">
                        <span class="bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> ${ev.status || 'Open'}
                        </span>
                    </div>
                    <div class="absolute bottom-3 left-4 right-4">
                        <div class="text-[11px] font-black text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="far fa-calendar-alt"></i> ${ev.date} • <i class="far fa-clock"></i> ${ev.time || '10:00 AM'}
                        </div>
                    </div>
                </div>

                <!-- Content Body -->
                <div class="p-6">
                    <h3 class="text-xl font-black text-blue-950 uppercase italic tracking-tight line-clamp-2 hover:text-yellow-600 transition cursor-pointer" onclick="openPublicEventDetails(${ev.id})">
                        ${ev.name}
                    </h3>

                    <div class="text-xs text-gray-500 font-bold flex items-center gap-1.5 mt-2.5">
                        <i class="fas fa-map-marker-alt text-red-500 text-sm"></i>
                        <span class="truncate">${ev.location}</span>
                    </div>

                    <p class="text-xs text-gray-600 font-medium mt-3 line-clamp-2 leading-relaxed">
                        ${ev.description || 'Official sports tournament sanctioned under Pro Sports League guidelines.'}
                    </p>

                    <!-- Spots Left / Capacity Bar -->
                    <div class="mt-5 pt-4 border-t border-gray-100">
                        <div class="flex justify-between items-center text-xs font-black mb-1.5">
                            <span class="text-blue-950 font-bold">${currentRegs} / ${maxCap} Registered</span>
                            <span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">${spotsLeft} Spots Left</span>
                        </div>
                        <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div class="bg-blue-900 h-2 rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                        </div>
                    </div>

                    <div class="mt-4 flex items-center justify-between text-[11px] text-gray-400 font-bold">
                        <span><i class="fas fa-user-shield text-yellow-600 mr-1"></i> ${ev.officialName || 'League Official'}</span>
                        ${ev.customFields && ev.customFields.length > 0 ? `<span class="bg-blue-50 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded">${ev.customFields.length} Custom Fields</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Card Actions -->
            <div class="p-5 pt-0 border-t border-gray-50 flex items-center gap-2.5">
                <button
                    onclick="openPublicEventDetails(${ev.id})"
                    class="flex-1 bg-gray-100 hover:bg-gray-200 text-blue-950 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-1">
                    <i class="fas fa-eye text-yellow-600"></i> Details
                </button>
                ${actionBtnHtml}
            </div>
        `;
        grid.appendChild(card);
    });
}

// Filter public events by sport discipline
function filterPublicEventsBySport(sport) {
    activePublicSportFilter = sport;

    // Update active tab buttons using data-sport attribute or exact matching
    document.querySelectorAll('.public-sport-tab').forEach(btn => {
        const btnSport = btn.getAttribute('data-sport') || (btn.innerText.includes('All') ? 'all' : btn.innerText.trim());
        const isMatch = sport.toLowerCase() === 'all' 
            ? btnSport.toLowerCase() === 'all' 
            : btnSport.toLowerCase() === sport.toLowerCase();

        btn.className = isMatch 
            ? 'public-sport-tab active px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition bg-blue-900 text-white shadow-sm flex items-center gap-2'
            : 'public-sport-tab px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition bg-white text-gray-700 border border-gray-200 hover:border-blue-900 flex items-center gap-2';
    });

    let filtered = [...cachedPublicEvents];
    if (sport !== 'all') {
        filtered = filtered.filter(e => (e.sport || '').toLowerCase().includes(sport.toLowerCase()));
    }

    const searchInput = document.getElementById('publicEventSearchInput');
    if (searchInput) {
        if (isAutofilledUserEmail(searchInput.value)) {
            searchInput.value = '';
        }
        if (searchInput.value.trim()) {
            const q = searchInput.value.trim().toLowerCase();
            filtered = filtered.filter(e => 
                (e.name || '').toLowerCase().includes(q) || 
                (e.sport || '').toLowerCase().includes(q) || 
                (e.location || '').toLowerCase().includes(q) ||
                (e.description && e.description.toLowerCase().includes(q))
            );
        }
    }

    renderPublicEventsGrid(filtered);

    // Smooth scroll down to events section
    const pubSec = document.getElementById('publicEventsSection');
    if (pubSec) {
        pubSec.scrollIntoView({ behavior: 'smooth' });
    }
}

// Handle real-time search input
function handlePublicEventSearch(query) {
    if (isAutofilledUserEmail(query)) {
        const searchInput = document.getElementById('publicEventSearchInput');
        if (searchInput) searchInput.value = '';
        query = '';
    }
    const q = (query || '').trim().toLowerCase();
    let filtered = [...cachedPublicEvents];

    if (activePublicSportFilter !== 'all') {
        filtered = filtered.filter(e => (e.sport || '').toLowerCase().includes(activePublicSportFilter.toLowerCase()));
    }

    if (q) {
        filtered = filtered.filter(e => 
            (e.name || '').toLowerCase().includes(q) || 
            (e.location || '').toLowerCase().includes(q) || 
            (e.sport || '').toLowerCase().includes(q) ||
            (e.description && e.description.toLowerCase().includes(q))
        );
    }

    renderPublicEventsGrid(filtered);
}

// ================= PUBLIC EVENT COMPLETE DETAILS MODAL =================
function openPublicEventDetails(eventId) {
    const ev = cachedPublicEvents.find(e => e.id === Number(eventId)) || 
               cachedHostedEvents.find(e => e.id === Number(eventId)) ||
               cachedAllOfficialEvents.find(e => e.id === Number(eventId));
    if (!ev) return;

    currentDetailEvent = ev;
    const user = getActiveUser();

    const imgEl = document.getElementById('detailModalImage');
    if (imgEl) imgEl.src = ev.image || getSportDefaultImage(ev.sport);

    document.getElementById('detailModalSportBadge').innerText = ev.sport;
    document.getElementById('detailModalStatusBadge').innerText = ev.status || 'Open';
    document.getElementById('detailModalName').innerText = ev.name;
    document.getElementById('detailModalDate').innerText = ev.date;
    document.getElementById('detailModalTime').innerText = ev.time || '10:00 AM';
    document.getElementById('detailModalLocation').innerText = ev.location;
    document.getElementById('detailModalCapacity').innerText = `${ev.registeredCount || 0} / ${ev.maxCapacity || 50} Registered`;
    document.getElementById('detailModalDescription').innerText = ev.description || 'Full tournament competition sanctioned under Pro Sports League regulations.';
    document.getElementById('detailModalEligibility').innerText = ev.eligibility || 'Open to all verified athletes aged 16-35. Must present valid athlete ID credentials at venue.';
    document.getElementById('detailModalOrganizer').innerText = `${ev.officialName || 'League Official'} (${ev.officialId || 'OFF-LEAGUE'})`;

    const customBadge = document.getElementById('detailModalCustomBadge');
    if (customBadge) {
        if (ev.customFields && ev.customFields.length > 0) {
            customBadge.classList.remove('hidden');
        } else {
            customBadge.classList.add('hidden');
        }
    }

    // Register button state in details modal
    const regBtn = document.getElementById('detailModalRegisterBtn');
    if (regBtn) {
        if (user && user.role === 'Official') {
            regBtn.className = 'bg-gray-100 text-gray-400 font-bold px-6 py-3 rounded-xl text-xs uppercase cursor-not-allowed border border-gray-200';
            regBtn.innerHTML = '<i class="fas fa-shield-alt text-yellow-600 mr-1"></i> Officials View Only';
            regBtn.disabled = true;
        } else {
            regBtn.className = 'bg-yellow-500 hover:bg-yellow-400 text-blue-950 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer';
            regBtn.innerHTML = '<i class="fas fa-file-signature"></i> Register for Event';
            regBtn.disabled = false;
        }
    }

    document.getElementById('publicEventDetailsModal').classList.remove('hidden');
}

function closePublicEventDetailsModal() {
    const modal = document.getElementById('publicEventDetailsModal');
    if (modal) modal.classList.add('hidden');
    currentDetailEvent = null;
}

function handlePublicEventRegisterFromModal() {
    if (currentDetailEvent) {
        handlePublicEventRegister(currentDetailEvent.id);
    }
}

// Handle Register button click (visitor vs athlete vs official)
function handlePublicEventRegister(eventId) {
    const ev = cachedPublicEvents.find(e => e.id === Number(eventId)) || 
               cachedHostedEvents.find(e => e.id === Number(eventId)) ||
               cachedAllOfficialEvents.find(e => e.id === Number(eventId));
    if (!ev) return;

    const user = getActiveUser();

    // 1. If visitor is NOT logged in: redirect to login and preserve event intent
    if (!user) {
        localStorage.setItem('pendingRegistration', JSON.stringify({
            eventId: ev.id,
            eventName: ev.name,
            type: 'event'
        }));

        closePublicEventDetailsModal();
        showInteractiveToast('Login Required', `Please log in with your Athlete account to register for "${ev.name}".`, 'info');
        openDirectLogin('Athlete');
        return;
    }

    // 2. If user is an Official: block registration
    if (user.role === 'Official') {
        showInteractiveToast('Role Restricted', 'Officials oversee and coordinate matches. Log in with an Athlete account to register as a competitor.', 'warning');
        return;
    }

    // 3. Logged-in Athlete: verify approval and display the Registration Form Modal
    verifyUserApprovalLive(user).then(isAllowed => {
        if (isAllowed) {
            closePublicEventDetailsModal();
            openAthleteEventRegisterModal(ev);
        }
    });
}

// ================= ATHLETE EVENT REGISTRATION FORM =================
function openAthleteEventRegisterModal(event) {
    currentRegisteringEvent = event;
    const user = getActiveUser();
    if (!user) return;

    document.getElementById('athRegEventName').innerText = event.name;
    document.getElementById('athRegFullName').value = user.name || '';
    document.getElementById('athRegEmail').value = user.email || '';
    document.getElementById('athRegMobile').value = user.mobileNumber || '';
    document.getElementById('athRegDob').value = user.dob || '';
    document.getElementById('athRegGender').value = user.gender || '';
    document.getElementById('athRegSport').value = event.sport || 'Sports';
    document.getElementById('athRegTeam').value = user.teamClub || '';
    document.getElementById('athRegExperience').value = user.experienceLevel || '';
    document.getElementById('athRegAdditional').value = '';

    const errorBanner = document.getElementById('athRegErrorBanner');
    if (errorBanner) errorBanner.classList.add('hidden');

    // Render Event-Specific Dynamic Custom Fields
    const customContainer = document.getElementById('athRegCustomContainer');
    const customList = document.getElementById('athRegCustomFieldsList');
    customList.innerHTML = '';

    if (event.customFields && Array.isArray(event.customFields) && event.customFields.length > 0) {
        customContainer.classList.remove('hidden');
        event.customFields.forEach((cf, idx) => {
            const fieldBox = document.createElement('div');
            fieldBox.className = 'space-y-1';
            const labelText = cf.label || `Custom Requirement ${idx + 1}`;
            const isReq = cf.required !== false;

            if (cf.type === 'select') {
                fieldBox.innerHTML = `
                    <label class="block font-bold text-gray-700 text-[11px]">${labelText} ${isReq ? '*' : ''}</label>
                    <select name="custom_${idx}" data-label="${labelText}" ${isReq ? 'required' : ''} class="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-900">
                        <option value="">Select option</option>
                        <option value="All-Rounder">All-Rounder</option>
                        <option value="Batsman">Batsman</option>
                        <option value="Bowler">Bowler</option>
                        <option value="Striker">Striker</option>
                        <option value="Midfielder">Midfielder</option>
                        <option value="Defender">Defender</option>
                        <option value="Raider">Raider</option>
                        <option value="Standard Option">Standard Option</option>
                    </select>
                `;
            } else {
                fieldBox.innerHTML = `
                    <label class="block font-bold text-gray-700 text-[11px]">${labelText} ${isReq ? '*' : ''}</label>
                    <input type="${cf.type || 'text'}" name="custom_${idx}" data-label="${labelText}" ${isReq ? 'required' : ''} placeholder="Enter ${labelText}" class="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-900" />
                `;
            }
            customList.appendChild(fieldBox);
        });
    } else {
        customContainer.classList.add('hidden');
    }

    document.getElementById('athleteEventRegisterModal').classList.remove('hidden');
}

function closeAthleteEventRegisterModal() {
    const modal = document.getElementById('athleteEventRegisterModal');
    if (modal) modal.classList.add('hidden');
    currentRegisteringEvent = null;
}

// Submit Athlete Registration Form
async function submitAthleteEventRegistration(e) {
    e.preventDefault();
    const user = getActiveUser();
    if (!user || !currentRegisteringEvent) return;

    const fullName = document.getElementById('athRegFullName').value.trim();
    const email = document.getElementById('athRegEmail').value.trim();
    const mobile = document.getElementById('athRegMobile').value.trim();
    const dob = document.getElementById('athRegDob').value.trim();
    const gender = document.getElementById('athRegGender').value;
    const sport = document.getElementById('athRegSport').value.trim();
    const teamClub = document.getElementById('athRegTeam').value.trim();
    const experience = document.getElementById('athRegExperience').value;
    const additional = document.getElementById('athRegAdditional').value.trim();
    const errorBanner = document.getElementById('athRegErrorBanner');

    // Validation
    if (!fullName || !email || !mobile || !dob || !gender || !experience) {
        if (errorBanner) {
            errorBanner.innerText = 'Please complete all required fields marked with an asterisk (*).';
            errorBanner.classList.remove('hidden');
        }
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (errorBanner) {
            errorBanner.innerText = 'Please provide a valid email format (e.g. name@example.com).';
            errorBanner.classList.remove('hidden');
        }
        return;
    }

    const cleanMobile = mobile.replace(/[\s\-\(\)]/g, '');
    if (cleanMobile.length < 10) {
        if (errorBanner) {
            errorBanner.innerText = 'Mobile number must be at least 10 digits.';
            errorBanner.classList.remove('hidden');
        }
        return;
    }

    // Collect custom fields
    const customAnswers = {};
    const customInputs = document.querySelectorAll('#athRegCustomFieldsList input, #athRegCustomFieldsList select');
    customInputs.forEach(inp => {
        const lbl = inp.getAttribute('data-label') || inp.name;
        customAnswers[lbl] = inp.value;
    });

    const submitBtn = document.getElementById('athRegSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Registering...';
    }

    try {
        const payload = {
            athleteName: fullName,
            idNumber: user.idNumber,
            email,
            mobileNumber: cleanMobile,
            dob,
            gender,
            sport,
            teamClub,
            experienceLevel: experience,
            additionalInfo: additional,
            customAnswers,
            role: user.role
        };

        let regResult = null;
        let regError = null;

        // Priority 1: Direct Supabase Cloud Registration
        if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
            try {
                regResult = await window.SupabaseService.registerAthlete(currentRegisteringEvent.id, payload);
            } catch (supErr) {
                regError = supErr.message;
                console.warn('[Direct Supabase] Athlete reg error:', supErr);
            }
        }

        // Priority 2: Express Server Fallback
        if (!regResult && !regError) {
            try {
                const res = await fetch(`${API_BASE}/events/${currentRegisteringEvent.id}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) regResult = data;
                else regError = data.error;
            } catch (e) {
                // API unreachable
            }
        }

        if (regResult) {
            showInteractiveToast('Registration Successful!', `You are successfully registered for "${currentRegisteringEvent.name}"!`, 'success');
            closeAthleteEventRegisterModal();

            // Refresh events across the UI
            loadPublicEvents();
            if (user.role === 'Official') loadOfficialHostedEvents();
        } else {
            if (errorBanner) {
                errorBanner.innerText = regError || 'Registration failed. Please check your inputs.';
                errorBanner.classList.remove('hidden');
            }
            showInteractiveToast('Registration Error', regError || 'Could not complete registration.', 'danger');
        }
    } catch (err) {
        showInteractiveToast('Connection Error', 'Backend server is offline or unreachable.', 'danger');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Submit Registration';
        }
    }
}

// ================= OFFICIALS DASHBOARD: HOSTED & ALL EVENTS =================
async function loadOfficialHostedEvents() {
    const user = getActiveUser();
    const grid = document.getElementById('officialEventsGrid');
    const noMsg = document.getElementById('noHostedEventsMsg');
    const countEl = document.getElementById('hostedEventsCount');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-3 text-center py-12 text-gray-400 font-bold"><i class="fas fa-spinner fa-spin mr-2"></i>Loading your hosted events...</div>';

    try {
        let myEvents = null;
        if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
            try {
                if (user && user.idNumber) {
                    myEvents = await window.SupabaseService.getHostedEvents(user.idNumber);
                }
            } catch (e) {
                console.warn('[Direct Supabase] getHostedEvents error:', e);
            }
        }

        if (!myEvents) {
            const res = await fetch(`${API_BASE}/events`);
            if (res.ok) {
                const allEvents = await res.json();
                myEvents = (user && user.idNumber)
                    ? allEvents.filter(e => (e.officialId || '').toLowerCase() === user.idNumber.toLowerCase() || (user.email && (e.officialEmail || '').toLowerCase() === user.email.toLowerCase()))
                    : [];
            }
        }

        if (myEvents) {
            cachedHostedEvents = myEvents;
            if (countEl) countEl.innerText = cachedHostedEvents.length;

            grid.innerHTML = '';
            if (cachedHostedEvents.length > 0) {
                if (noMsg) noMsg.classList.add('hidden');
                cachedHostedEvents.forEach(ev => {
                    const currentRegs = ev.registeredCount || 0;
                    const maxCap = ev.maxCapacity || 50;
                    const percent = Math.min(100, Math.round((currentRegs / maxCap) * 100));

                    const card = document.createElement('div');
                    card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-xl hover:border-yellow-500 transition-all duration-300';
                    card.innerHTML = `
                        <div>
                            <div class="flex justify-between items-start mb-3">
                                <span class="bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    ${ev.sport}
                                </span>
                                <span class="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                                    ${ev.status || 'Active'}
                                </span>
                            </div>

                            <h3 class="text-xl font-black text-blue-950 uppercase italic tracking-tight line-clamp-2">
                                ${ev.name}
                            </h3>

                            <div class="text-xs text-gray-500 font-medium space-y-1 mt-3">
                                <div><i class="fas fa-calendar-alt text-yellow-600 mr-2"></i> ${ev.date}</div>
                                <div><i class="fas fa-map-marker-alt text-red-500 mr-2"></i> ${ev.location}</div>
                                ${ev.customFields && ev.customFields.length > 0 ? `
                                    <div class="text-blue-900 font-bold text-[11px] pt-1">
                                        <i class="fas fa-sliders-h text-yellow-600 mr-1.5"></i> ${ev.customFields.length} Custom Field(s)
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <div class="mt-6 pt-5 border-t border-gray-100 space-y-3">
                            <div>
                                <div class="flex justify-between text-xs font-black mb-1.5">
                                    <span class="text-gray-400 uppercase tracking-wider text-[10px]">Enrollment</span>
                                    <span class="text-blue-950">${currentRegs} / ${maxCap} Athletes (${percent}%)</span>
                                </div>
                                <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div class="bg-blue-900 h-2.5 rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                                </div>
                            </div>

                            <button
                                onclick="openViewRegistrationsModal(${ev.id})"
                                class="w-full bg-blue-900 hover:bg-yellow-500 hover:text-blue-950 text-white font-black py-2.5 rounded-xl uppercase tracking-wider text-xs transition shadow-md flex items-center justify-center gap-2">
                                <i class="fas fa-users-cog"></i> View Registrations (<span class="font-mono">${currentRegs}</span>)
                            </button>

                            <div class="flex items-center gap-2">
                                <button
                                    onclick="openPublicEventDetails(${ev.id})"
                                    class="flex-1 bg-gray-100 hover:bg-gray-200 text-blue-950 font-bold py-2 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-1">
                                    <i class="fas fa-eye text-yellow-600"></i> Event Details
                                </button>
                                <button
                                    onclick="exportCurrentEventCSV(${ev.id})"
                                    class="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold py-2 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-1">
                                    <i class="fas fa-file-csv text-emerald-600"></i> CSV
                                </button>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });
            } else {
                if (noMsg) noMsg.classList.remove('hidden');
            }
        }
    } catch (err) {
        grid.innerHTML = '<div class="col-span-3 text-center py-12 text-rose-500 font-bold">Failed to load hosted events.</div>';
    }
}

// Load All League Events for Officials
async function loadOfficialAllEvents() {
    const user = getActiveUser();
    const grid = document.getElementById('officialAllEventsGrid');
    const noMsg = document.getElementById('noOfficialAllEventsMsg');
    const countEl = document.getElementById('allEventsCount');
    const offSearch = document.getElementById('officialAllEventsSearch');
    if (offSearch && (isAutofilledUserEmail(offSearch.value) || offSearch.value)) {
        if (isAutofilledUserEmail(offSearch.value)) offSearch.value = '';
    }
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-3 text-center py-12 text-gray-400 font-bold"><i class="fas fa-spinner fa-spin mr-2"></i>Loading all league events...</div>';

    try {
        let allEvents = null;
        if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
            try {
                allEvents = await window.SupabaseService.getPublicEvents();
            } catch (e) {
                console.warn('[Direct Supabase] getPublicEvents error:', e);
            }
        }

        if (!allEvents) {
            const res = await fetch(`${API_BASE}/events`);
            if (res.ok) {
                allEvents = await res.json();
            }
        }

        if (allEvents) {
            cachedAllOfficialEvents = Array.isArray(allEvents) ? allEvents : [];
            if (countEl) countEl.innerText = cachedAllOfficialEvents.length;

            renderOfficialAllEventsGrid(cachedAllOfficialEvents);
        }
    } catch (err) {
        grid.innerHTML = '<div class="col-span-3 text-center py-12 text-rose-500 font-bold">Failed to load league events.</div>';
    }
}

function renderOfficialAllEventsGrid(eventsToRender) {
    const grid = document.getElementById('officialAllEventsGrid');
    const noMsg = document.getElementById('noOfficialAllEventsMsg');
    const user = getActiveUser();
    if (!grid) return;

    grid.innerHTML = '';
    if (!eventsToRender || eventsToRender.length === 0) {
        if (noMsg) noMsg.classList.remove('hidden');
        return;
    }

    if (noMsg) noMsg.classList.add('hidden');

    eventsToRender.forEach(ev => {
        const isMyEvent = user && (
            (ev.officialId || '').toLowerCase() === (user.idNumber || '').toLowerCase() ||
            (user.email && (ev.officialEmail || '').toLowerCase() === user.email.toLowerCase())
        );

        const card = document.createElement('div');
        card.className = 'bg-white rounded-3xl p-6 shadow-sm border border-gray-200 flex flex-col justify-between hover:shadow-xl hover:border-yellow-500 transition-all duration-300';
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-3">
                    <span class="bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                        ${ev.sport}
                    </span>
                    ${isMyEvent ? `
                        <span class="bg-yellow-100 text-yellow-800 border border-yellow-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                            Your Event
                        </span>
                    ` : `
                        <span class="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                            By ${ev.officialName || 'Official'}
                        </span>
                    `}
                </div>

                <h3 class="text-xl font-black text-blue-950 uppercase italic tracking-tight line-clamp-2">
                    ${ev.name}
                </h3>

                <div class="text-xs text-gray-500 font-medium space-y-1.5 mt-3">
                    <div><i class="fas fa-calendar-alt text-yellow-600 mr-2"></i> ${ev.date}</div>
                    <div><i class="fas fa-map-marker-alt text-red-500 mr-2"></i> ${ev.location}</div>
                    <div><i class="fas fa-users text-blue-900 mr-2"></i> ${ev.registeredCount || 0} / ${ev.maxCapacity || 50} Athletes</div>
                </div>

                <p class="text-xs text-gray-600 mt-3 line-clamp-2 leading-relaxed">
                    ${ev.description || 'Professional tournament competition sanctioned under Pro Sports League standards.'}
                </p>
            </div>

            <div class="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2">
                <button
                    onclick="openPublicEventDetails(${ev.id})"
                    class="flex-1 bg-blue-900 hover:bg-yellow-500 hover:text-blue-950 text-white font-black py-2.5 rounded-xl uppercase tracking-wider text-xs transition shadow-sm flex items-center justify-center gap-1.5">
                    <i class="fas fa-eye text-yellow-400"></i> View Details
                </button>
                <span class="bg-gray-100 text-gray-400 font-bold px-3 py-2.5 rounded-xl text-xs uppercase flex items-center justify-center gap-1 border border-gray-200" title="Officials cannot register for events">
                    <i class="fas fa-shield-alt text-yellow-600"></i> Official View
                </span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function filterOfficialAllEvents(query) {
    if (isAutofilledUserEmail(query)) {
        const offSearch = document.getElementById('officialAllEventsSearch');
        if (offSearch) offSearch.value = '';
        query = '';
    }
    const q = (query || '').trim().toLowerCase();
    let filtered = [...cachedAllOfficialEvents];
    if (q) {
        filtered = filtered.filter(e => 
            e.name.toLowerCase().includes(q) || 
            e.sport.toLowerCase().includes(q) || 
            e.location.toLowerCase().includes(q) ||
            (e.officialName || '').toLowerCase().includes(q)
        );
    }
    renderOfficialAllEventsGrid(filtered);
}

// ================= OFFICIAL VIEW REGISTRATIONS MODAL =================
async function openViewRegistrationsModal(eventId) {
    const user = getActiveUser();
    if (!user) return;

    const event = cachedHostedEvents.find(e => e.id === Number(eventId)) || 
                  cachedPublicEvents.find(e => e.id === Number(eventId));
    if (!event) return;

    currentActiveRosterEvent = event;
    currentManagedEvent = event;

    document.getElementById('modalEventTitle').innerText = event.name;
    document.getElementById('modalEventSportBadge').innerText = event.sport;
    document.getElementById('modalEventCapacityBadge').innerText = `${event.registeredCount || 0} / ${event.maxCapacity || 50} Registered`;
    document.getElementById('modalEventDetails').innerText = `${event.date} • ${event.location}`;

    const tbody = document.getElementById('modalAthletesTableBody');
    const noMsg = document.getElementById('modalNoAthletesMsg');
    tbody.innerHTML = '<tr><td colspan="11" class="py-12 text-center text-gray-400 font-bold"><i class="fas fa-spinner fa-spin mr-2"></i>Loading athlete roster...</td></tr>';

    document.getElementById('officialRegistrationsModal').classList.remove('hidden');

    try {
        let roster = null;

        // Priority 1: Direct Supabase Cloud Service
        if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
            try {
                roster = await window.SupabaseService.getEventRegistrations(eventId, user.idNumber);
            } catch (supErr) {
                if (supErr.message && supErr.message.includes('Access denied')) {
                    closeOfficialRegistrationsModal();
                    showInteractiveToast('Access Restricted', supErr.message, 'danger');
                    return;
                }
                console.warn('[Direct Supabase] getEventRegistrations fallback:', supErr);
            }
        }

        // Priority 2: Express Server Fallback
        if (!roster) {
            const res = await fetch(`${API_BASE}/events/${eventId}/registrations?officialId=${encodeURIComponent(user.idNumber || '')}`, {
                headers: {
                    'x-user-id-number': user.idNumber || ''
                }
            });

            if (res.status === 403) {
                closeOfficialRegistrationsModal();
                showInteractiveToast('Access Restricted', 'Only the official who hosted this event is authorized to view its athlete registrations.', 'danger');
                return;
            }

            if (res.ok) {
                roster = await res.json();
            }
        }

        if (roster) {
            cachedActiveRoster = Array.isArray(roster) ? roster : [];
            currentManagedEvent.registrations = cachedActiveRoster;

            updateRosterCounts();
            renderRegistrationsTable(cachedActiveRoster);
        } else {
            tbody.innerHTML = '<tr><td colspan="11" class="py-12 text-center text-rose-500 font-bold">Failed to load roster.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="11" class="py-12 text-center text-rose-500 font-bold">Could not load roster.</td></tr>';
    }
}

function closeOfficialRegistrationsModal() {
    const modal = document.getElementById('officialRegistrationsModal');
    if (modal) modal.classList.add('hidden');
    currentActiveRosterEvent = null;
}

// Backwards compatibility aliases
function openManageEventModal(eventId) {
    openViewRegistrationsModal(eventId);
}
function closeManageEventModal() {
    closeOfficialRegistrationsModal();
}

function updateRosterCounts() {
    const total = cachedActiveRoster.length;
    const pending = cachedActiveRoster.filter(r => (r.status || 'Pending').toLowerCase() === 'pending').length;
    const approved = cachedActiveRoster.filter(r => (r.status || '').toLowerCase() === 'approved').length;
    const rejected = cachedActiveRoster.filter(r => (r.status || '').toLowerCase() === 'rejected').length;

    const elTotal = document.getElementById('countRegAll');
    const elPending = document.getElementById('countRegPending');
    const elApproved = document.getElementById('countRegApproved');
    const elRejected = document.getElementById('countRegRejected');

    if (elTotal) elTotal.innerText = total;
    if (elPending) elPending.innerText = pending;
    if (elApproved) elApproved.innerText = approved;
    if (elRejected) elRejected.innerText = rejected;
}

function renderRegistrationsTable(rosterToRender) {
    const tbody = document.getElementById('modalAthletesTableBody');
    const noMsg = document.getElementById('modalNoAthletesMsg');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!rosterToRender || rosterToRender.length === 0) {
        if (noMsg) noMsg.classList.remove('hidden');
        return;
    }

    if (noMsg) noMsg.classList.add('hidden');

    rosterToRender.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-blue-50/40 border-b border-gray-100 transition text-xs';

        const statusLower = (r.status || 'Pending').toLowerCase();
        let statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
        if (statusLower === 'approved') statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (statusLower === 'rejected') statusBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300';

        tr.innerHTML = `
            <td class="py-3 px-4 font-black text-blue-950">${r.athleteName}</td>
            <td class="py-3 px-4 text-gray-600">${r.email || 'N/A'}</td>
            <td class="py-3 px-4 font-mono text-gray-700">${r.mobileNumber || 'N/A'}</td>
            <td class="py-3 px-4 text-gray-600">${r.dob || 'N/A'}</td>
            <td class="py-3 px-4 text-gray-600">${r.gender || 'N/A'}</td>
            <td class="py-3 px-4 font-bold text-blue-900">${r.sport || 'N/A'}</td>
            <td class="py-3 px-4 text-gray-600">${r.teamClub || 'N/A'}</td>
            <td class="py-3 px-4 text-gray-600">${r.experienceLevel || 'N/A'}</td>
            <td class="py-3 px-4 text-gray-400 font-mono text-[11px]">${r.date || 'Recent'}</td>
            <td class="py-3 px-4 text-center">
                <select
                    onchange="updateAthleteRegistrationStatus('${currentActiveRosterEvent.id}', '${r.id}', this.value)"
                    class="border ${statusBadgeClass} text-[11px] font-black uppercase rounded-lg px-2 py-1 outline-none cursor-pointer">
                    <option value="Pending" ${statusLower === 'pending' ? 'selected' : ''}>🟡 Pending</option>
                    <option value="Approved" ${statusLower === 'approved' ? 'selected' : ''}>🟢 Approved</option>
                    <option value="Rejected" ${statusLower === 'rejected' ? 'selected' : ''}>🔴 Rejected</option>
                </select>
            </td>
            <td class="py-3 px-4 text-right">
                <button
                    onclick="openSingleAthleteDetailModal('${r.id}')"
                    class="bg-blue-900 hover:bg-yellow-500 hover:text-blue-950 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition shadow-sm">
                    View
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterRegistrationsByStatus(status) {
    document.querySelectorAll('.reg-filter-btn').forEach(btn => {
        btn.className = 'reg-filter-btn px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition';
    });

    const activeBtn = document.getElementById(`regFilter${status.charAt(0).toUpperCase() + status.slice(1)}`);
    if (activeBtn) {
        activeBtn.className = 'reg-filter-btn px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-900 text-white transition shadow-sm';
    }

    if (status === 'all') {
        renderRegistrationsTable(cachedActiveRoster);
    } else {
        const filtered = cachedActiveRoster.filter(r => (r.status || 'Pending').toLowerCase() === status.toLowerCase());
        renderRegistrationsTable(filtered);
    }
}

// Update Athlete Registration Status (Pending, Approved, Rejected)
async function updateAthleteRegistrationStatus(eventId, regId, newStatus) {
    const user = getActiveUser();
    if (!user) return;

    try {
        let updated = false;

        // Priority 1: Direct Supabase Cloud Service
        if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
            try {
                await window.SupabaseService.updateRegistrationStatus(regId, newStatus);
                updated = true;
            } catch (e) {
                console.warn('[Direct Supabase] updateRegistrationStatus fallback:', e);
            }
        }

        // Priority 2: Express Server Fallback
        if (!updated) {
            const res = await fetch(`${API_BASE}/events/${eventId}/registrations/${regId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, officialId: user.idNumber })
            });

            if (res.ok) {
                updated = true;
            } else {
                const data = await res.json().catch(() => ({}));
                showInteractiveToast('Update Failed', data.error || 'Failed to update status.', 'danger');
                return;
            }
        }

        if (updated) {
            const reg = cachedActiveRoster.find(r => String(r.id) === String(regId));
            if (reg) reg.status = newStatus;
            updateRosterCounts();
            showInteractiveToast('Status Updated', `Registration status updated to ${newStatus}.`, 'success');
        }
    } catch (err) {
        showInteractiveToast('Error', 'Server connection failure.', 'danger');
    }
}

// Single Athlete Details Modal
function openSingleAthleteDetailModal(regId) {
    const reg = cachedActiveRoster.find(r => String(r.id) === String(regId));
    if (!reg) return;

    document.getElementById('singleAthName').innerText = reg.athleteName;
    document.getElementById('singleAthId').innerText = reg.idNumber || 'ATH-N/A';
    document.getElementById('singleAthStatus').innerText = reg.status || 'Pending';
    document.getElementById('singleAthEmail').innerText = reg.email || 'N/A';
    document.getElementById('singleAthMobile').innerText = reg.mobileNumber || 'N/A';
    document.getElementById('singleAthDob').innerText = reg.dob || 'N/A';
    document.getElementById('singleAthGender').innerText = reg.gender || 'N/A';
    document.getElementById('singleAthSport').innerText = reg.sport || 'N/A';
    document.getElementById('singleAthTeam').innerText = reg.teamClub || 'N/A';
    document.getElementById('singleAthExp').innerText = reg.experienceLevel || 'N/A';
    document.getElementById('singleAthAdditional').innerText = reg.additionalInfo || 'None provided.';

    const answersList = document.getElementById('singleAthCustomAnswersList');
    answersList.innerHTML = '';
    const answers = reg.customAnswers || {};
    if (typeof answers === 'object' && Object.keys(answers).length > 0) {
        Object.entries(answers).forEach(([k, v]) => {
            const row = document.createElement('div');
            row.className = 'flex justify-between py-1 border-b border-yellow-200/50';
            row.innerHTML = `<span class="font-bold text-gray-700">${k}:</span> <span class="font-black text-blue-950">${v}</span>`;
            answersList.appendChild(row);
        });
    } else {
        answersList.innerHTML = '<span class="text-gray-400 italic">No custom field answers provided.</span>';
    }

    document.getElementById('singleAthleteDetailModal').classList.remove('hidden');
}

function closeSingleAthleteDetailModal() {
    const modal = document.getElementById('singleAthleteDetailModal');
    if (modal) modal.classList.add('hidden');
}

// Export Roster to CSV with all 10 fields
function exportCurrentEventCSV(eventId) {
    const event = currentManagedEvent || 
                  cachedHostedEvents.find(e => e.id === Number(eventId));
    if (!event) return;

    const roster = (event.registrations && event.registrations.length > 0) ? event.registrations : cachedActiveRoster;
    if (!roster || roster.length === 0) {
        return showInteractiveToast('Export Unavailable', 'There are no registered athletes to export for this event.', 'warning');
    }

    let csvContent = "Athlete Name,Athlete ID,Email,Mobile Number,Age / DOB,Gender,Sport,Team / Club,Experience Level,Registration Date,Status,Additional Info,Custom Answers\n";

    roster.forEach(r => {
        let answersText = "";
        if (r.customAnswers && typeof r.customAnswers === 'object') {
            answersText = Object.entries(r.customAnswers)
                .map(([k, v]) => `${k}: ${v}`)
                .join('; ');
        }
        const safeName = `"${(r.athleteName || '').replace(/"/g, '""')}"`;
        const safeId = `"${(r.idNumber || '').replace(/"/g, '""')}"`;
        const safeEmail = `"${(r.email || '').replace(/"/g, '""')}"`;
        const safeMobile = `"${(r.mobileNumber || '').replace(/"/g, '""')}"`;
        const safeDob = `"${(r.dob || '').replace(/"/g, '""')}"`;
        const safeGender = `"${(r.gender || '').replace(/"/g, '""')}"`;
        const safeSport = `"${(r.sport || event.sport || '').replace(/"/g, '""')}"`;
        const safeTeam = `"${(r.teamClub || '').replace(/"/g, '""')}"`;
        const safeExp = `"${(r.experienceLevel || '').replace(/"/g, '""')}"`;
        const safeDate = `"${(r.date || '').replace(/"/g, '""')}"`;
        const safeStatus = `"${(r.status || 'Pending').replace(/"/g, '""')}"`;
        const safeAdd = `"${(r.additionalInfo || '').replace(/"/g, '""')}"`;
        const safeAnswers = `"${answersText.replace(/"/g, '""')}"`;

        csvContent += `${safeName},${safeId},${safeEmail},${safeMobile},${safeDob},${safeGender},${safeSport},${safeTeam},${safeExp},${safeDate},${safeStatus},${safeAdd},${safeAnswers}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeFilename = (event.name || "Event").toLowerCase().replace(/[^a-z0-9]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `roster_${safeFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showInteractiveToast('Export Successful', `Downloaded roster for ${event.name}!`, 'success');
}

// ================= AUTH MODAL & FORM SWITCHER =================
function setLoginAlert(message, type = 'danger') {
    const el = document.getElementById('loginInlineAlert');
    if (!el) return;
    if (!message) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
    }
    const styles = {
        danger: 'bg-rose-50 text-rose-800 border border-rose-200',
        warning: 'bg-amber-50 text-amber-800 border border-amber-200',
        success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        info: 'bg-blue-50 text-blue-800 border border-blue-200'
    };
    el.className = `p-3 rounded-xl text-xs font-bold leading-relaxed ${styles[type] || styles.danger}`;
    el.innerHTML = message;
    el.classList.remove('hidden');
}

function setRegisterAlert(message, type = 'danger') {
    const el = document.getElementById('registerInlineAlert');
    if (!el) return;
    if (!message) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
    }
    const styles = {
        danger: 'bg-rose-50 text-rose-800 border border-rose-200',
        warning: 'bg-amber-50 text-amber-800 border border-amber-200',
        success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        info: 'bg-blue-50 text-blue-800 border border-blue-200'
    };
    el.className = `p-3 rounded-xl text-xs font-bold leading-relaxed ${styles[type] || styles.danger}`;
    el.innerHTML = message;
    el.classList.remove('hidden');
}

function openDirectLogin(role) {
    currentSelectedRole = role || 'Athlete';
    showDetailsForm(currentSelectedRole, 'login');
    document.getElementById('authModal').classList.remove('hidden');
}

function showDetailsForm(role, initialMode = 'login') {
    currentSelectedRole = role || 'Athlete';
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    document.getElementById('formTitle').innerText = `${role} Portal`;
    document.getElementById('modalSubTitle').innerText = `Portal: ${role}`;
    setAuthMode(initialMode);
}

function setAuthMode(mode) {
    const btnReg = document.getElementById('tabAuthRegister');
    const btnLog = document.getElementById('tabAuthLogin');
    const regGroup = document.getElementById('registerFieldsGroup');
    const logGroup = document.getElementById('loginFieldsGroup');

    // Clear any previous alerts
    setLoginAlert('');
    setRegisterAlert('');

    if (mode === 'register') {
        btnReg.className = 'flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg bg-white text-blue-900 shadow-sm transition';
        btnLog.className = 'flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg text-gray-500 hover:text-blue-900 transition';
        regGroup.classList.remove('hidden');
        logGroup.classList.add('hidden');
        document.getElementById('formTitle').innerText = `${currentSelectedRole} Registration`;
    } else {
        btnLog.className = 'flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg bg-white text-blue-900 shadow-sm transition';
        btnReg.className = 'flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg text-gray-500 hover:text-blue-900 transition';
        logGroup.classList.remove('hidden');
        regGroup.classList.add('hidden');
        document.getElementById('formTitle').innerText = `${currentSelectedRole} Sign In`;
    }
}

function resetModal() {
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('modalSubTitle').innerText = `Official Portal`;
    setLoginAlert('');
    setRegisterAlert('');
    setAuthMode('login');
}

function hideModal() { 
    document.getElementById('authModal').classList.add('hidden'); 
}

function refreshUI() {
    const user = getActiveUser();
    const loggedOutBtns = document.getElementById('loggedOutButtons');
    const loggedInProfile = document.getElementById('loggedInProfile');
    const userInitial = document.getElementById('userInitialLetter');
    const navName = document.getElementById('navUserNameText');
    const navBadge = document.getElementById('navUserStatusBadge');

    // Mobile Navbar Elements
    const mobileLoggedOut = document.getElementById('mobileLoggedOutBtns');
    const mobileLoggedIn = document.getElementById('mobileLoggedInProfile');
    const mobileInitial = document.getElementById('mobileUserInitial');

    if (user) {
        if (loggedOutBtns) loggedOutBtns.classList.add('hidden');
        if (loggedInProfile) loggedInProfile.classList.remove('hidden');
        if (userInitial) userInitial.innerText = user.name ? user.name.charAt(0).toUpperCase() : '?';
        if (navName) navName.innerText = user.name || 'User';

        if (mobileLoggedOut) mobileLoggedOut.classList.add('hidden');
        if (mobileLoggedIn) mobileLoggedIn.classList.remove('hidden');
        if (mobileInitial) mobileInitial.innerText = user.name ? user.name.charAt(0).toUpperCase() : '?';

        if (navBadge) {
            if (user.status === 'approved') {
                navBadge.innerText = `Verified ${user.role || ''}`;
                navBadge.className = 'text-[10px] font-bold text-emerald-600 uppercase mt-0.5';
            } else if (user.status === 'denied') {
                navBadge.innerText = 'Access Denied';
                navBadge.className = 'text-[10px] font-bold text-rose-600 uppercase mt-0.5';
            } else {
                navBadge.innerText = 'Pending Review';
                navBadge.className = 'text-[10px] font-bold text-amber-500 uppercase mt-0.5';
            }
        }
    } else {
        if (loggedOutBtns) loggedOutBtns.classList.remove('hidden');
        if (loggedInProfile) loggedInProfile.classList.add('hidden');
        if (mobileLoggedOut) mobileLoggedOut.classList.remove('hidden');
        if (mobileLoggedIn) mobileLoggedIn.classList.add('hidden');
    }
}

// Registration Submit
async function submitRegistration() {
    const nameEl = document.getElementById('fullName');
    const emailEl = document.getElementById('uEmail');
    const idEl = document.getElementById('uIdNumber');
    const passEl = document.getElementById('uPassword');
    const btn = document.getElementById('finalSubmit');

    setRegisterAlert('');

    const payload = {
        name: nameEl ? nameEl.value.trim() : '',
        email: emailEl ? emailEl.value.trim() : '',
        idNumber: idEl ? idEl.value.trim() : '',
        role: currentSelectedRole,
        password: passEl ? passEl.value : ''
    };

    if (!payload.name || !payload.idNumber || !payload.email) {
        setRegisterAlert('<i class="fas fa-exclamation-circle mr-1.5"></i> Please fill in all registration fields.', 'warning');
        return showInteractiveToast('Missing Information', 'Please fill in all registration fields.', 'warning');
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Submitting...';
    }

    try {
        let registeredUser = null;

        // Priority 1: Direct Supabase Cloud Registration
        if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
            try {
                registeredUser = await window.SupabaseService.registerUser(payload);
            } catch (supErr) {
                if (supErr.message && (supErr.message.includes('already registered') || supErr.message.includes('Please provide'))) {
                    setRegisterAlert(`<i class="fas fa-ban mr-1.5"></i> ${supErr.message}`, 'danger');
                    showInteractiveToast('Registration Blocked', supErr.message, 'danger');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span>Verify & Complete</span> <i class="fas fa-arrow-right ml-2"></i>';
                    }
                    return;
                }
                console.warn('[Direct Supabase] Registration fallback to API:', supErr);
            }
        }

        // Priority 2: Express Server Fallback
        if (!registeredUser && API_BASE) {
            try {
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 5000);
                const response = await fetch(`${API_BASE}/register`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(tid);

                const result = await response.json();
                if (response.ok) {
                    registeredUser = result.user || { ...payload, status: 'pending' };
                } else {
                    const msg = result.error || 'Registration failed.';
                    setRegisterAlert(`<i class="fas fa-ban mr-1.5"></i> ${msg}`, 'danger');
                    showInteractiveToast('Registration Blocked', msg, 'danger');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span>Verify & Complete</span> <i class="fas fa-arrow-right ml-2"></i>';
                    }
                    return;
                }
            } catch (netErr) {
                console.warn('[Express Fallback] Register fetch failed:', netErr);
            }
        }

        if (registeredUser) {
            setRegisterAlert('<i class="fas fa-check-circle mr-1.5"></i> Registration submitted successfully!', 'success');
            localStorage.setItem('proSportsUser', JSON.stringify(registeredUser));
            
            setTimeout(() => {
                hideModal();
                refreshUI();
                showInteractiveAccessModal(registeredUser, 'pending');
                showInteractiveToast('Registration Submitted', 'Your account is currently awaiting Admin approval.', 'warning');
            }, 500);
        } else {
            setRegisterAlert('<i class="fas fa-exclamation-triangle mr-1.5"></i> Could not connect to database. Please check your internet connection.', 'danger');
            showInteractiveToast('Connection Error', 'Failed to reach cloud database.', 'danger');
        }
    } catch (err) { 
        setRegisterAlert(`<i class="fas fa-exclamation-circle mr-1.5"></i> ${err.message || 'Failed to submit registration.'}`, 'danger');
        showInteractiveToast('Registration Error', err.message || 'Failed to submit registration.', 'danger');
    } finally {
        if (btn) {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<span>Verify & Complete</span> <i class="fas fa-arrow-right ml-2"></i>';
            }, 800);
        }
    }
}

// User Sign In Submit
async function submitLogin() {
    const idEl = document.getElementById('loginIdentifier');
    const passEl = document.getElementById('loginPassword');
    const btn = document.getElementById('btnLoginSubmit');
    const identifier = idEl ? idEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    setLoginAlert('');

    if (!identifier) {
        setLoginAlert('<i class="fas fa-exclamation-circle mr-1.5"></i> Please enter your Email or ID Number.', 'warning');
        showInteractiveToast('Input Required', 'Please enter your Email or ID Number.', 'warning');
        if (idEl) idEl.focus();
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Signing In...';
    }

    try {
        let user = null;

        // Priority 1: Direct Supabase Cloud Login (Fast, Direct Cloud Access)
        if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
            try {
                const res = await window.SupabaseService.login(identifier, currentSelectedRole);
                user = res.user;
            } catch (supErr) {
                console.warn('[Direct Supabase] Login attempt error:', supErr);
                if (supErr.message && (supErr.message.includes('No registration found') || supErr.message.includes('registered as an'))) {
                    setLoginAlert(`<i class="fas fa-times-circle mr-1.5"></i> ${supErr.message}`, 'danger');
                    showInteractiveToast('Login Failed', supErr.message, 'danger');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span>Sign In to Account</span> <i class="fas fa-sign-in-alt ml-2"></i>';
                    }
                    return;
                }
            }
        }

        // Priority 2: Express Server Fallback (Fast 4s Timeout)
        if (!user && API_BASE) {
            try {
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 4000);
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, role: currentSelectedRole, password }),
                    signal: controller.signal
                });
                clearTimeout(tid);
                const data = await res.json();
                if (res.ok && data.user) {
                    user = data.user;
                } else {
                    const msg = data.error || 'Account not found.';
                    setLoginAlert(`<i class="fas fa-times-circle mr-1.5"></i> ${msg}`, 'danger');
                    showInteractiveToast('Login Failed', msg, 'danger');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span>Sign In to Account</span> <i class="fas fa-sign-in-alt ml-2"></i>';
                    }
                    return;
                }
            } catch (fetchErr) {
                console.warn('[Express Fallback] Login fetch failed:', fetchErr);
            }
        }

        if (!user) {
            setLoginAlert('<i class="fas fa-exclamation-triangle mr-1.5"></i> Could not connect to server or database. Please check your internet connection.', 'danger');
            showInteractiveToast('Connection Error', 'Unable to reach backend server or Supabase cloud.', 'danger');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>Sign In to Account</span> <i class="fas fa-sign-in-alt ml-2"></i>';
            }
            return;
        }

        // Login Succeeded
        setLoginAlert(`<i class="fas fa-check-circle mr-1.5"></i> Welcome back, ${user.name}! Logging you in...`, 'success');
        localStorage.setItem('proSportsUser', JSON.stringify(user));

        setTimeout(() => {
            hideModal();
            refreshUI();
            syncPreferencesOnLogin(user);
            loadPlayerNotifications();

            if (user.status === 'pending') {
                showInteractiveAccessModal(user, 'pending');
                showInteractiveToast('Verification Pending', 'Your account is under review by the Administrator.', 'warning');
            } else if (user.status === 'denied') {
                showInteractiveAccessModal(user, 'denied');
                showInteractiveToast('Access Denied', 'Your registration has been denied by the Administrator.', 'danger');
            } else {
                showInteractiveToast('Access Allowed', `Welcome back, ${user.name}! Your account is verified.`, 'success');

                // Check and resume pending event registration
                const pendingRaw = localStorage.getItem('pendingRegistration');
                if (pendingRaw) {
                    try {
                        const pending = JSON.parse(pendingRaw);
                        localStorage.removeItem('pendingRegistration');
                        if (pending.type === 'event' && pending.eventId) {
                            showInteractiveToast('Resuming Registration', `Continuing registration for "${pending.eventName}"...`, 'info');
                            setTimeout(() => {
                                handlePublicEventRegister(pending.eventId);
                            }, 350);
                            return;
                        }
                    } catch (e) {
                        localStorage.removeItem('pendingRegistration');
                    }
                }

                routeUserDashboard(user);
            }
        }, 400);

    } catch (err) {
        console.error('[Login Error]:', err);
        setLoginAlert(`<i class="fas fa-exclamation-circle mr-1.5"></i> ${err.message || 'An error occurred during authentication.'}`, 'danger');
        showInteractiveToast('Connection Error', err.message || 'Failed to authenticate.', 'danger');
    } finally {
        if (btn) {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<span>Sign In to Account</span> <i class="fas fa-sign-in-alt ml-2"></i>';
            }, 800);
        }
    }
}

// Quick Login Preset
async function quickLoginPreset(email, role) {
    currentSelectedRole = role;
    try {
        let user = null;

        // Priority 1: Direct Supabase Cloud Login
        if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
            try {
                const res = await window.SupabaseService.login(email, role);
                user = res.user;
            } catch (e) {
                console.warn('[Direct Supabase] Preset login fallback:', e);
            }
        }

        // Priority 2: Express Server Fallback
        if (!user) {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: email, role })
            });
            const data = await res.json();
            if (res.ok) user = data.user;
        }

        if (user) {
            localStorage.setItem('proSportsUser', JSON.stringify(user));
            hideModal();
            refreshUI();

            if (user.status === 'pending') {
                showInteractiveAccessModal(user, 'pending');
                showInteractiveToast('Verification Pending', `Account for ${user.name} is awaiting Admin approval.`, 'warning');
            } else if (user.status === 'denied') {
                showInteractiveAccessModal(user, 'denied');
                showInteractiveToast('Access Denied', `Account for ${user.name} has been rejected by Admin.`, 'danger');
            } else {
                showInteractiveToast('Access Allowed', `Welcome ${user.name} (${user.role})!`, 'success');

                // Check and resume pending event registration
                const pendingRaw = localStorage.getItem('pendingRegistration');
                if (pendingRaw) {
                    try {
                        const pending = JSON.parse(pendingRaw);
                        localStorage.removeItem('pendingRegistration');
                        if (pending.type === 'event' && pending.eventId) {
                            showInteractiveToast('Resuming Registration', `Continuing registration for "${pending.eventName}"...`, 'info');
                            setTimeout(() => {
                                handlePublicEventRegister(pending.eventId);
                            }, 350);
                            return;
                        }
                    } catch (e) {
                        localStorage.removeItem('pendingRegistration');
                    }
                }

                routeUserDashboard(user);
            }
        }
    } catch (e) {
        showInteractiveToast('Server Error', 'Failed to log in with demo account.', 'danger');
    }
}

function handleLogout() {
    localStorage.removeItem('proSportsUser');
    closeAccessNoticeModal();
    showInteractiveToast('Logged Out', 'You have been logged out safely.', 'info');
    setTimeout(() => location.reload(), 400);
}

// ================= TOURNAMENTS (ATHLETES ONLY) =================
const allTournaments = [
    { id: 1, sport: 'Cricket', name: 'Inter-College Cup', date: 'March 15, 2026', status: 'Open' },
    { id: 2, sport: 'Cricket', name: 'Pro T20 League Qualifier', date: 'April 05, 2026', status: 'Open' },
    { id: 3, sport: 'Football', name: 'Champions League', date: 'April 02, 2026', status: 'Open' },
    { id: 4, sport: 'Football', name: 'Inter-District Super Cup', date: 'May 10, 2026', status: 'Open' },
    { id: 5, sport: 'Kabaddi', name: 'National Mat Championship', date: 'March 28, 2026', status: 'Open' },
    { id: 6, sport: 'Track & Field', name: '100m Sprint Open', date: 'March 20, 2026', status: 'Open' }
];

async function showTournaments(sportName) {
    document.getElementById('dashSportsList').classList.add('hidden');
    const tourneyView = document.getElementById('tournamentListView');
    const tourneyGrid = document.getElementById('tournamentGrid');
    const noMsg = document.getElementById('noTournamentMsg');
    const title = document.getElementById('selectedSportTitle');

    tourneyView.classList.remove('hidden');
    title.innerText = sportName;
    tourneyGrid.innerHTML = '<div class="text-center py-8 text-gray-400 font-bold">Loading tournaments...</div>';

    let list = allTournaments;
    if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
        try {
            const tours = await window.SupabaseService.getTournaments();
            if (Array.isArray(tours) && tours.length > 0) list = tours;
        } catch (e) {}
    }
    if (list === allTournaments) {
        try {
            const res = await fetch(`${API_BASE}/tournaments`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) list = data;
            }
        } catch (e) {
            console.warn("Using offline tournament cache");
        }
    }

    tourneyGrid.innerHTML = '';
    const filtered = list.filter(t => (t.sport || t.sport_type || '').toLowerCase().includes(sportName.toLowerCase()) || sportName.toLowerCase().includes((t.sport || t.sport_type || '').toLowerCase()));

    if (filtered.length > 0) {
        noMsg.classList.add('hidden');
        filtered.forEach(t => {
            const card = `
                <div class="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-yellow-500 flex justify-between items-center hover:shadow-md transition">
                    <div>
                        <h4 class="text-xl font-black text-blue-900">${t.name || t.tournament_name}</h4>
                        <p class="text-gray-500 font-bold text-sm">Date: ${t.date || t.event_date}</p>
                        <p class="text-gray-400 text-xs">${t.venue || t.location || 'Stadium'}</p>
                    </div>
                    <button onclick="registerTournamentClick(this, ${t.id}, '${t.name || t.tournament_name}')" class="bg-blue-900 text-white px-6 py-2 rounded-full font-bold uppercase text-xs hover:bg-yellow-500 hover:text-blue-900 transition">Register</button>
                </div>`;
            tourneyGrid.innerHTML += card;
        });
    } else {
        noMsg.classList.remove('hidden');
    }
}

async function registerTournamentClick(btn, tourneyId, name) {
    const user = getActiveUser();
    if (!user) {
        openDirectLogin('Athlete');
        return;
    }

    if (user.role === 'Official') {
        showInteractiveToast('Role Restricted', 'Officials manage events rather than enrolling as tournament athletes.', 'warning');
        return;
    }

    const isAllowed = await verifyUserApprovalLive(user);
    if (!isAllowed) return;

    btn.className = 'bg-emerald-600 text-white px-6 py-2 rounded-full font-bold uppercase text-xs cursor-default';
    btn.innerHTML = '<i class="fas fa-check mr-1"></i> Registered';

    try {
        await fetch(`${API_BASE}/tournaments/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tournamentId: tourneyId,
                userId: user.id,
                userName: user.name,
                idNumber: user.idNumber
            })
        });
    } catch(err) {
        console.warn("Backend register call failed:", err);
    }

    showInteractiveToast('Registration Successful', `You are enrolled in ${name}!`, 'success');
}

function backToSports() {
    document.getElementById('tournamentListView').classList.add('hidden');
    document.getElementById('dashSportsList').classList.remove('hidden');
}

// ================= MARATHONS (ROLE DIFFERENTIATED) =================
async function openMarathonDashboard() {
    const user = getActiveUser();
    
    if (user) {
        const isAllowed = await verifyUserApprovalLive(user);
        if (!isAllowed) return;

        document.querySelector('header').classList.add('hidden');
        document.querySelector('#register').classList.add('hidden');
        if (document.querySelector('footer')) document.querySelector('footer').classList.add('hidden');
        document.getElementById('sportsDashboard').classList.add('hidden');
        document.getElementById('officialsDashboard').classList.add('hidden');
        
        document.getElementById('marathonDashboard').classList.remove('hidden');
        document.getElementById('maraUserName').innerText = user.name;
        document.getElementById('maraInitial').innerText = user.name.charAt(0).toUpperCase();
        
        const subtitle = document.getElementById('maraRoleSubtitle');
        if (subtitle) {
            subtitle.innerText = user.role === 'Official' 
                ? 'Official Race Supervisor • Marathon Division' 
                : 'Athlete Runner • Marathon Division';
        }
        
        loadMarathons();
        window.scrollTo(0, 0);
    } else {
        resetModal();
        document.getElementById('authModal').classList.remove('hidden');
    }
}

async function loadMarathons() {
    const list = document.getElementById('marathonList');
    const noMsg = document.getElementById('noMaraMsg');
    const user = getActiveUser();
    
    let marathonsData = [
        { id: 1, title: 'National City Marathon 2026', date: 'April 10th, 2026', registrations: 124 },
        { id: 2, title: 'Pro Sports 10K Speed Run', date: 'May 5th, 2026', registrations: 78 },
        { id: 3, title: 'Coastal Half Marathon (21K)', date: 'June 12th, 2026', registrations: 53 }
    ];

    if (window.SupabaseService && window.CONFIG && window.CONFIG.USE_DIRECT_SUPABASE) {
        try {
            const mars = await window.SupabaseService.getMarathons();
            if (Array.isArray(mars) && mars.length > 0) marathonsData = mars;
        } catch (e) {}
    }

    try {
        if (marathonsData.length === 3 && marathonsData[0].title === 'National City Marathon 2026') {
            const res = await fetch(`${API_BASE}/marathons`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    marathonsData = data;
                }
            }
        }
    } catch(e) {
        console.warn("Using offline marathon cache");
    }

    list.innerHTML = '';

    if (marathonsData.length > 0) {
        noMsg.classList.add('hidden');
        marathonsData.forEach(m => {
            const mTitle = m.title || m.marathon_name;
            const mDate = m.date || m.event_date;
            const mRegs = m.registrations !== undefined ? m.registrations : 0;
            let actionBlock = '';

            if (user && user.role === 'Official') {
                actionBlock = `
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest hidden sm:inline">Role:</span>
                        <button
                            onclick="claimOfficialMarathonDuty(this, '${mTitle}')"
                            class="bg-yellow-500 hover:bg-yellow-400 text-blue-950 px-6 py-2.5 rounded-xl font-black uppercase text-xs transition-all shadow-md flex items-center gap-1.5">
                            <i class="fas fa-clipboard-check"></i> Officiate Race
                        </button>
                    </div>
                `;
            } else {
                actionBlock = `
                    <button
                        onclick="registerAthleteForMarathon(this, ${m.id}, '${mTitle}')"
                        class="bg-blue-900 hover:bg-yellow-500 hover:text-blue-950 text-white px-8 py-3 rounded-xl font-black uppercase text-xs transition-all shadow-md">
                        Register Now
                    </button>
                `;
            }

            list.innerHTML += `
                <div class="bg-white p-8 rounded-2xl shadow-xl border-l-8 border-yellow-500 flex flex-col justify-between hover:shadow-2xl transition duration-300">
                    <div>
                        <div class="flex justify-between items-start">
                            <h3 class="text-2xl font-black text-blue-900 uppercase italic">${mTitle}</h3>
                            ${user && user.role === 'Official' ? '<span class="bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-yellow-300">Official Roster</span>' : ''}
                        </div>
                        <p class="text-gray-500 font-bold mt-2 uppercase text-xs"><i class="fas fa-calendar-alt text-yellow-600 mr-2"></i>${mDate}</p>
                    </div>
                    <div class="mt-8 flex items-center justify-between border-t pt-6">
                        <span class="text-blue-900 font-black uppercase text-sm bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                            <i class="fas fa-users mr-1"></i> <span id="mara-count-${m.id}">${mRegs}</span> Runners
                        </span>
                        ${actionBlock}
                    </div>
                </div>`;
        });
    } else {
        noMsg.classList.remove('hidden');
    }
}

function claimOfficialMarathonDuty(btn, raceTitle) {
    btn.outerHTML = `
        <span class="bg-emerald-100 text-emerald-800 border border-emerald-300 px-4 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 shadow-sm">
            <i class="fas fa-check-circle"></i> Officiating Assigned
        </span>
    `;
    showInteractiveToast('Official Assignment Confirmed', `You are registered as a race official and overseer for ${raceTitle}!`, 'success');
}

async function registerAthleteForMarathon(btn, maraId, raceTitle) {
    const user = getActiveUser();
    if (!user) {
        openDirectLogin('Athlete');
        return;
    }

    const isAllowed = await verifyUserApprovalLive(user);
    if (!isAllowed) return;

    btn.className = 'bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs cursor-default';
    btn.innerHTML = '<i class="fas fa-check mr-1.5"></i> Registered';

    const countEl = document.getElementById(`mara-count-${maraId}`);
    if (countEl) {
        countEl.innerText = Number(countEl.innerText) + 1;
    }

    try {
        await fetch(`${API_BASE}/marathons/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                marathonId: maraId,
                userId: user.id,
                userName: user.name,
                idNumber: user.idNumber
            })
        });
    } catch(e) {
        console.warn("Backend marathon register call failed:", e);
    }

    showInteractiveToast('Marathon Registration Confirmed', `You are successfully registered as a runner for ${raceTitle}!`, 'success');
}

// Chatbase context sync helper
function updateChatbotContext() {
    const user = getActiveUser();
    if (user && window.Chatbase) {
        try {
            window.Chatbase("set", "user", {
                name: user.name,
                email: user.email
            });
        } catch(e) {}
    }
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) menu.classList.toggle('hidden');
}

// Native Capacitor Device Integrations
function initCapacitorPlugins() {
    if (!window.Capacitor) return;

    // 1. Splash Screen Auto-Hide
    if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('SplashScreen')) {
        try {
            window.Capacitor.Plugins.SplashScreen.hide();
        } catch (e) {}
    }

    // 2. Status Bar Style
    if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('StatusBar')) {
        try {
            window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#172554' });
        } catch (e) {}
    }

    // 3. Android Hardware Back Button Handling
    if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('App')) {
        try {
            window.Capacitor.Plugins.App.addListener('backButton', () => {
                // Priority 1: Close active modals
                const authModal = document.getElementById('authModal');
                if (authModal && !authModal.classList.contains('hidden')) {
                    hideModal();
                    return;
                }
                const accessModal = document.getElementById('accessNoticeModal');
                if (accessModal && !accessModal.classList.contains('hidden')) {
                    closeAccessNoticeModal();
                    return;
                }
                const manageModal = document.getElementById('manageEventModal');
                if (manageModal && !manageModal.classList.contains('hidden')) {
                    closeManageEventModal();
                    return;
                }

                // Priority 2: Close mobile menu if open
                const mobileMenu = document.getElementById('mobileMenu');
                if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                    return;
                }

                // Priority 3: Navigate back from dashboard / sub-views to home
                const sportsDash = document.getElementById('sportsDashboard');
                const offDash = document.getElementById('officialsDashboard');
                const maraDash = document.getElementById('marathonDashboard');
                const tourneyView = document.getElementById('tournamentListView');

                if (tourneyView && !tourneyView.classList.contains('hidden')) {
                    backToSports();
                    return;
                }

                if ((sportsDash && !sportsDash.classList.contains('hidden')) ||
                    (offDash && !offDash.classList.contains('hidden')) ||
                    (maraDash && !maraDash.classList.contains('hidden'))) {
                    returnToHome();
                    return;
                }

                if (window.innerWidth < 768) {
                    const pubSec = document.getElementById('publicEventsSection');
                    const header = document.querySelector('header');
                    if (pubSec && !pubSec.classList.contains('hidden') && header && header.classList.contains('hidden')) {
                        returnToHome();
                        return;
                    }
                }

                // Priority 4: Exit App at root
                window.Capacitor.Plugins.App.exitApp();
            });
        } catch (e) {}
    }

    // 4. Network Status Monitoring
    if (window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Network')) {
        try {
            window.Capacitor.Plugins.Network.addListener('networkStatusChange', status => {
                if (!status.connected) {
                    showInteractiveToast('Offline Mode', 'Internet connection lost. Reconnect to sync tournament registrations.', 'warning');
                } else {
                    showInteractiveToast('Connected', 'Internet connection restored!', 'success');
                }
            });
        } catch (e) {}
    }
}

// ================= SERVER CONNECTION MANAGER =================
async function checkBackendHealthLive(urlToCheck = null) {
    const targetUrl = urlToCheck || API_BASE;
    const dot = document.getElementById('navServerPingDot');
    const mDot = document.getElementById('mobileServerPingDot');
    const txt = document.getElementById('navServerPingText');

    // 1. Check direct Supabase Cloud connectivity
    let supabaseOnline = false;
    if (window.SupabaseService) {
        try {
            supabaseOnline = await window.SupabaseService.testConnection();
        } catch (e) {}
    }

    // 2. Check Express server connectivity
    let serverOnline = false;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${targetUrl}/health`, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) serverOnline = true;
    } catch (e) {}

    if (serverOnline && supabaseOnline) {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        if (mDot) mDot.className = 'absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500';
        if (txt) txt.innerText = 'Connected (Cloud & LAN)';
        return true;
    } else if (supabaseOnline) {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        if (mDot) mDot.className = 'absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500';
        if (txt) txt.innerText = 'Supabase Cloud';
        return true;
    } else if (serverOnline) {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        if (mDot) mDot.className = 'absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500';
        if (txt) txt.innerText = 'Server Online';
        return true;
    } else {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-500';
        if (mDot) mDot.className = 'absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500';
        if (txt) txt.innerText = 'Offline';
        return false;
    }
}

function openServerConfigModal() {
    const modal = document.getElementById('serverConfigModal');
    if (!modal) return;
    const input = document.getElementById('serverUrlInput');
    const activeText = document.getElementById('activeServerUrlText');
    const pill = document.getElementById('serverLiveStatusPill');
    const feedback = document.getElementById('serverTestFeedback');

    if (input) input.value = API_BASE;
    if (activeText) activeText.innerText = API_BASE;
    if (feedback) feedback.classList.add('hidden');

    modal.classList.remove('hidden');

    // Run quick health check
    checkBackendHealthLive(API_BASE).then(isOk => {
        if (pill) {
            pill.className = isOk 
                ? 'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300';
            pill.innerHTML = isOk 
                ? '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Connected' 
                : '<span class="w-2 h-2 rounded-full bg-rose-500"></span> Offline';
        }
    });
}

function closeServerConfigModal() {
    const modal = document.getElementById('serverConfigModal');
    if (modal) modal.classList.add('hidden');
}

function setPresetServerUrl(presetUrl) {
    const input = document.getElementById('serverUrlInput');
    if (input) input.value = presetUrl;
    testAndSaveServerUrl(presetUrl);
}

function resetServerUrlToDefault() {
    localStorage.removeItem('sportsconnect_api_override');
    API_BASE = window.CONFIG ? window.CONFIG.getApiBase() : 'http://localhost:3000';
    showInteractiveToast('Reset Server URL', `Reset backend target to default: ${API_BASE}`, 'info');
    openServerConfigModal();
    loadPublicEvents();
}

async function testAndSaveServerUrl(overrideUrl = null) {
    const input = document.getElementById('serverUrlInput');
    const feedback = document.getElementById('serverTestFeedback');
    const saveBtn = document.getElementById('btnSaveServerUrl');
    const url = (overrideUrl || (input ? input.value : '') || '').trim().replace(/\/+$/, '');

    if (!url) {
        if (feedback) {
            feedback.className = 'p-3 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200';
            feedback.innerText = 'Please enter a valid HTTP or HTTPS server URL.';
            feedback.classList.remove('hidden');
        }
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Testing...';
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${url}/events`, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            localStorage.setItem('sportsconnect_api_override', url);
            API_BASE = url;
            if (window.CONFIG) {
                window.CONFIG.DEV_LAN_API_URL = url;
            }

            if (feedback) {
                feedback.className = 'p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200';
                feedback.innerHTML = `<i class="fas fa-check-circle mr-1"></i> Connected successfully! Saved as active backend: <strong>${url}</strong>`;
                feedback.classList.remove('hidden');
            }

            showInteractiveToast('Server Connected!', `Backend URL set to ${url}`, 'success');
            checkBackendHealthLive(url);
            setTimeout(() => {
                closeServerConfigModal();
                loadPublicEvents();
            }, 1000);
        } else {
            throw new Error(`Server returned HTTP ${res.status}`);
        }
    } catch (err) {
        if (feedback) {
            feedback.className = 'p-3 rounded-xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200';
            feedback.innerHTML = `<i class="fas fa-exclamation-triangle mr-1"></i> Cannot connect to <strong>${url}</strong>.<br><span class="text-[11px] font-normal">Ensure your PC running "node server.js" and phone are on the same Wi-Fi, or test using the PC Wi-Fi IP (http://10.10.12.0:3000) or Android Emulator (http://10.0.2.2:3000).</span>`;
            feedback.classList.remove('hidden');
        }
        showInteractiveToast('Connection Failed', `Could not reach ${url}`, 'danger');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-check-circle text-yellow-400 mr-1"></i> Test & Save';
        }
    }
}

// ====================================================================
// PERSONALIZED SPORTS MATCH NOTIFICATIONS & PREFERENCES SYSTEM
// ====================================================================
let selectedOnboardingSports = [];
let selectedManageSports = [];
let cachedNotifications = [];

function isMobileClient() {
    return window.innerWidth < 768 || (typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function getStoredPlayerPreferences() {
    try {
        const raw = localStorage.getItem('prosports_player_preferences');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function getEffectivePlayerId() {
    const user = getActiveUser();
    if (user && user.idNumber) return user.idNumber;
    let guestId = localStorage.getItem('prosports_guest_player_id');
    if (!guestId) {
        guestId = 'ATH-' + Math.floor(100000 + Math.random() * 900000);
        localStorage.setItem('prosports_guest_player_id', guestId);
    }
    return guestId;
}

// 1. Initialize Personalized Notifications & Preferences on Page Load
function initPersonalizedNotifications() {
    // Setup Native Push & Local Notification Action Listeners
    setupNotificationListeners();

    // Load Notifications for Header Badge
    loadPlayerNotifications();

    // Check for First-Time App Opening on Mobile
    checkAndShowFirstTimeOnboarding();
}

function checkAndShowFirstTimeOnboarding() {
    if (!isMobileClient()) return;
    const completed = localStorage.getItem('prosports_preferences_completed');
    if (completed !== 'true') {
        setTimeout(() => {
            openPlayerOnboardingModal();
        }, 700);
    }
}

// 5-Step Onboarding Wizard State
let currentOnboardStep = 1;
const onboardingPreferences = {
    ageCategory: '',
    state: '',
    district: '',
    sports: []
};
let onboardingStateFilter = '';
let onboardingDistrictFilter = '';

function openPlayerOnboardingModal() {
    const modal = document.getElementById('playerOnboardingModal');
    if (!modal) return;

    // Load existing stored preferences if available to prefill
    const existing = getStoredPlayerPreferences();
    if (existing) {
        if (existing.age_category) onboardingPreferences.ageCategory = existing.age_category;
        if (existing.state) onboardingPreferences.state = existing.state;
        if (existing.district) onboardingPreferences.district = existing.district;
        if (Array.isArray(existing.sports)) onboardingPreferences.sports = [...existing.sports];
    }
    selectedOnboardingSports = onboardingPreferences.sports;

    // Reset to step 1
    goToOnboardingStep(1);
    modal.classList.remove('hidden');
}

function closePlayerOnboardingModal() {
    const modal = document.getElementById('playerOnboardingModal');
    if (modal) modal.classList.add('hidden');
}

function goToOnboardingStep(step) {
    if (step < 1 || step > 5) return;
    currentOnboardStep = step;

    const header = document.getElementById('onboardingWizardHeader');
    const footer = document.getElementById('onboardingNavFooter');
    const badge = document.getElementById('onboardingStepBadge');
    const progressBar = document.getElementById('onboardingProgressBar');
    const backBtn = document.getElementById('onboardingBackBtn');
    const nextBtn = document.getElementById('btnOnboardingNext');
    const nextText = document.getElementById('btnOnboardingNextText');
    const nextIcon = document.getElementById('btnOnboardingNextIcon');

    // Toggle step views visibility
    for (let i = 1; i <= 5; i++) {
        const view = document.getElementById(`onboardStepView${i}`);
        if (view) {
            if (i === step) {
                view.classList.remove('hidden');
            } else {
                view.classList.add('hidden');
            }
        }
    }

    // Step 5: Notification Permission Explanation Screen
    if (step === 5) {
        if (header) header.classList.add('hidden');
        if (footer) footer.classList.add('hidden');
        return;
    }

    // Steps 1 - 4: Preferences Wizard Flow
    if (header) header.classList.remove('hidden');
    if (footer) footer.classList.remove('hidden');

    if (badge) badge.textContent = `Step ${step} of 4`;
    if (progressBar) progressBar.style.width = `${step * 25}%`;

    // Back button visibility (hidden on Step 1)
    if (backBtn) {
        if (step === 1) {
            backBtn.disabled = true;
            backBtn.classList.add('opacity-0', 'pointer-events-none');
        } else {
            backBtn.disabled = false;
            backBtn.classList.remove('opacity-0', 'pointer-events-none');
        }
    }

    // Render active step content and update button state
    if (step === 1) {
        renderOnboardingAgeCards();
        if (nextText) nextText.textContent = 'Continue';
        if (nextIcon) nextIcon.className = 'fas fa-arrow-right';
        updateNextButtonState(Boolean(onboardingPreferences.ageCategory));
    } else if (step === 2) {
        renderOnboardingStatesList();
        if (nextText) nextText.textContent = 'Continue';
        if (nextIcon) nextIcon.className = 'fas fa-arrow-right';
        updateNextButtonState(Boolean(onboardingPreferences.state));
    } else if (step === 3) {
        const stateBadge = document.getElementById('onboardingSelectedStateBadge');
        if (stateBadge) stateBadge.textContent = onboardingPreferences.state || 'Selected State';
        renderOnboardingDistrictsList();
        if (nextText) nextText.textContent = 'Continue';
        if (nextIcon) nextIcon.className = 'fas fa-arrow-right';
        updateNextButtonState(Boolean(onboardingPreferences.district));
    } else if (step === 4) {
        renderOnboardingSportsGrid();
        if (nextText) nextText.textContent = 'Finish';
        if (nextIcon) nextIcon.className = 'fas fa-check';
        const count = onboardingPreferences.sports.length;
        updateNextButtonState(count >= 1 && count <= 5);
    }
}

function updateNextButtonState(isEnabled) {
    const nextBtn = document.getElementById('btnOnboardingNext');
    if (nextBtn) {
        nextBtn.disabled = !isEnabled;
    }
}

function handleOnboardingNext() {
    if (currentOnboardStep === 1) {
        if (!onboardingPreferences.ageCategory) return;
        goToOnboardingStep(2);
    } else if (currentOnboardStep === 2) {
        if (!onboardingPreferences.state) return;
        goToOnboardingStep(3);
    } else if (currentOnboardStep === 3) {
        if (!onboardingPreferences.district) return;
        goToOnboardingStep(4);
    } else if (currentOnboardStep === 4) {
        if (onboardingPreferences.sports.length === 0) {
            showInteractiveToast('Sports Selection', 'Please select at least 1 sport (up to 5).', 'warning');
            return;
        }
        if (onboardingPreferences.sports.length > 5) {
            showInteractiveToast('Sports Limit', 'You can select a maximum of 5 sports.', 'warning');
            return;
        }
        finishOnboardingPreferences();
    }
}

function handleOnboardingBack() {
    if (currentOnboardStep > 1 && currentOnboardStep <= 4) {
        goToOnboardingStep(currentOnboardStep - 1);
    }
}

// STEP 1 — AGE CATEGORY HANDLERS
function selectOnboardingAge(age) {
    onboardingPreferences.ageCategory = age;
    renderOnboardingAgeCards();
    updateNextButtonState(true);
}

function renderOnboardingAgeCards() {
    const cards = document.querySelectorAll('#onboardAgeOptions .onboard-age-card');
    cards.forEach(card => {
        const cardAge = card.getAttribute('data-age');
        const iconBox = card.querySelector('.card-icon-box');
        const check = card.querySelector('.check-indicator');
        if (cardAge === onboardingPreferences.ageCategory) {
            card.className = 'onboard-age-card w-full border-2 border-yellow-500 bg-yellow-500/10 rounded-2xl p-3.5 text-left transition flex items-center justify-between shadow-sm';
            if (iconBox) iconBox.className = 'card-icon-box w-9 h-9 rounded-xl bg-yellow-500 text-blue-950 flex items-center justify-center text-xs font-black shadow transition';
            if (check) check.className = 'check-indicator w-6 h-6 rounded-full bg-yellow-500 border-2 border-yellow-500 flex items-center justify-center text-xs text-blue-950 shadow';
        } else {
            card.className = 'onboard-age-card w-full border-2 border-gray-200 hover:border-yellow-500 bg-white rounded-2xl p-3.5 text-left transition flex items-center justify-between group';
            if (iconBox) iconBox.className = 'card-icon-box w-9 h-9 rounded-xl bg-blue-50 text-blue-950 group-hover:bg-yellow-500 group-hover:text-blue-950 flex items-center justify-center text-xs font-black transition';
            if (check) check.className = 'check-indicator w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs text-transparent';
        }
    });
}

// STEP 2 — STATE HANDLERS
function filterOnboardingStates(query) {
    onboardingStateFilter = (query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('btnClearStateSearch');
    if (clearBtn) {
        if (onboardingStateFilter.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
    renderOnboardingStatesList();
}

function clearOnboardingStateSearch() {
    const input = document.getElementById('onboardingStateSearchInput');
    if (input) input.value = '';
    filterOnboardingStates('');
}

function selectOnboardingState(state) {
    if (onboardingPreferences.state !== state) {
        // Reset district if state changed
        onboardingPreferences.district = '';
    }
    onboardingPreferences.state = state;
    renderOnboardingStatesList();
    updateNextButtonState(true);
}

function renderOnboardingStatesList() {
    const container = document.getElementById('onboardingStatesList');
    if (!container || typeof INDIA_STATES_AND_DISTRICTS !== 'object') return;

    container.innerHTML = '';
    const allStates = Object.keys(INDIA_STATES_AND_DISTRICTS).sort();
    const filtered = onboardingStateFilter
        ? allStates.filter(st => st.toLowerCase().includes(onboardingStateFilter))
        : allStates;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-gray-400">
                <i class="fas fa-search text-xl mb-1 text-gray-300"></i>
                <p class="text-xs font-bold">No states match "${escapeHtml(onboardingStateFilter)}"</p>
            </div>
        `;
        return;
    }

    filtered.forEach(state => {
        const isSelected = onboardingPreferences.state === state;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.onclick = () => selectOnboardingState(state);
        btn.className = isSelected
            ? 'w-full p-3 rounded-xl border-2 border-yellow-500 bg-yellow-500/15 text-blue-950 flex items-center justify-between text-left transition shadow-sm'
            : 'w-full p-3 rounded-xl border border-gray-200 bg-white hover:border-yellow-500 text-gray-800 flex items-center justify-between text-left transition';

        btn.innerHTML = `
            <div class="flex items-center gap-2.5">
                <i class="fas fa-map-marker-alt ${isSelected ? 'text-yellow-600' : 'text-gray-400'} text-xs"></i>
                <span class="text-xs font-black">${escapeHtml(state)}</span>
            </div>
            <div class="w-5 h-5 rounded-full ${isSelected ? 'bg-yellow-500 text-blue-950' : 'border border-gray-300 text-transparent'} flex items-center justify-center text-[10px]">
                <i class="fas fa-check"></i>
            </div>
        `;
        container.appendChild(btn);
    });
}

// STEP 3 — DISTRICT HANDLERS
function filterOnboardingDistricts(query) {
    onboardingDistrictFilter = (query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('btnClearDistrictSearch');
    if (clearBtn) {
        if (onboardingDistrictFilter.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
    renderOnboardingDistrictsList();
}

function clearOnboardingDistrictSearch() {
    const input = document.getElementById('onboardingDistrictSearchInput');
    if (input) input.value = '';
    filterOnboardingDistricts('');
}

function selectOnboardingDistrict(district) {
    onboardingPreferences.district = district;
    renderOnboardingDistrictsList();
    updateNextButtonState(true);
}

function renderOnboardingDistrictsList() {
    const container = document.getElementById('onboardingDistrictsList');
    if (!container) return;
    container.innerHTML = '';

    const selectedState = onboardingPreferences.state;
    const districts = (selectedState && typeof INDIA_STATES_AND_DISTRICTS === 'object' && Array.isArray(INDIA_STATES_AND_DISTRICTS[selectedState]))
        ? INDIA_STATES_AND_DISTRICTS[selectedState]
        : [];

    if (!selectedState || districts.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-gray-400">
                <i class="fas fa-arrow-left text-xl mb-1 text-yellow-500"></i>
                <p class="text-xs font-bold">Please go back and select a state first.</p>
            </div>
        `;
        return;
    }

    const filtered = onboardingDistrictFilter
        ? districts.filter(d => d.toLowerCase().includes(onboardingDistrictFilter))
        : districts;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center text-gray-400">
                <i class="fas fa-search text-xl mb-1 text-gray-300"></i>
                <p class="text-xs font-bold">No districts match "${escapeHtml(onboardingDistrictFilter)}"</p>
            </div>
        `;
        return;
    }

    filtered.forEach(district => {
        const isSelected = onboardingPreferences.district === district;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.onclick = () => selectOnboardingDistrict(district);
        btn.className = isSelected
            ? 'w-full p-3 rounded-xl border-2 border-yellow-500 bg-yellow-500/15 text-blue-950 flex items-center justify-between text-left transition shadow-sm'
            : 'w-full p-3 rounded-xl border border-gray-200 bg-white hover:border-yellow-500 text-gray-800 flex items-center justify-between text-left transition';

        btn.innerHTML = `
            <div class="flex items-center gap-2.5">
                <i class="fas fa-map-pin ${isSelected ? 'text-yellow-600' : 'text-gray-400'} text-xs"></i>
                <span class="text-xs font-black">${escapeHtml(district)}</span>
            </div>
            <div class="w-5 h-5 rounded-full ${isSelected ? 'bg-yellow-500 text-blue-950' : 'border border-gray-300 text-transparent'} flex items-center justify-center text-[10px]">
                <i class="fas fa-check"></i>
            </div>
        `;
        container.appendChild(btn);
    });
}

// STEP 4 — SPORTS HANDLERS
function toggleOnboardingSport(sportId) {
    const idx = onboardingPreferences.sports.indexOf(sportId);
    if (idx >= 0) {
        onboardingPreferences.sports.splice(idx, 1);
    } else {
        if (onboardingPreferences.sports.length >= 5) {
            showInteractiveToast('Limit Reached', 'You can select up to 5 sports preferences.', 'warning');
            return;
        }
        onboardingPreferences.sports.push(sportId);
    }
    selectedOnboardingSports = onboardingPreferences.sports;
    renderOnboardingSportsGrid();
    const count = onboardingPreferences.sports.length;
    updateNextButtonState(count >= 1 && count <= 5);
}

function renderOnboardingSportsGrid() {
    const container = document.getElementById('onboardingSportsGrid');
    if (!container || typeof PROSPORTS_SUPPORTED_SPORTS === 'undefined') return;
    container.innerHTML = '';

    PROSPORTS_SUPPORTED_SPORTS.forEach(sport => {
        const isSelected = onboardingPreferences.sports.includes(sport.id);
        const card = document.createElement('button');
        card.type = 'button';
        card.setAttribute('data-sport-id', sport.id);
        card.onclick = () => toggleOnboardingSport(sport.id);
        card.className = isSelected
            ? 'onboard-sport-item border-2 border-yellow-500 bg-yellow-500/15 text-blue-950 rounded-2xl p-3 text-center transition flex flex-col items-center justify-center gap-1.5 shadow-sm'
            : 'onboard-sport-item border border-gray-200 bg-white hover:border-yellow-500 text-gray-700 rounded-2xl p-3 text-center transition flex flex-col items-center justify-center gap-1.5';

        card.innerHTML = `
            <div class="w-9 h-9 rounded-xl ${isSelected ? 'bg-yellow-500 text-blue-950 shadow' : 'bg-gray-50 ' + sport.color} flex items-center justify-center text-base transition">
                <i class="${sport.icon}"></i>
            </div>
            <div class="flex items-center gap-1">
                <span class="text-xs font-black uppercase tracking-tight">${escapeHtml(sport.name)}</span>
                ${isSelected ? '<i class="fas fa-check-circle text-yellow-600 text-[10px]"></i>' : ''}
            </div>
        `;
        container.appendChild(card);
    });

    const countEl = document.getElementById('onboardingSportsCount');
    if (countEl) {
        const count = onboardingPreferences.sports.length;
        countEl.textContent = `${count} of 5 selected`;
        if (count > 0) {
            countEl.className = 'text-[11px] font-black text-yellow-600 bg-yellow-500/15 px-2.5 py-0.5 rounded-full border border-yellow-500/30';
        } else {
            countEl.className = 'text-[11px] font-bold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200';
        }
    }
}

// FINISH PREFERENCES & PERSIST TO SUPABASE (Step 4 -> Step 5)
async function finishOnboardingPreferences() {
    const nextBtn = document.getElementById('btnOnboardingNext');
    const nextText = document.getElementById('btnOnboardingNextText');
    if (nextBtn) nextBtn.disabled = true;
    if (nextText) nextText.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> Saving...';

    const { ageCategory, state, district, sports } = onboardingPreferences;
    const user = getActiveUser();
    const userId = getEffectivePlayerId();
    const email = user ? user.email : '';
    const name = user ? user.name : 'ProSports Player';

    const record = {
        userId,
        email,
        name,
        ageCategory,
        state,
        district,
        sports,
        notificationsEnabled: true
    };

    // Save locally
    localStorage.setItem('prosports_player_preferences', JSON.stringify({
        user_id_number: userId,
        user_email: email,
        user_name: name,
        age_category: ageCategory,
        state,
        district,
        sports,
        notifications_enabled: true
    }));
    localStorage.setItem('prosports_preferences_completed', 'true');

    // Dual-write to backend & Supabase
    try {
        if (window.SupabaseService && typeof window.SupabaseService.savePlayerPreferences === 'function') {
            window.SupabaseService.savePlayerPreferences({
                user_id_number: userId,
                user_email: email,
                user_name: name,
                age_category: ageCategory,
                state,
                district,
                sports,
                notifications_enabled: true
            }).catch(e => console.warn(e));
        }

        fetch(`${API_BASE}/player/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        }).catch(e => console.warn(e));
    } catch (e) {}

    showInteractiveToast('Preferences Saved!', 'Now enable notifications to receive personalized match alerts.', 'success');

    // Advance to Step 5: Notification Permission Explanation Screen
    goToOnboardingStep(5);
}

// STEP 5 — NOTIFICATION PERMISSION HANDLERS
async function handleEnableNotificationsPermission() {
    const btn = document.getElementById('btnEnableNotifications');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Requesting Permission...';
    }

    let token = null;

    try {
        // 1. Request Capacitor Local Notifications permission
        if (window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('LocalNotifications')) {
            const perm = await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
            console.log('[NOTIFICATIONS] LocalNotifications perm:', perm);
        }

        // 2. Request Capacitor Push Notifications permission & register device
        if (window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('PushNotifications')) {
            const pushPerm = await window.Capacitor.Plugins.PushNotifications.requestPermissions();
            console.log('[NOTIFICATIONS] PushNotifications perm:', pushPerm);
            if (pushPerm && pushPerm.receive === 'granted') {
                await window.Capacitor.Plugins.PushNotifications.register();
            }
        }
    } catch (err) {
        console.warn('[NOTIFICATIONS] Permission request notice:', err);
    }

    // Generate persistent token if none provided by native bridge yet
    const userId = getEffectivePlayerId();
    token = 'fcm-' + userId + '-' + Date.now();

    // Register token with backend & Supabase
    try {
        fetch(`${API_BASE}/player/device-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, token, platform: 'android' })
        }).catch(e => {});

        const stored = getStoredPlayerPreferences();
        if (stored) {
            stored.notifications_enabled = true;
            stored.device_token = token;
            localStorage.setItem('prosports_player_preferences', JSON.stringify(stored));
        }
    } catch (e) {}

    showInteractiveToast('Notifications Enabled!', 'You will receive match alerts tailored to your age, sports & district.', 'success');
    closePlayerOnboardingModal();
    loadPlayerNotifications();
}

function handleMaybeLaterNotifications() {
    const stored = getStoredPlayerPreferences();
    if (stored) {
        stored.notifications_enabled = false;
        localStorage.setItem('prosports_player_preferences', JSON.stringify(stored));
    }
    showInteractiveToast('Preferences Saved', 'You can enable match notifications anytime from Settings or the bell icon.', 'info');
    closePlayerOnboardingModal();
}

// 4. Notification Center Screen
function openNotificationCenterModal() {
    const modal = document.getElementById('notificationCenterModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    loadPlayerNotifications();
}

function closeNotificationCenterModal() {
    const modal = document.getElementById('notificationCenterModal');
    if (modal) modal.classList.add('hidden');
}

async function loadPlayerNotifications() {
    const userId = getEffectivePlayerId();
    let notifications = [];

    // Try Supabase direct
    if (window.SupabaseService && typeof window.SupabaseService.getPlayerNotifications === 'function') {
        try {
            notifications = await window.SupabaseService.getPlayerNotifications(userId);
        } catch (e) {}
    }

    // Fall back to server if empty
    if (!Array.isArray(notifications) || notifications.length === 0) {
        try {
            const res = await fetch(`${API_BASE}/player/notifications?userId=${encodeURIComponent(userId)}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.notifications)) notifications = data.notifications;
            }
        } catch (e) {}
    }

    cachedNotifications = notifications;
    renderNotificationsList(notifications);
}

function renderNotificationsList(notifications) {
    const list = document.getElementById('notificationCenterList');
    const emptyNotice = document.getElementById('noNotificationsNotice');
    const unreadPill = document.getElementById('notifCenterUnreadPill');
    const subtitle = document.getElementById('notifCountSubtitle');

    if (!list) return;

    const unreadCount = notifications.filter(n => !n.is_read).length;
    updateNotificationBadges(unreadCount);

    if (unreadPill) {
        if (unreadCount > 0) {
            unreadPill.textContent = `${unreadCount} New`;
            unreadPill.classList.remove('hidden');
        } else {
            unreadPill.classList.add('hidden');
        }
    }

    if (subtitle) {
        subtitle.textContent = `${notifications.length} Alert${notifications.length === 1 ? '' : 's'}`;
    }

    if (notifications.length === 0) {
        list.innerHTML = '';
        if (emptyNotice) emptyNotice.classList.remove('hidden');
        return;
    }

    if (emptyNotice) emptyNotice.classList.add('hidden');
    list.innerHTML = '';

    notifications.forEach(n => {
        const item = document.createElement('div');
        const isUnread = !n.is_read;
        item.className = `p-4 rounded-2xl border transition-all cursor-pointer ${
            isUnread 
                ? 'bg-white border-yellow-500 shadow-md hover:border-blue-900' 
                : 'bg-white/80 border-gray-200 hover:border-gray-300'
        }`;
        item.onclick = () => handleNotificationCardClick(n.id, n.event_id);

        const sportIcon = getSportIconClass(n.sport);
        const timeAgo = formatTimeAgo(n.created_at);

        item.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-blue-950 text-yellow-400 flex items-center justify-center text-base flex-shrink-0 shadow-sm">
                    <i class="${sportIcon}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <span class="text-xs font-black uppercase tracking-tight text-blue-950 flex items-center gap-1.5">
                            ${n.title || '🏆 ProSports Match Alert'}
                            ${isUnread ? '<span class="w-2 h-2 rounded-full bg-yellow-500 inline-block animate-pulse"></span>' : ''}
                        </span>
                        <span class="text-[10px] text-gray-400 font-bold whitespace-nowrap">${timeAgo}</span>
                    </div>
                    <p class="text-xs text-gray-700 font-semibold leading-snug whitespace-pre-line mb-2">${n.message}</p>
                    <div class="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-blue-900 font-black">
                        <span class="flex items-center gap-1">
                            <i class="fas fa-map-marker-alt text-yellow-600"></i> ${n.location || 'Official Venue'}
                        </span>
                        <span class="text-yellow-600 hover:text-blue-950 flex items-center gap-1">
                            View Event <i class="fas fa-arrow-right text-[10px]"></i>
                        </span>
                    </div>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function updateNotificationBadges(unreadCount) {
    const mobileBadge = document.getElementById('mobileNotificationBadge');
    const menuBadge = document.getElementById('mobileMenuNotifBadge');

    if (mobileBadge) {
        if (unreadCount > 0) {
            mobileBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            mobileBadge.classList.remove('hidden');
        } else {
            mobileBadge.classList.add('hidden');
        }
    }
    if (menuBadge) {
        if (unreadCount > 0) {
            menuBadge.textContent = unreadCount;
            menuBadge.classList.remove('hidden');
        } else {
            menuBadge.classList.add('hidden');
        }
    }
}

async function handleNotificationCardClick(notifId, eventId) {
    const userId = getEffectivePlayerId();

    // Mark as read
    try {
        fetch(`${API_BASE}/player/notifications/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, notificationId: notifId })
        }).catch(e => {});

        if (window.SupabaseService && typeof window.SupabaseService.markNotificationRead === 'function') {
            window.SupabaseService.markNotificationRead(notifId, userId).catch(e => {});
        }

        const target = cachedNotifications.find(n => n.id === notifId);
        if (target) target.is_read = true;
        renderNotificationsList(cachedNotifications);
    } catch (e) {}

    closeNotificationCenterModal();

    // Deep link to Event Details Modal
    if (eventId) {
        openPublicEventDetails(eventId);
    }
}

async function markAllNotificationsAsRead() {
    const userId = getEffectivePlayerId();
    try {
        fetch(`${API_BASE}/player/notifications/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, markAll: true })
        }).catch(e => {});

        if (window.SupabaseService && typeof window.SupabaseService.markNotificationRead === 'function') {
            window.SupabaseService.markNotificationRead(null, userId, true).catch(e => {});
        }

        cachedNotifications.forEach(n => n.is_read = true);
        renderNotificationsList(cachedNotifications);
        showInteractiveToast('Notifications Updated', 'All match alerts marked as read.', 'success');
    } catch (e) {}
}

async function clearAllNotifications() {
    const userId = getEffectivePlayerId();
    try {
        fetch(`${API_BASE}/player/notifications`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, clearAll: true })
        }).catch(e => {});

        if (window.SupabaseService && typeof window.SupabaseService.clearPlayerNotifications === 'function') {
            window.SupabaseService.clearPlayerNotifications(userId).catch(e => {});
        }

        cachedNotifications = [];
        renderNotificationsList([]);
        showInteractiveToast('Notifications Cleared', 'All match alert history cleared.', 'info');
    } catch (e) {}
}

// 5. Manage Preferences Modal
function openManagePreferencesModal() {
    const modal = document.getElementById('managePreferencesModal');
    if (!modal) return;

    // Populate State dropdown
    const stateSelect = document.getElementById('manageState');
    if (stateSelect && typeof INDIA_STATES_AND_DISTRICTS === 'object') {
        stateSelect.innerHTML = '<option value="">-- Select State --</option>';
        Object.keys(INDIA_STATES_AND_DISTRICTS).sort().forEach(st => {
            const opt = document.createElement('option');
            opt.value = st;
            opt.textContent = st;
            stateSelect.appendChild(opt);
        });
    }

    // Load current preferences
    const prefs = getStoredPlayerPreferences() || {};
    const notifyToggle = document.getElementById('manageNotifyToggle');
    if (notifyToggle) notifyToggle.checked = prefs.notifications_enabled !== false;

    if (prefs.age_category) {
        selectManageAge(prefs.age_category);
    } else {
        selectManageAge('Under 18');
    }

    if (prefs.state && stateSelect) {
        stateSelect.value = prefs.state;
        handleManageStateChange(prefs.state);
        if (prefs.district) {
            const distSelect = document.getElementById('manageDistrict');
            if (distSelect) distSelect.value = prefs.district;
        }
    }

    selectedManageSports = Array.isArray(prefs.sports) ? [...prefs.sports] : ['Cricket', 'Football'];
    renderManageSportsList();

    modal.classList.remove('hidden');
}

function closeManagePreferencesModal() {
    const modal = document.getElementById('managePreferencesModal');
    if (modal) modal.classList.add('hidden');
}

function selectManageAge(age) {
    const hiddenAge = document.getElementById('manageSelectedAge');
    if (hiddenAge) hiddenAge.value = age;
    document.querySelectorAll('#manageAgeGroup .manage-age-btn').forEach(btn => {
        if (btn.getAttribute('data-manage-age') === age) {
            btn.className = 'manage-age-btn border-2 border-yellow-500 bg-yellow-500/15 rounded-xl p-2.5 text-left transition shadow-sm';
        } else {
            btn.className = 'manage-age-btn border-2 border-gray-200 rounded-xl p-2.5 text-left transition';
        }
    });
}

function handleManageStateChange(stateVal) {
    const distSelect = document.getElementById('manageDistrict');
    if (!distSelect) return;
    distSelect.innerHTML = '<option value="">-- Select District --</option>';
    if (!stateVal || typeof INDIA_STATES_AND_DISTRICTS !== 'object' || !INDIA_STATES_AND_DISTRICTS[stateVal]) return;
    INDIA_STATES_AND_DISTRICTS[stateVal].forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        distSelect.appendChild(opt);
    });
}

function renderManageSportsList() {
    const container = document.getElementById('manageSportsList');
    if (!container || typeof PROSPORTS_SUPPORTED_SPORTS === 'undefined') return;
    container.innerHTML = '';
    PROSPORTS_SUPPORTED_SPORTS.forEach(sport => {
        const isSelected = selectedManageSports.includes(sport.id);
        const card = document.createElement('button');
        card.type = 'button';
        card.setAttribute('data-manage-sport', sport.id);
        card.onclick = () => toggleManageSport(sport.id);
        card.className = isSelected
            ? 'manage-sport-item border-2 border-yellow-500 bg-yellow-500/15 text-blue-950 rounded-xl p-2.5 text-center transition flex flex-col items-center justify-center gap-1 shadow-sm'
            : 'manage-sport-item border border-gray-200 bg-gray-50 hover:border-yellow-500 text-gray-700 rounded-xl p-2.5 text-center transition flex flex-col items-center justify-center gap-1';

        card.innerHTML = `
            <i class="${sport.icon} ${sport.color} text-base"></i>
            <span class="text-[11px] font-black uppercase tracking-tight">${sport.name}</span>
        `;
        container.appendChild(card);
    });
    updateManageSportsCountUI();
}

function toggleManageSport(sportId) {
    const idx = selectedManageSports.indexOf(sportId);
    if (idx >= 0) {
        selectedManageSports.splice(idx, 1);
    } else {
        if (selectedManageSports.length >= 5) {
            showInteractiveToast('Maximum 5 Sports', 'You can select up to 5 sports.', 'warning');
            return;
        }
        selectedManageSports.push(sportId);
    }
    document.querySelectorAll('#manageSportsList .manage-sport-item').forEach(card => {
        const id = card.getAttribute('data-manage-sport');
        if (selectedManageSports.includes(id)) {
            card.className = 'manage-sport-item border-2 border-yellow-500 bg-yellow-500/15 text-blue-950 rounded-xl p-2.5 text-center transition flex flex-col items-center justify-center gap-1 shadow-sm';
        } else {
            card.className = 'manage-sport-item border border-gray-200 bg-gray-50 hover:border-yellow-500 text-gray-700 rounded-xl p-2.5 text-center transition flex flex-col items-center justify-center gap-1';
        }
    });
    updateManageSportsCountUI();
}

function updateManageSportsCountUI() {
    const el = document.getElementById('manageSportsCount');
    if (el) el.textContent = `${selectedManageSports.length}/5 sports selected`;
}

async function handleUpdatePlayerPreferences() {
    const ageCategory = document.getElementById('manageSelectedAge').value.trim();
    const state = document.getElementById('manageState').value.trim();
    const district = document.getElementById('manageDistrict').value.trim();
    const notifyEnabled = document.getElementById('manageNotifyToggle').checked;
    const errBox = document.getElementById('manageErrorNotice');
    const errMsg = document.getElementById('manageErrorMsg');

    if (errBox) errBox.classList.add('hidden');

    if (!ageCategory || !state || !district) {
        if (errBox && errMsg) {
            errMsg.textContent = 'Please choose Age Category, State, and District.';
            errBox.classList.remove('hidden');
        }
        return;
    }
    if (selectedManageSports.length === 0) {
        if (errBox && errMsg) {
            errMsg.textContent = 'Please select at least 1 sport preference.';
            errBox.classList.remove('hidden');
        }
        return;
    }

    const userId = getEffectivePlayerId();
    const user = getActiveUser();

    const record = {
        userId,
        email: user ? user.email : '',
        name: user ? user.name : 'Player',
        ageCategory,
        state,
        district,
        sports: selectedManageSports,
        notificationsEnabled: notifyEnabled
    };

    localStorage.setItem('prosports_player_preferences', JSON.stringify({
        user_id_number: userId,
        user_email: user ? user.email : '',
        user_name: user ? user.name : 'Player',
        age_category: ageCategory,
        state,
        district,
        sports: selectedManageSports,
        notifications_enabled: notifyEnabled
    }));

    try {
        fetch(`${API_BASE}/player/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        }).catch(e => {});

        if (window.SupabaseService && typeof window.SupabaseService.savePlayerPreferences === 'function') {
            window.SupabaseService.savePlayerPreferences({
                user_id_number: userId,
                user_email: user ? user.email : '',
                user_name: user ? user.name : 'Player',
                age_category: ageCategory,
                state,
                district,
                sports: selectedManageSports,
                notifications_enabled: notifyEnabled
            }).catch(e => {});
        }
    } catch (e) {}

    showInteractiveToast('Preferences Updated!', 'Future match notifications will target your updated criteria.', 'success');
    closeManagePreferencesModal();
}

// 6. Deep Linking & Notification Action Listeners
function setupNotificationListeners() {
    if (typeof window.Capacitor === 'undefined' || !window.Capacitor.isPluginAvailable) return;

    // Local notifications tap
    if (window.Capacitor.isPluginAvailable('LocalNotifications')) {
        try {
            window.Capacitor.Plugins.LocalNotifications.addListener('localNotificationActionPerformed', action => {
                console.log('[NOTIFICATIONS ACTION] Local notification tapped:', action);
                const extra = (action && action.notification && action.notification.extra) || {};
                const eventId = extra.eventId || (action && action.notification && action.notification.data && action.notification.data.eventId);
                if (eventId) {
                    openPublicEventDetails(eventId);
                }
            });
        } catch (e) {}
    }

    // Push notifications tap
    if (window.Capacitor.isPluginAvailable('PushNotifications')) {
        try {
            window.Capacitor.Plugins.PushNotifications.addListener('pushNotificationActionPerformed', action => {
                console.log('[PUSH NOTIFICATION ACTION] Push notification tapped:', action);
                const eventId = action && action.notification && action.notification.data && action.notification.data.eventId;
                if (eventId) {
                    openPublicEventDetails(eventId);
                }
            });
        } catch (e) {}
    }
}

// 7. Official Event Creation State & District Helpers
function populateEventStateAndDistricts() {
    if (typeof INDIA_STATES_AND_DISTRICTS !== 'object') return;
    const stEl = document.getElementById('evState');
    if (!stEl || stEl.children.length > 2) return;
    stEl.innerHTML = '<option value="">-- Select State --</option>';
    Object.keys(INDIA_STATES_AND_DISTRICTS).sort().forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        stEl.appendChild(opt);
    });
}

function handleEventStateSelect(stateVal) {
    const distEl = document.getElementById('evDistrict');
    if (!distEl) return;
    distEl.innerHTML = '<option value="">-- Select District --</option>';
    if (!stateVal || typeof INDIA_STATES_AND_DISTRICTS !== 'object' || !INDIA_STATES_AND_DISTRICTS[stateVal]) return;
    INDIA_STATES_AND_DISTRICTS[stateVal].forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        distEl.appendChild(opt);
    });
}

// Helper: Sync preferences on login
function syncPreferencesOnLogin(user) {
    if (!user || !user.idNumber) return;
    const stored = getStoredPlayerPreferences();
    if (stored) {
        stored.user_id_number = user.idNumber;
        stored.user_email = user.email || stored.user_email;
        stored.user_name = user.name || stored.user_name;
        localStorage.setItem('prosports_player_preferences', JSON.stringify(stored));

        try {
            if (window.SupabaseService && typeof window.SupabaseService.savePlayerPreferences === 'function') {
                window.SupabaseService.savePlayerPreferences(stored).catch(e => {});
            }
            fetch(`${API_BASE}/player/preferences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.idNumber,
                    email: user.email,
                    name: user.name,
                    ageCategory: stored.age_category,
                    state: stored.state,
                    district: stored.district,
                    sports: stored.sports,
                    notificationsEnabled: stored.notifications_enabled !== false
                })
            }).catch(e => {});
        } catch (e) {}
    }
}

function getSportIconClass(sport) {
    const s = (sport || '').toLowerCase();
    if (s.includes('cricket')) return 'fas fa-baseball-ball';
    if (s.includes('football')) return 'fas fa-futbol';
    if (s.includes('basketball')) return 'fas fa-basketball-ball';
    if (s.includes('volleyball')) return 'fas fa-volleyball-ball';
    if (s.includes('running') || s.includes('track') || s.includes('athletics')) return 'fas fa-running';
    if (s.includes('kabaddi')) return 'fas fa-users';
    if (s.includes('badminton')) return 'fas fa-feather-alt';
    if (s.includes('hockey')) return 'fas fa-hockey-puck';
    if (s.includes('tennis')) return 'fas fa-table-tennis';
    return 'fas fa-trophy';
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return 'Recent';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

// Explicit window bindings for hybrid WebView & inline HTML onclick handlers
if (typeof window !== 'undefined') {
    window.returnToHome = returnToHome;
    window.scrollToPublicEvents = scrollToPublicEvents;
    window.openDirectLogin = openDirectLogin;
    window.openCurrentDashboard = openCurrentDashboard;
    window.openStatusCheckModal = openStatusCheckModal;
    window.handleLogout = handleLogout;
    window.openServerConfigModal = openServerConfigModal;
    window.closeServerConfigModal = closeServerConfigModal;
    window.setPresetServerUrl = setPresetServerUrl;
    window.resetServerUrlToDefault = resetServerUrlToDefault;
    window.testAndSaveServerUrl = testAndSaveServerUrl;
    window.toggleMobileMenu = toggleMobileMenu;
    window.handleHeroSportsClick = handleHeroSportsClick;
    window.filterPublicEventsBySport = filterPublicEventsBySport;
    window.showTournaments = showTournaments;
    window.backToSports = backToSports;
    window.switchOfficialTab = switchOfficialTab;
    window.addCustomFieldRow = addCustomFieldRow;
    window.openViewRegistrationsModal = openViewRegistrationsModal;
    window.closeOfficialRegistrationsModal = closeOfficialRegistrationsModal;
    window.filterRegistrationsByStatus = filterRegistrationsByStatus;
    window.exportCurrentEventCSV = exportCurrentEventCSV;
    window.openSingleAthleteDetailModal = openSingleAthleteDetailModal;
    window.closeSingleAthleteDetailModal = closeSingleAthleteDetailModal;
    window.openPublicEventDetails = openPublicEventDetails;
    window.closePublicEventDetailsModal = closePublicEventDetailsModal;
    window.handlePublicEventRegister = handlePublicEventRegister;
    window.handlePublicEventRegisterFromModal = handlePublicEventRegisterFromModal;
    window.closeAthleteEventRegisterModal = closeAthleteEventRegisterModal;
    window.showDetailsForm = showDetailsForm;
    window.quickLoginPreset = quickLoginPreset;
    window.setAuthMode = setAuthMode;
    window.submitLogin = submitLogin;
    window.submitRegistration = submitRegistration;
    window.submitAthleteEventRegistration = submitAthleteEventRegistration;
    window.resetModal = resetModal;
    window.hideModal = hideModal;
    window.checkLiveApprovalStatus = checkLiveApprovalStatus;
    window.closeAccessNoticeModal = closeAccessNoticeModal;
    window.updateAthleteRegistrationStatus = updateAthleteRegistrationStatus;
    window.loadPublicEvents = loadPublicEvents;

    window.handleHeroOfficialsClick = handleHeroOfficialsClick;

    // Notification and Preference bindings
    window.openPlayerOnboardingModal = openPlayerOnboardingModal;
    window.closePlayerOnboardingModal = closePlayerOnboardingModal;
    window.goToOnboardingStep = goToOnboardingStep;
    window.handleOnboardingNext = handleOnboardingNext;
    window.handleOnboardingBack = handleOnboardingBack;
    window.selectOnboardingAge = selectOnboardingAge;
    window.selectOnboardingState = selectOnboardingState;
    window.filterOnboardingStates = filterOnboardingStates;
    window.clearOnboardingStateSearch = clearOnboardingStateSearch;
    window.selectOnboardingDistrict = selectOnboardingDistrict;
    window.filterOnboardingDistricts = filterOnboardingDistricts;
    window.clearOnboardingDistrictSearch = clearOnboardingDistrictSearch;
    window.toggleOnboardingSport = toggleOnboardingSport;
    window.finishOnboardingPreferences = finishOnboardingPreferences;
    window.handleSavePlayerPreferences = finishOnboardingPreferences;
    window.handleEnableNotificationsPermission = handleEnableNotificationsPermission;
    window.handleMaybeLaterNotifications = handleMaybeLaterNotifications;
    window.openNotificationCenterModal = openNotificationCenterModal;
    window.closeNotificationCenterModal = closeNotificationCenterModal;
    window.loadPlayerNotifications = loadPlayerNotifications;
    window.handleNotificationCardClick = handleNotificationCardClick;
    window.markAllNotificationsAsRead = markAllNotificationsAsRead;
    window.clearAllNotifications = clearAllNotifications;
    window.openManagePreferencesModal = openManagePreferencesModal;
    window.closeManagePreferencesModal = closeManagePreferencesModal;
    window.selectManageAge = selectManageAge;
    window.handleManageStateChange = handleManageStateChange;
    window.toggleManageSport = toggleManageSport;
    window.handleUpdatePlayerPreferences = handleUpdatePlayerPreferences;
    window.populateEventStateAndDistricts = populateEventStateAndDistricts;
    window.handleEventStateSelect = handleEventStateSelect;
}
