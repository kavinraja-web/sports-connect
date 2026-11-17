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

document.addEventListener('DOMContentLoaded', () => {
    refreshUI();

    // Check if currently stored user is pending or denied and restrict view
    const initialUser = getActiveUser();
    if (initialUser && (initialUser.status === 'pending' || initialUser.status === 'denied')) {
        document.getElementById('sportsDashboard').classList.add('hidden');
        document.getElementById('officialsDashboard').classList.add('hidden');
        document.getElementById('marathonDashboard').classList.add('hidden');
    }

    // Automatically load all public sports events on page launch (no login required)
    loadPublicEvents();

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
        const res = await fetch(`${API_BASE}/user-status?idNumber=${encodeURIComponent(user.idNumber)}`);
        if (res.ok) {
            const data = await res.json();
            user.status = data.status;
            localStorage.setItem('proSportsUser', JSON.stringify(user));
            refreshUI();

            if (user.status === 'approved') {
                showInteractiveAccessModal(user, 'approved');
                showInteractiveToast('Access Allowed!', `Your ${user.role} account was approved by the Admin! Unlocking dashboard...`, 'success');
                setTimeout(() => {
                    closeAccessNoticeModal();
                    routeUserDashboard(user);
                }, 1300);
            } else if (user.status === 'denied') {
                showInteractiveAccessModal(user, 'denied');
                showInteractiveToast('Account Denied', 'Your account registration was rejected by the League Administrator.', 'danger');
            } else {
                showInteractiveToast('Verification In Progress', 'Your account is still pending review. You can approve it from the Admin Portal.', 'warning');
            }
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
        const res = await fetch(`${API_BASE}/user-status?idNumber=${encodeURIComponent(user.idNumber)}`);
        if (res.ok) {
            const data = await res.json();
            user.status = data.status;
            localStorage.setItem('proSportsUser', JSON.stringify(user));
            refreshUI();
        }
    } catch (e) {
        console.warn("Server offline, using cached status");
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
    document.getElementById('sportsDashboard').classList.add('hidden');
    document.getElementById('officialsDashboard').classList.add('hidden');
    document.getElementById('marathonDashboard').classList.add('hidden');
    document.querySelector('header').classList.remove('hidden');
    const pubSec = document.getElementById('publicEventsSection');
    if (pubSec) pubSec.classList.remove('hidden');
    document.querySelector('#register').classList.remove('hidden');
    if (document.querySelector('footer')) document.querySelector('footer').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadPublicEvents();
}

// Scroll down smoothly to Public Sports Events Section
function scrollToPublicEvents() {
    returnToHome();
    const pubSec = document.getElementById('publicEventsSection');
    if (pubSec) {
        setTimeout(() => {
            pubSec.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

// Handler for Hero Sports button
function handleHeroSportsClick(e) {
    if (e) e.preventDefault();
    const user = getActiveUser();
    if (user) {
        verifyUserApprovalLive(user).then(isAllowed => {
            if (isAllowed) routeUserDashboard(user);
        });
    } else {
        scrollToPublicEvents();
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
            showInteractiveToast('Event Published!', `Tournament "${payload.name}" launched with ${customFields.length} custom fields!`, 'success');
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

        const res = await fetch(`${API_BASE}/events/${currentRegisteringEvent.id}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            showInteractiveToast('Registration Successful!', `You are successfully registered for "${currentRegisteringEvent.name}"!`, 'success');
            closeAthleteEventRegisterModal();

            // Refresh events across the UI
            loadPublicEvents();
            if (user.role === 'Official') loadOfficialHostedEvents();
        } else {
            if (errorBanner) {
                errorBanner.innerText = data.error || 'Registration failed. Please check your inputs.';
                errorBanner.classList.remove('hidden');
            }
            showInteractiveToast('Registration Error', data.error || 'Could not complete registration.', 'danger');
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
        const res = await fetch(`${API_BASE}/events`);
        if (res.ok) {
            const allEvents = await res.json();
            // Filter strictly for events hosted by this official
            const myEvents = (user && user.idNumber)
                ? allEvents.filter(e => (e.officialId || '').toLowerCase() === user.idNumber.toLowerCase() || (user.email && (e.officialEmail || '').toLowerCase() === user.email.toLowerCase()))
                : [];

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
        const res = await fetch(`${API_BASE}/events`);
        if (res.ok) {
            const allEvents = await res.json();
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
            const roster = await res.json();
            cachedActiveRoster = Array.isArray(roster) ? roster : [];
            currentManagedEvent.registrations = cachedActiveRoster;

            updateRosterCounts();
            renderRegistrationsTable(cachedActiveRoster);
        } else {
            tbody.innerHTML = '<tr><td colspan="11" class="py-12 text-center text-rose-500 font-bold">Failed to load roster.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="11" class="py-12 text-center text-rose-500 font-bold">Server connection error.</td></tr>';
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
        const res = await fetch(`${API_BASE}/events/${eventId}/registrations/${regId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, officialId: user.idNumber })
        });

        const data = await res.json();
        if (res.ok) {
            const reg = cachedActiveRoster.find(r => String(r.id) === String(regId));
            if (reg) reg.status = newStatus;
            updateRosterCounts();
            showInteractiveToast('Status Updated', `Registration status updated to ${newStatus}.`, 'success');
        } else {
            showInteractiveToast('Update Failed', data.error || 'Could not update status.', 'danger');
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
function openDirectLogin(role) {
    currentSelectedRole = role;
    showDetailsForm(role);
    document.getElementById('authModal').classList.remove('hidden');
}

function showDetailsForm(role) {
    currentSelectedRole = role;
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    document.getElementById('formTitle').innerText = `${role} Portal`;
    document.getElementById('modalSubTitle').innerText = `Portal: ${role}`;
}

function setAuthMode(mode) {
    const btnReg = document.getElementById('tabAuthRegister');
    const btnLog = document.getElementById('tabAuthLogin');
    const regGroup = document.getElementById('registerFieldsGroup');
    const logGroup = document.getElementById('loginFieldsGroup');

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
    setAuthMode('register');
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

    const payload = {
        name: nameEl ? nameEl.value.trim() : '',
        email: emailEl ? emailEl.value.trim() : '',
        idNumber: idEl ? idEl.value.trim() : '',
        role: currentSelectedRole,
        password: passEl ? passEl.value : ''
    };

    if (!payload.name || !payload.idNumber || !payload.email) {
        return showInteractiveToast('Missing Information', 'Please fill in all registration fields.', 'warning');
    }

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok) {
            const registeredUser = result.user || { ...payload, status: 'pending' };
            localStorage.setItem('proSportsUser', JSON.stringify(registeredUser));
            
            hideModal();
            refreshUI();

            showInteractiveAccessModal(registeredUser, 'pending');
            showInteractiveToast('Registration Submitted', 'Your account is currently awaiting Admin approval.', 'warning');
        } else {
            showInteractiveToast('Registration Blocked', result.error, 'danger');
        }
    } catch (err) { 
        showInteractiveToast('Server Offline', 'Backend server is not responding.', 'danger');
    }
}

// User Sign In Submit
async function submitLogin() {
    const idEl = document.getElementById('loginIdentifier');
    const passEl = document.getElementById('loginPassword');
    const identifier = idEl ? idEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    if (!identifier) return showInteractiveToast('Input Required', 'Please enter your Email or ID Number.', 'warning');

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, role: currentSelectedRole, password })
        });
        const data = await res.json();
        if (res.ok) {
            const user = data.user;
            localStorage.setItem('proSportsUser', JSON.stringify(user));
            hideModal();
            refreshUI();

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
        } else {
            showInteractiveToast('Login Failed', data.error || 'Account not found.', 'danger');
        }
    } catch (err) {
        showInteractiveToast('Connection Error', 'Backend server is offline.', 'danger');
    }
}

// Quick Login Preset
async function quickLoginPreset(email, role) {
    currentSelectedRole = role;
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: email, role })
        });
        const data = await res.json();
        if (res.ok) {
            const user = data.user;
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
    try {
        const res = await fetch(`${API_BASE}/tournaments`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                list = data;
            }
        }
    } catch (e) {
        console.warn("Using offline tournament cache");
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

    try {
        const res = await fetch(`${API_BASE}/marathons`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                marathonsData = data;
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

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`${targetUrl}/events`, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
            if (mDot) mDot.className = 'absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500';
            if (txt) txt.innerText = 'Server Online';
            return true;
        } else {
            throw new Error('Server returned non-200');
        }
    } catch (e) {
        if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-500';
        if (mDot) mDot.className = 'absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500';
        if (txt) txt.innerText = 'Server Offline';
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
            feedback.innerHTML = `<i class="fas fa-exclamation-triangle mr-1"></i> Cannot connect to <strong>${url}</strong>.<br><span class="text-[11px] font-normal">Ensure your PC running "node server.js" and phone are on the same Wi-Fi, or test using the PC Wi-Fi IP (http://10.85.77.243:3000).</span>`;
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
