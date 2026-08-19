/**
 * @file features/common/welcome/welcome.ts
 * @description Controls the step-by-step interactive welcome onboarding workflow.
 * Manages steps pagination, initial theme configuration, and notification permission requests.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';

export class OnboardingWelcome {
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
        try {
            this.bindEvents();
            this.syncThemePreference();
            this.checkNotificationState();
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Error initializing OnboardingWelcome', err);
        }
    }

    /**
     * Registers control listeners for pagination, theme preferences, and permission prompts.
     */
    bindEvents(): void {
        try {
            const prevBtn = document.getElementById('welcome-prev-btn');
            const nextBtn = document.getElementById('welcome-next-btn');

            prevBtn?.addEventListener('click', () => {
                try {
                    if (this.currentStep > 1) {
                        this.goToStep(this.currentStep - 1);
                    }
                } catch (err) {
                    UIUtils.catchError('Onboarding', 'Error in prev button click handler', err);
                }
            });

            nextBtn?.addEventListener('click', () => {
                try {
                    if (this.currentStep < this.totalSteps) {
                        this.goToStep(this.currentStep + 1);
                    } else {
                        // Last step: Redirect to Help / Dashboard Instructions page
                        window.location.href = '../help/help.html';
                    }
                } catch (err) {
                    UIUtils.catchError('Onboarding', 'Error in next button click handler', err);
                }
            });

            const darkBtn = document.getElementById('set-dark-btn');
            const lightBtn = document.getElementById('set-light-btn');

            darkBtn?.addEventListener('click', () => {
                try {
                    this.setThemePreference('dark');
                } catch (err) {
                    UIUtils.catchError('Onboarding', 'Error in dark theme button click handler', err);
                }
            });

            lightBtn?.addEventListener('click', () => {
                try {
                    this.setThemePreference('light');
                } catch (err) {
                    UIUtils.catchError('Onboarding', 'Error in light theme button click handler', err);
                }
            });

            const enableBtn = document.getElementById('welcome-enable-btn');
            enableBtn?.addEventListener('click', () => {
                if (typeof Notification !== 'undefined') {
                    try {
                        Notification.requestPermission().then((permission) => {
                            try {
                                this.checkNotificationState();
                                if (permission === 'granted') {
                                    UIUtils.showToast("Notification settings initialized successfully!");
                                } else {
                                    UIUtils.showToast("Notifications were disabled.");
                                }
                            } catch (permHandlerErr) {
                                UIUtils.catchError('Onboarding', 'Error in permission response handler', permHandlerErr);
                            }
                        }).catch((err) => {
                            UIUtils.catchError('Onboarding', 'Notification permission request error', err);
                        });
                    } catch (err) {
                        UIUtils.catchError('Onboarding', 'Error calling requestPermission', err);
                    }
                }
            });
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Error binding event listeners', err);
        }
    }

    /**
     * Fetches current theme selection and syncs button state.
     */
    syncThemePreference(): void {
        try {
            chrome.storage.local.get(['theme'], (result: { theme?: string }) => {
                try {
                    if (UIUtils.checkStorageError('Onboarding', 'Storage error fetching theme')) return;
                    const theme = result.theme || 'dark';
                    this.setActiveThemeButton(theme);
                } catch (innerErr) {
                    UIUtils.catchError('Onboarding', 'Error processing storage theme result', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Failed to sync theme preference', err);
        }
    }

    /**
     * Navigates visual onboarding cards to target step number.
     */
    goToStep(step: number): void {
        try {
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
        } catch (err) {
            UIUtils.catchError('Onboarding', `Error navigating to step ${step}`, err, { step });
        }
    }

    /**
     * Renders UI toggle buttons as active/selected matching requested theme.
     */
    setActiveThemeButton(theme: string): void {
        try {
            const darkBtn = document.getElementById('set-dark-btn');
            const lightBtn = document.getElementById('set-light-btn');

            if (theme === 'light') {
                lightBtn?.classList.add('active');
                darkBtn?.classList.remove('active');
            } else {
                darkBtn?.classList.add('active');
                lightBtn?.classList.remove('active');
            }
        } catch (err) {
            UIUtils.catchError('Onboarding', `Error setting active theme button for '${theme}'`, err, { theme });
        }
    }

    /**
     * Persists theme configuration changes and updates UI buttons.
     */
    setThemePreference(theme: string): void {
        try {
            chrome.storage.local.set({ theme: theme }, () => {
                try {
                    if (UIUtils.checkStorageError('Onboarding', 'Storage set error saving theme', { theme })) return;
                    this.setActiveThemeButton(theme);
                    UIUtils.showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                } catch (setErr) {
                    UIUtils.catchError('Onboarding', 'Error in storage set callback for theme', setErr, { theme });
                }
            });
        } catch (err) {
            UIUtils.catchError('Onboarding', `Error persisting theme preference '${theme}'`, err, { theme });
        }
    }

    /**
     * Checks system notification permissions and toggles onboarding badge indicators.
     */
    checkNotificationState(): void {
        try {
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
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Error checking notification state', err);
        }
    }
}

function initWelcome(): void {
    try {
        const welcome = new OnboardingWelcome();
        welcome.init();
    } catch (err) {
        UIUtils.catchError('Onboarding', 'Initialization failed', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWelcome);
    } else {
        initWelcome();
    }
}
