/**
 * @file features/common/welcome/welcome.ts
 * @description Controls the step-by-step interactive welcome onboarding workflow.
 * Manages steps pagination, initial theme configuration, and notification permission requests.
 */

import { Logger } from '@common/logger';

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
        try {
            this.bindEvents();
            this.syncThemePreference();
            this.checkNotificationState();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Onboarding', `Error initializing OnboardingWelcome: ${errorMessage}`, { err });
            // Comment: Non-fatal onboarding setup catch
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
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Onboarding', `Error in prev button click handler: ${errorMessage}`, { err });
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
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Onboarding', `Error in next button click handler: ${errorMessage}`, { err });
                }
            });

            const darkBtn = document.getElementById('set-dark-btn');
            const lightBtn = document.getElementById('set-light-btn');

            darkBtn?.addEventListener('click', () => {
                try {
                    this.setThemePreference('dark');
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Onboarding', `Error in dark theme button click handler: ${errorMessage}`, { err });
                }
            });

            lightBtn?.addEventListener('click', () => {
                try {
                    this.setThemePreference('light');
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Onboarding', `Error in light theme button click handler: ${errorMessage}`, { err });
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
                                    this.showToast("Notification settings initialized successfully!");
                                } else {
                                    this.showToast("Notifications were disabled.");
                                }
                            } catch (permHandlerErr) {
                                const errorMessage = permHandlerErr instanceof Error ? permHandlerErr.message : String(permHandlerErr);
                                Logger.error('Onboarding', `Error in permission response handler: ${errorMessage}`, { permHandlerErr });
                            }
                        }).catch((err) => {
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            Logger.error('Onboarding', `Notification permission request error: ${errorMessage}`, { err });
                            // Comment: Catch rejected permission Promise gracefully
                        });
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Onboarding', `Error calling requestPermission: ${errorMessage}`, { err });
                        // Comment: Catch browser notification API exception gracefully
                    }
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Onboarding', `Error binding event listeners: ${errorMessage}`, { err });
            // Comment: Catch event listener setup error
        }
    }

    /**
     * Fetches current theme selection and syncs button state.
     */
    syncThemePreference(): void {
        try {
            chrome.storage.local.get(['theme'], (result: { theme?: string }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Onboarding', `Storage error fetching theme: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    const theme = result.theme || 'dark';
                    this.setActiveThemeButton(theme);
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('Onboarding', `Error processing storage theme result: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Onboarding', `Failed to sync theme preference: ${errorMessage}`, { err });
            // Comment: Non-fatal theme sync catch
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Onboarding', `Error navigating to step ${step}: ${errorMessage}`, { step, err });
            // Comment: Catch step navigation UI update error
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Onboarding', `Error setting active theme button for '${theme}': ${errorMessage}`, { theme, err });
        }
    }

    /**
     * Persists theme configuration changes and updates UI buttons.
     */
    setThemePreference(theme: string): void {
        try {
            chrome.storage.local.set({ theme: theme }, () => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Onboarding', `Storage set error saving theme: ${errorMessage}`, { theme, error: chrome.runtime.lastError });
                        return;
                    }
                    this.setActiveThemeButton(theme);
                    this.showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                } catch (setErr) {
                    const errorMessage = setErr instanceof Error ? setErr.message : String(setErr);
                    Logger.error('Onboarding', `Error in storage set callback for theme: ${errorMessage}`, { theme, setErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Onboarding', `Error persisting theme preference '${theme}': ${errorMessage}`, { theme, err });
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Onboarding', `Error checking notification state: ${errorMessage}`, { err });
            // Comment: Non-fatal notification state check catch
        }
    }

    /**
     * Displays status feedback messages in onboarding page container.
     */
    showToast(msg: string): void {
        try {
            const toast = document.getElementById('status-toast');
            if (!toast) return;
            toast.textContent = msg;
            toast.className = 'toast show';
            setTimeout(() => {
                try {
                    toast.className = 'toast';
                } catch (animErr) {
                    const errorMessage = animErr instanceof Error ? animErr.message : String(animErr);
                    Logger.error('Onboarding', `Error hiding toast animation: ${errorMessage}`, { animErr });
                }
            }, 2000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Onboarding', `Error showing toast message '${msg}': ${errorMessage}`, { msg, err });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        const welcome = new OnboardingWelcome();
        welcome.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Onboarding', `Error instantiating OnboardingWelcome on DOMContentLoaded: ${errorMessage}`, { err });
    }
});
