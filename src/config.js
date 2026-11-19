/**
 * SportsConnect - Universal Environment & API Configuration
 * Shared across Website, Android App, and iOS App
 */
const CONFIG = {
    APP_NAME: 'SportsConnect',
    APP_ID: 'com.sportsconnect.app',
    APP_VERSION: '1.0.0',

    // ====================================================================
    // SUPABASE CLOUD BACKEND (DIRECT MOBILE ACCESS - ZERO WI-FI REQUIRED)
    // ====================================================================
    USE_DIRECT_SUPABASE: true,
    SUPABASE_URL: 'https://aykhkbaawwiknqxyrkta.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_FtfOjpEkChqBpg7Phsuv7A_AeqoIe8g',

    // ====================================================================
    // BACKEND API ENDPOINTS (Fallback / Express Mode)
    // ====================================================================
    // 1. Production HTTPS Backend URL
    // Replace with your live hosted Express server (e.g., Render, Railway, AWS, Fly.io, or custom domain)
    PROD_API_URL: 'https://sportsconnect-api.yourdomain.com',

    // 2. Local Wi-Fi Development URL
    // Your computer's active Wi-Fi LAN IP address where Express server.js is listening
    DEV_LAN_API_URL: 'http://10.85.77.243:3000',

    // 3. Android Emulator Loopback URL (routes to host PC port 3000 from inside Android emulator)
    EMULATOR_API_URL: 'http://10.0.2.2:3000',

    // 4. Localhost Fallback (Used when viewing via browser on the development PC)
    LOCAL_URL: 'http://localhost:3000',

    // Candidate URLs for automatic probing across network interfaces
    CANDIDATE_URLS: [
        'http://10.85.77.243:3000',
        'http://10.63.225.244:3000',
        'http://10.0.2.2:3000',
        'http://10.10.12.0:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],

    // ====================================================================
    // PLATFORM & RUNTIME DETECTION
    // ====================================================================
    isNative() {
        return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
    },

    getPlatform() {
        if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function') {
            return window.Capacitor.getPlatform(); // 'android', 'ios', or 'web'
        }
        return 'web';
    },

    // ====================================================================
    // DYNAMIC API BASE RESOLVER
    // ====================================================================
    getApiBase() {
        // Priority 1: User-set manual override in localStorage (allows in-app configuration)
        try {
            const manualOverride = localStorage.getItem('sportsconnect_api_override');
            if (manualOverride && manualOverride.trim()) {
                return manualOverride.trim().replace(/\/+$/, '');
            }
        } catch (e) {}

        // Priority 2: Running inside Native Mobile Application (Android or iOS)
        if (this.isNative()) {
            if (this.DEV_LAN_API_URL && this.DEV_LAN_API_URL.trim()) {
                return this.DEV_LAN_API_URL.trim().replace(/\/+$/, '');
            }
            if (this.getPlatform() === 'android') {
                return this.EMULATOR_API_URL;
            }
            return this.LOCAL_URL;
        }

        // Priority 3: Running in a standard web browser hosted by Express or HTTPS website
        // e.g. http://localhost:3000 or https://sportsconnect.com
        if (window.location && window.location.protocol && window.location.protocol.startsWith('http') && window.location.hostname !== 'localhost') {
            return window.location.origin;
        }

        // Default local development fallback
        return this.LOCAL_URL;
    }
};

window.CONFIG = CONFIG;

// Initialize Global Supabase Client if SDK is loaded
const supabaseSdk = (typeof window !== 'undefined' && window.supabase) || (typeof supabase !== 'undefined' ? supabase : null);
if (supabaseSdk && typeof supabaseSdk.createClient === 'function') {
    try {
        window.supabaseClient = supabaseSdk.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        console.log('[Supabase Direct] Client initialized for:', CONFIG.SUPABASE_URL);
    } catch (e) {
        console.warn('[Supabase Direct] Failed to initialize client:', e);
    }
}
