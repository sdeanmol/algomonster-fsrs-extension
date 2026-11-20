/**
 * @file Interactive First-Run Onboarding Welcome Walkthrough
 * @module features/common/welcome/welcome
 * @context Extension Welcome Page (features/common/welcome/welcome.html)
 * @description Controls the step-by-step interactive welcome onboarding workflow.
 * Manages steps pagination, initial theme configuration, and notification permission requests.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';
import { CatchAndLog, withErrorHandling } from '../../../decorators';
import { BROWSER_CONFIG } from '@common/browserConfig';

/**
 * Controller class driving multi-step onboarding wizard screens.
 */
export class OnboardingWelcome {
    /** Active wizard step index (1-based) */
    currentStep: number;
    /** Total number of wizard steps */
    totalSteps: number;

    /**
     * Initializes step tracker starting at Step 1 of 4.
     */
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
    }

    /**
     * Initializes components and runs default state checks.
     */
    @CatchAndLog('Onboarding', 'Error initializing OnboardingWelcome')
    init(): void {
        this.bindEvents();
        this.syncThemePreference();
        this.checkNotificationState();
        this.renderBrowserSpecificInstructions();
    }

    /**
     * Renders browser-appropriate extension pinning and toolbar instructions.
     */
    @CatchAndLog('Onboarding', 'Error rendering browser-specific pin instructions')
    renderBrowserSpecificInstructions(): void {
        const pinInstructionsEl = document.getElementById('welcome-pin-instructions');
        if (!pinInstructionsEl) return;

        if (BROWSER_CONFIG.target === 'safari') {
            pinInstructionsEl.innerHTML = `<strong>1. Open Safari Settings ⚙️ &rarr; Extensions</strong> and ensure AlgoRecall is turned on.<br><strong>2. Check your Safari toolbar</strong> to access your review counter at any time.`;
        } else {
            pinInstructionsEl.innerHTML = `<strong>1. Click the puzzle icon 🧩</strong> in ${BROWSER_CONFIG.displayName}'s top right toolbar.<br><strong>2. Pin AlgoRecall 📌</strong> to keep your review counter always visible.`;
        }
    }

    /**
     * Registers control listeners for pagination, theme preferences, and permission prompts.
     */
    @CatchAndLog('Onboarding', 'Error binding event listeners')
    bindEvents(): void {
        const prevBtn = document.getElementById('welcome-prev-btn');
        const nextBtn = document.getElementById('welcome-next-btn');

        prevBtn?.addEventListener('click', withErrorHandling(() => {
            if (this.currentStep > 1) {
                this.goToStep(this.currentStep - 1);
            }
        }, 'Onboarding', 'Error in prev button click handler'));

        nextBtn?.addEventListener('click', withErrorHandling(() => {
            if (this.currentStep < this.totalSteps) {
                this.goToStep(this.currentStep + 1);
            } else {
                // Last step: Redirect to Help / Dashboard Instructions page
                window.location.href = '../help/help.html';
            }
        }, 'Onboarding', 'Error in next button click handler'));

        const darkBtn = document.getElementById('set-dark-btn');
        const lightBtn = document.getElementById('set-light-btn');

        darkBtn?.addEventListener('click', withErrorHandling(() => {
            this.setThemePreference('dark');
        }, 'Onboarding', 'Error in dark theme button click handler'));

        lightBtn?.addEventListener('click', withErrorHandling(() => {
            this.setThemePreference('light');
        }, 'Onboarding', 'Error in light theme button click handler'));

        const skipBtn = document.getElementById('welcome-skip-btn');
        skipBtn?.addEventListener('click', withErrorHandling(() => {
            window.close();
        }, 'Onboarding', 'Error skipping onboarding tour'));

        const enableBtn = document.getElementById('welcome-enable-btn');
        enableBtn?.addEventListener('click', withErrorHandling(() => {
            if (typeof Notification !== 'undefined') {
                Notification.requestPermission().then((permission) => {
                    this.checkNotificationState();
                    if (permission === 'granted') {
                        UIUtils.showToast("Notification permissions granted!");
                    } else {
                        UIUtils.showToast("Notifications were disabled at the OS level.");
                    }
                }).catch((err) => {
                    UIUtils.catchError('Onboarding', 'Notification permission request error', err);
                });
            }
        }, 'Onboarding', 'Error calling requestPermission'));

        const notifToggle = document.getElementById('welcome-notif-toggle') as HTMLInputElement;
        notifToggle?.addEventListener('change', withErrorHandling((e) => {
            const target = e.target as HTMLInputElement;
            chrome.storage.local.get(['notificationSettings'], withErrorHandling((result) => {
                if (UIUtils.checkStorageError('Onboarding', 'Storage error fetching notificationSettings')) return;
                const settings = result.notificationSettings || { enabled: true };
                settings.enabled = target.checked;
                chrome.storage.local.set({ notificationSettings: settings }, withErrorHandling(() => {
                    if (UIUtils.checkStorageError('Onboarding', 'Storage error saving notificationSettings')) return;
                    UIUtils.showToast(target.checked ? "Reminders Enabled" : "Reminders Disabled");
                }, 'Onboarding', 'Storage error saving notificationSettings'));
            }, 'Onboarding', 'Storage error fetching notificationSettings'));
        }, 'Onboarding', 'Error toggling notifications'));
    }

    /**
     * Fetches current theme selection and syncs button state.
     * @fires chrome.storage.local.get
     */
    @CatchAndLog('Onboarding', 'Failed to sync theme preference')
    syncThemePreference(): void {
        chrome.storage.local.get(['theme'], withErrorHandling((result: { theme?: string }) => {
            if (UIUtils.checkStorageError('Onboarding', 'Storage error fetching theme')) return;
            const theme = result.theme || 'dark';
            this.setActiveThemeButton(theme);
        }, 'Onboarding', 'Error processing storage theme result'));
    }

    /**
     * Navigates visual onboarding cards to target step number.
     * @param step - Target step number (1 to 4).
     */
    @CatchAndLog('Onboarding', 'Error navigating to step')
    goToStep(step: number): void {
        // Toggle active card
        document.getElementById(`step-${this.currentStep}`)?.classList.remove('active');
        document.getElementById(`step-${step}`)?.classList.add('active');

        // Toggle indicator dot
        const oldDot = document.getElementById(`dot-${this.currentStep}`);
        if (oldDot) {
            oldDot.classList.remove('active');
            oldDot.removeAttribute('aria-current');
        }
        const newDot = document.getElementById(`dot-${step}`);
        if (newDot) {
            newDot.classList.add('active');
            newDot.setAttribute('aria-current', 'step');
        }

        this.currentStep = step;

        // Update navigation button labels and visibility
        const prevBtn = document.getElementById('welcome-prev-btn');
        const nextBtn = document.getElementById('welcome-next-btn');

        if (prevBtn) {
            if (this.currentStep === 1) {
                prevBtn.classList.add('invisible');
                prevBtn.setAttribute('disabled', 'true');
                prevBtn.setAttribute('aria-hidden', 'true');
            } else {
                prevBtn.classList.remove('invisible');
                prevBtn.removeAttribute('disabled');
                prevBtn.removeAttribute('aria-hidden');
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
     * @param theme - Theme identifier string ('dark' | 'light').
     */
    @CatchAndLog('Onboarding', 'Error setting active theme button')
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
     * @param theme - Theme identifier string ('dark' | 'light').
     * @fires chrome.storage.local.set
     */
    @CatchAndLog('Onboarding', 'Error persisting theme preference')
    setThemePreference(theme: string): void {
        chrome.storage.local.set({ theme: theme }, withErrorHandling(() => {
            if (UIUtils.checkStorageError('Onboarding', 'Storage set error saving theme', { theme })) return;
            this.setActiveThemeButton(theme);
            UIUtils.showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode!`);
        }, 'Onboarding', 'Error in storage set callback for theme'));
    }

    /**
     * Checks system notification permissions and toggles onboarding badge indicators.
     * @fires chrome.storage.local.get
     */
    @CatchAndLog('Onboarding', 'Error checking notification state')
    checkNotificationState(): void {
        const badge = document.getElementById('welcome-notif-status');
        const btn = document.getElementById('welcome-enable-btn');
        const toggle = document.getElementById('welcome-notif-toggle') as HTMLInputElement;

        chrome.storage.local.get(['notificationSettings'], withErrorHandling((result) => {
            if (UIUtils.checkStorageError('Onboarding', 'Storage error fetching notificationSettings in checkNotificationState')) return;
            if (toggle) {
                toggle.checked = result.notificationSettings ? result.notificationSettings.enabled !== false : true;
            }
        }, 'Onboarding', 'Error fetching notificationSettings'));

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
}

function initWelcome(): void {
    withErrorHandling(() => {
        const welcome = new OnboardingWelcome();
        welcome.init();
    }, 'Onboarding', 'Initialization failed')();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWelcome);
    } else {
        initWelcome();
    }
}
