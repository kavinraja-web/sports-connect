/**
 * SportsConnect - Universal Environment & API Configuration
 * Shared across Website, Android App, and iOS App
 */
const CONFIG = {
    APP_NAME: 'SportsConnect',
    APP_ID: 'com.sportsconnect.app',
    APP_VERSION: '1.0.0',

    // ====================================================================
    // BACKEND API ENDPOINTS
    // ====================================================================
    // 1. Production HTTPS Backend URL
    // Replace with your live hosted Express server (e.g., Render, Railway, AWS, Fly.io, or custom domain)
    PROD_API_URL: 'https://sportsconnect-api.yourdomain.com',

    // 2. Local Wi-Fi Development URL
    // Your computer's current Wi-Fi LAN IP address where Express server.js is listening
    DEV_LAN_API_URL: 'http://10.85.77.243:3000',

    // 3. Android Emulator Loopback URL
    EMULATOR_API_URL: 'http://10.0.2.2:3000',

    // 4. Localhost Fallback (Used when viewing via browser on the development PC)
    LOCAL_URL: 'http://localhost:3000',

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
