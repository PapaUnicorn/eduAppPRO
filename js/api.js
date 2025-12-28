/**
 * EduNexus PRO API Handler
 * localized for robust connection handling
 */

const API_CONFIG = {
    BASE_URL: "https://script.google.com/macros/s/AKfycbwZ4yAU4aXx3vSMLUzJTYCJ1ufHBlqu3ZnHhj6heCYcJsBMA5aHGCIXIgZKdlFcGLmCmw/exec",
    TIMEOUT_MS: 10000,
    MAX_RETRIES: 3
};

class EduAPI {
    /**
     * Generic Fetch with Retry and Timeout
     */
    static async request(params = {}, retryCount = 0) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${API_CONFIG.BASE_URL}?${queryString}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: "GET",
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const data = await response.json();
            return data;

        } catch (error) {
            clearTimeout(timeoutId);
            console.warn(`API Attempt ${retryCount + 1} failed:`, error);

            if (retryCount < API_CONFIG.MAX_RETRIES) {
                // Exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(r => setTimeout(r, delay));

                // Optional: Notify user of retry if UI helper exists
                if (window.showToast) window.showToast(`Koneksi lambat, mencoba lagi... (${retryCount + 1})`, 'default');

                return this.request(params, retryCount + 1);
            }

            // Fallback for Demo/Test if completely unreachable
            if (params.email === 'demouser@edunexus.id') {
                console.info("Using Demo Fallback");
                return {
                    status: 'found',
                    name: 'Demo User',
                    plan: 'Gold',
                    email: params.email,
                    app: 'eduLessonPRO' // Ensure app is present
                };
            }

            throw error;
        }
    }

    /**
     * Login Method
     */
    static async login(email, wa) {
        return this.request({ email, wa });
    }

    /**
     * Get Current User Logic
     */
    static async getProfile() {
        const email = localStorage.getItem('edunexus_email');
        const wa = localStorage.getItem('edunexus_wa');
        if (!email || !wa) return null;
        return this.request({ email, wa });
    }
}

// Global Toast Helper (can be used by any page)
window.showToast = function (message, type = 'default') {
    let toast = document.getElementById("api-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "api-toast";
        toast.style.cssText = `
            visibility: hidden; min-width: 250px; background-color: #333; color: #fff;
            text-align: center; border-radius: 12px; padding: 16px; position: fixed;
            z-index: 9999; left: 50%; bottom: 30px; transform: translateX(-50%);
            font-size: 14px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            opacity: 0; transition: opacity 0.3s, bottom 0.3s; font-family: sans-serif;
        `;
        document.body.appendChild(toast);
    }

    toast.innerText = message;
    if (type === 'error') toast.style.backgroundColor = '#EF4444';
    else if (type === 'success') toast.style.backgroundColor = '#10B981';
    else toast.style.backgroundColor = '#334155';

    toast.style.visibility = "visible";
    toast.style.opacity = "1";
    toast.style.bottom = "50px";

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.bottom = "30px";
        setTimeout(() => { toast.style.visibility = "hidden"; }, 300);
    }, 3000);
};
