/**
 * @file Interactive First-Run Onboarding Welcome Walkthrough (Preact)
 * @module features/common/welcome/welcome
 * @context Extension Welcome Page (features/common/welcome/welcome.html)
 * @description Controls the step-by-step interactive welcome onboarding workflow.
 * Manages steps pagination, initial theme configuration, and notification permission requests.
 */

import { h, render, JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';
import { BROWSER_CONFIG } from '@common/browserConfig';

export interface StepIndicatorProps {
    currentStep: number;
    totalSteps: number;
    onSelectStep?: (step: number) => void;
}

/**
 * Preact Component for rendering the wizard step indicator dots.
 */
export function StepIndicators({
    currentStep,
    totalSteps,
    onSelectStep
}: StepIndicatorProps): JSX.Element {
    const dots = [];
    for (let i = 1; i <= totalSteps; i++) {
        const isActive = i === currentStep;
        dots.push(
            <span
                key={i}
                id={`dot-${i}`}
                className={`step dot ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${i}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectStep && onSelectStep(i)}
            />
        );
    }
    return <div className="step-indicator step-dots-container" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>{dots}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface WelcomeAppProps {
    controller?: OnboardingWelcome;
}

export function WelcomeApp({ controller: initialController }: WelcomeAppProps): JSX.Element {
    const [controller] = useState(() => initialController || new OnboardingWelcome());
    const [currentStep, setCurrentStep] = useState<number>(controller.currentStep || 1);
    const [theme, setTheme] = useState<string>('dark');
    const [notifEnabled, setNotifEnabled] = useState<boolean>(true);
    const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default'>('default');

    useEffect(() => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['theme', 'notificationSettings'], (result: { theme?: string; notificationSettings?: { enabled?: boolean } }) => {
                    try {
                        if (result?.theme) setTheme(result.theme);
                        if (result?.notificationSettings && result.notificationSettings.enabled !== undefined) {
                            setNotifEnabled(result.notificationSettings.enabled);
                        }
                    } catch {}
                });
            }
        } catch {}

        if (typeof Notification !== 'undefined') {
            setNotifPermission(Notification.permission);
        }
    }, []);

    const handleStepChange = (step: number) => {
        controller.goToStep(step);
        setCurrentStep(step);
    };

    const handleThemeChange = (newTheme: string) => {
        controller.setThemePreference(newTheme);
        setTheme(newTheme);
    };

    const handleToggleNotification = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const checked = target.checked;
        setNotifEnabled(checked);
        chrome.storage.local.get(['notificationSettings'], (result) => {
            const settings = result.notificationSettings || { enabled: true };
            settings.enabled = checked;
            chrome.storage.local.set({ notificationSettings: settings }, () => {
                UIUtils.showToast(checked ? "Reminders Enabled" : "Reminders Disabled");
            });
        });
    };

    const handleRequestPermission = () => {
        if (typeof Notification !== 'undefined') {
            Notification.requestPermission().then((permission) => {
                setNotifPermission(permission);
                if (permission === 'granted') {
                    UIUtils.showToast("Notification permissions granted!");
                } else {
                    UIUtils.showToast("Notifications were disabled at the OS level.");
                }
            }).catch((err) => {
                UIUtils.catchError('Onboarding', 'Notification permission request error', err);
            });
        }
    };

    const handlePrev = () => {
        if (currentStep > 1) {
            handleStepChange(currentStep - 1);
        }
    };

    const handleNext = () => {
        if (currentStep < controller.totalSteps) {
            handleStepChange(currentStep + 1);
        } else {
            window.location.href = '../help/help.html';
        }
    };

    const handleSkip = () => {
        window.close();
    };

    const isSafari = BROWSER_CONFIG.target === 'safari';

    return (
        <div className="welcome-container">
            {/* Logo and Branding Header */}
            <div className="welcome-header">
                <svg className="svg-icon logo-glow" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                    <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                </svg>
                <h1>Welcome to <span className="algorecall-brand-name" style={{ fontSize: 'inherit' }}>AlgoRecall</span></h1>
                <p className="subtitle">Your FSRS spaced repetition and text highlighter is active!</p>
            </div>

            {/* Progress Indicators */}
            <StepIndicators
                currentStep={currentStep}
                totalSteps={controller.totalSteps}
                onSelectStep={handleStepChange}
            />

            {/* Step Content */}
            <div className="card-slider">
                {/* Step 1: Choose Your Theme */}
                <div className={`step-card ${currentStep === 1 ? 'active' : ''}`} id="step-1">
                    <h2>Step 1: Choose Your Theme</h2>
                    <p>Personalize your recall environment. Select your preferred look below:</p>
                    <div className="theme-picker">
                        <button
                            id="set-dark-btn"
                            className={`theme-opt-btn ${theme === 'dark' ? 'active' : ''}`}
                            onClick={() => handleThemeChange('dark')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                            Material Dark (Default)
                        </button>
                        <button
                            id="set-light-btn"
                            className={`theme-opt-btn ${theme === 'light' ? 'active' : ''}`}
                            onClick={() => handleThemeChange('light')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                            Material Light
                        </button>
                    </div>
                </div>

                {/* Step 2: How to Highlight & Rate */}
                <div className={`step-card ${currentStep === 2 ? 'active' : ''}`} id="step-2">
                    <h2>Step 2: How to Highlight & Rate</h2>
                    <div className="guide-list">
                        <div className="guide-item">
                            <div className="guide-number">1</div>
                            <div className="guide-text">
                                <strong>Highlight any text</strong> on supported pages (LeetCode, AlgoMonster, Codeforces, etc.) to mark key formulas or approaches.
                            </div>
                        </div>
                        <div className="guide-item">
                            <div className="guide-number">2</div>
                            <div className="guide-text">
                                <strong>Click the brain icon</strong> (you can drag it anywhere!) to open the rating slider.
                            </div>
                        </div>
                        <div className="guide-item">
                            <div className="guide-number">3</div>
                            <div className="guide-text">
                                <strong>Rate review difficulty</strong> (Again, Hard, Good, Easy) to let the FSRS algorithm calculate the next check interval.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 3: Setup Notifications */}
                <div className={`step-card ${currentStep === 3 ? 'active' : ''}`} id="step-3">
                    <h2>Step 3: Setup Notifications</h2>
                    <p>Ensure you never miss review intervals. Enable OS reminders to alert you when patterns fall due:</p>

                    <div className="notif-box">
                        <div className="notif-status-row" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignSelf: 'center' }}>
                            <span className="status-label">Enable Reminders:</span>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    id="welcome-notif-toggle"
                                    role="switch"
                                    checked={notifEnabled}
                                    onChange={handleToggleNotification}
                                />
                                <span className="slider" />
                            </label>
                        </div>
                        <div className="notif-status-row" style={{ marginBottom: '12px' }}>
                            <span className="status-label">OS Permission:</span>
                            <span
                                id="welcome-notif-status"
                                className={`status-badge ${notifPermission === 'granted' ? 'success' : 'error'}`}
                            >
                                {notifPermission === 'granted' ? 'Active' : 'Disabled'}
                            </span>
                        </div>
                        {notifPermission !== 'granted' && (
                            <button id="welcome-enable-btn" className="btn btn-primary w-full" onClick={handleRequestPermission}>
                                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                </svg>
                                Grant OS Permissions
                            </button>
                        )}
                    </div>
                </div>

                {/* Step 4: Pin Extension & Start Practicing */}
                <div className={`step-card ${currentStep === 4 ? 'active' : ''}`} id="step-4">
                    <h2>Step 4: Pin Extension & Start Practicing! 🎉</h2>
                    <p>Pin AlgoRecall to your browser toolbar for quick one-click access:</p>
                    <div className="pin-guide-box">
                        <div className="pin-step">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-primary)', width: '28px', height: '28px', minWidth: '28px' }} aria-hidden="true">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <div className="pin-instructions" id="welcome-pin-instructions">
                                {isSafari ? (
                                    <span><strong>1. Open Safari Settings ⚙️ &rarr; Extensions</strong> and ensure AlgoRecall is turned on.<br /><strong>2. Check your Safari toolbar</strong> to access your review counter at any time.</span>
                                ) : (
                                    <span><strong>1. Click the puzzle icon 🧩</strong> in {BROWSER_CONFIG.displayName}&apos;s top right toolbar.<br /><strong>2. Pin AlgoRecall 📌</strong> to keep your review counter always visible.</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="completion-actions" style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <a
                            href="https://leetcode.com/problemset/all/"
                            target="_blank"
                            rel="noreferrer"
                            id="start-practicing-btn"
                            className="btn btn-primary w-full"
                            style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            Start Practicing on LeetCode 🚀
                        </a>
                        <a href="../help/help.html" id="welcome-docs-link" className="btn btn-secondary w-full" style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            Browse Full Help & Documentation 📖
                        </a>
                    </div>
                </div>
            </div>

            {/* Navigation Controls */}
            <div className="welcome-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    id="welcome-prev-btn"
                    className={`btn btn-secondary ${currentStep === 1 ? 'invisible' : ''}`}
                    disabled={currentStep === 1}
                    aria-hidden={currentStep === 1 ? 'true' : undefined}
                    onClick={handlePrev}
                >
                    Back
                </button>
                <button
                    id="welcome-skip-btn"
                    className="btn btn-link"
                    style={{ color: 'var(--md-text-low)', fontSize: '13px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={handleSkip}
                >
                    Skip Tour
                </button>
                <button
                    id="welcome-next-btn"
                    className="btn btn-primary"
                    onClick={handleNext}
                >
                    {currentStep === controller.totalSteps ? 'Explore Guide' : 'Next'}
                </button>
            </div>

            {/* Status toast */}
            <div id="status-toast" className="toast" />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

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
    init(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<WelcomeApp controller={this} />, root);
                return;
            }

            this.bindEvents();
            this.syncThemePreference();
            this.checkNotificationState();
            this.renderBrowserSpecificInstructions();
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Error initializing OnboardingWelcome', err);
        }
    }

    /**
     * Renders browser-appropriate extension pinning and toolbar instructions.
     */
    renderBrowserSpecificInstructions(): void {
        try {
            const pinInstructionsEl = document.getElementById('welcome-pin-instructions');
            if (!pinInstructionsEl) return;

            if (BROWSER_CONFIG.target === 'safari') {
                pinInstructionsEl.innerHTML = `<strong>1. Open Safari Settings ⚙️ &rarr; Extensions</strong> and ensure AlgoRecall is turned on.<br><strong>2. Check your Safari toolbar</strong> to access your review counter at any time.`;
            } else {
                pinInstructionsEl.innerHTML = `<strong>1. Click the puzzle icon 🧩</strong> in ${BROWSER_CONFIG.displayName}'s top right toolbar.<br><strong>2. Pin AlgoRecall 📌</strong> to keep your review counter always visible.`;
            }
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Error rendering browser-specific pin instructions', err);
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

            const skipBtn = document.getElementById('welcome-skip-btn');
            skipBtn?.addEventListener('click', () => {
                try {
                    window.close();
                } catch (err) {
                    UIUtils.catchError('Onboarding', 'Error skipping onboarding tour', err);
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
                                    UIUtils.showToast("Notification permissions granted!");
                                } else {
                                    UIUtils.showToast("Notifications were disabled at the OS level.");
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

            const notifToggle = document.getElementById('welcome-notif-toggle') as HTMLInputElement;
            notifToggle?.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                try {
                    chrome.storage.local.get(['notificationSettings'], (result) => {
                        if (UIUtils.checkStorageError('Onboarding', 'Storage error fetching notificationSettings')) return;
                        const settings = result.notificationSettings || { enabled: true };
                        settings.enabled = target.checked;
                        chrome.storage.local.set({ notificationSettings: settings }, () => {
                            if (UIUtils.checkStorageError('Onboarding', 'Storage error saving notificationSettings')) return;
                            UIUtils.showToast(target.checked ? "Reminders Enabled" : "Reminders Disabled");
                        });
                    });
                } catch (err) {
                    UIUtils.catchError('Onboarding', 'Error toggling notifications', err);
                }
            });
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Error binding event listeners', err);
        }
    }

    /**
     * Fetches current theme selection and syncs button state.
     * @fires chrome.storage.local.get
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
     * @param step - Target step number (1 to 4).
     */
    goToStep(step: number): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                this.currentStep = step;
                render(<WelcomeApp controller={this} />, root);
                return;
            }

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
        } catch (err) {
            UIUtils.catchError('Onboarding', `Error navigating to step ${step}`, err, { step });
        }
    }

    /**
     * Renders UI toggle buttons as active/selected matching requested theme.
     * @param theme - Theme identifier string ('dark' | 'light').
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
     * @param theme - Theme identifier string ('dark' | 'light').
     * @fires chrome.storage.local.set
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
     * @fires chrome.storage.local.get
     */
    checkNotificationState(): void {
        try {
            const badge = document.getElementById('welcome-notif-status');
            const btn = document.getElementById('welcome-enable-btn');
            const toggle = document.getElementById('welcome-notif-toggle') as HTMLInputElement;

            try {
                chrome.storage.local.get(['notificationSettings'], (result) => {
                    if (UIUtils.checkStorageError('Onboarding', 'Storage error fetching notificationSettings in checkNotificationState')) return;
                    if (toggle) {
                        toggle.checked = result.notificationSettings ? result.notificationSettings.enabled !== false : true;
                    }
                });
            } catch (err) {
                UIUtils.catchError('Onboarding', 'Error fetching notificationSettings', err);
            }

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

export function initWelcome(): void {
    try {
        const root = document.getElementById('root');
        const welcome = new OnboardingWelcome();
        if (root) {
            render(<WelcomeApp controller={welcome} />, root);
        } else {
            welcome.init();
        }
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

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).StepIndicators = StepIndicators;
    (module.exports as any).WelcomeApp = WelcomeApp;
    (module.exports as any).OnboardingWelcome = OnboardingWelcome;
    (module.exports as any).initWelcome = initWelcome;
}
