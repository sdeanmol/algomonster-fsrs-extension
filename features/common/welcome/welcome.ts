/**
 * @file features/common/welcome/welcome.ts
 * @description Controls the step-by-step interactive welcome onboarding workflow.
 * Manages steps pagination, initial theme configuration, and notification permission requests.
 */
class OnboardingWelcome {
    currentStep: number;
    totalSteps: number;

    constructor() {
        this.currentStep = 1;
        this.totalSteps = 3;
    }

    /**
     * Initializes components and runs default state checks.
     */
    init(): void {
        this.bindEvents();
        this.syncThemePreference();
        this.checkNotificationState();
    }

    /**
     * Registers control listeners for pagination, theme preferences, and permission prompts.
     */
    bindEvents(): void {
        const prevBtn = document.getElementById('welcome-prev-btn');
        const nextBtn = document.getElementById('welcome-next-btn');

        prevBtn?.addEventListener('click', () => {
            if (this.currentStep > 1) {
                this.goToStep(this.currentStep - 1);
            }
        });

        nextBtn?.addEventListener('click', () => {
            if (this.currentStep < this.totalSteps) {
                this.goToStep(this.currentStep + 1);
            } else {
                // Last step: Redirect to Help / Dashboard Instructions page
                window.location.href = '../help/help.html';
            }
        });

        const darkBtn = document.getElementById('set-dark-btn');
        const lightBtn = document.getElementById('set-light-btn');

        darkBtn?.addEventListener('click', () => {
            this.setThemePreference('dark');
        });

        lightBtn?.addEventListener('click', () => {
            this.setThemePreference('light');
        });

        const enableBtn = document.getElementById('welcome-enable-btn');
        enableBtn?.addEventListener('click', () => {
            if (typeof Notification !== 'undefined') {
                Notification.requestPermission().then((permission) => {
                    this.checkNotificationState();
                    if (permission === 'granted') {
                        this.showToast("Notification settings initialized successfully!");
                    } else {
                        this.showToast("Notifications were disabled.");
                    }
                });
            }
        });
    }

    /**
     * Fetches current theme selection and syncs button state.
     */
    syncThemePreference(): void {
        chrome.storage.local.get(['theme'], (result: { [key: string]: any }) => {
            const theme = result.theme || 'dark';
            this.setActiveThemeButton(theme);
        });
    }

    /**
     * Navigates visual onboarding cards to target step number.
     */
    goToStep(step: number): void {
        // Toggle active card
        document.getElementById(`step-${this.currentStep}`)?.classList.remove('active');
        document.getElementById(`step-${step}`)?.classList.add('active');

        // Toggle indicator dot
        document.getElementById(`dot-${this.currentStep}`)?.classList.remove('active');
        document.getElementById(`dot-${step}`)?.classList.add('active');

        this.currentStep = step;

        // Update navigation button labels and visibility
        const prevBtn = document.getElementById('welcome-prev-btn');
        const nextBtn = document.getElementById('welcome-next-btn');

        if (prevBtn) {
            if (this.currentStep === 1) {
                prevBtn.classList.add('invisible');
            } else {
                prevBtn.classList.remove('invisible');
            }
        }

        if (nextBtn) {
            if (this.currentStep === this.totalSteps) {
                nextBtn.textContent = 'Explore Guide';
            } else {
                nextBtn.textContent = 'Next';
            }
        }
    }

    /**
     * Renders UI toggle buttons as active/selected matching requested theme.
     */
    setActiveThemeButton(theme: string): void {
        const darkBtn = document.getElementById('set-dark-btn');
        const lightBtn = document.getElementById('set-light-btn');

        if (theme === 'light') {
            lightBtn?.classList.add('active');
            darkBtn?.classList.remove('active');
        } else {
            darkBtn?.classList.add('active');
            lightBtn?.classList.remove('active');
        }
    }

    /**
     * Persists theme configuration changes and updates UI buttons.
     */
    setThemePreference(theme: string): void {
        chrome.storage.local.set({ theme: theme }, () => {
            this.setActiveThemeButton(theme);
            this.showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode!`);
        });
    }

    /**
     * Checks system notification permissions and toggles onboarding badge indicators.
     */
    checkNotificationState(): void {
        const badge = document.getElementById('welcome-notif-status');
        const btn = document.getElementById('welcome-enable-btn');
        if (!badge || !btn) return;

        if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
                badge.textContent = 'Active';
                badge.className = 'status-badge success';
                btn.style.display = 'none';
            } else {
                badge.textContent = 'Disabled';
                badge.className = 'status-badge error';
                btn.style.display = 'flex';
            }
        }
    }

    /**
     * Displays status feedback messages in onboarding page container.
     */
    showToast(msg: string): void {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.className = 'toast show';
        setTimeout(() => {
            toast.className = 'toast';
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const welcome = new OnboardingWelcome();
    welcome.init();
});
