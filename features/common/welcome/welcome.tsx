/**
 * @file Interactive First-Run Onboarding Welcome Walkthrough (Preact)
 * @module features/common/welcome/welcome
 * @context Extension Welcome Page (features/common/welcome/welcome.html)
 * @description Controls the step-by-step interactive welcome onboarding workflow.
 * Manages steps pagination, initial theme configuration, and notification permission requests.
 */

import { h, render, JSX } from 'preact';
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { UIUtils } from '../utils/uiUtils';
import { Toast } from '../ui/components/Toast';
import { BROWSER_CONFIG } from '@common/browserConfig';

/**
 * Props for the StepIndicators component.
 */
export interface StepIndicatorProps {
    /** The 1-based index of the currently active onboarding step */
    currentStep: number;
    /** Total number of wizard steps */
    totalSteps: number;
    /** Optional callback invoked when a step dot is clicked */
    onSelectStep?: (step: number) => void;
}

/**
 * Preact Component for rendering the wizard step indicator dots.
 *
 * @param props - Current step index, total steps, and navigation callback.
 * @returns JSX rendered dot navigation row.
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
// ONBOARDING HEADLESS CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Headless controller class driving multi-step onboarding wizard state.
 * Contains ZERO imperative DOM operations.
 */
export class OnboardingWelcome {
    /** Active wizard step index (1-based) */
    currentStep: number;
    /** Total number of wizard steps */
    totalSteps: number;
    /** Notification state callback */
    onNotificationChange?: (permission: string, enabled: boolean) => void;
    /** Theme change callback */
    onThemeChange?: (theme: string) => void;
    /** Step change callback */
    onStepChange?: (step: number) => void;

    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
    }

    /**
     * Initializes components.
     */
    init(): void {
        this.syncThemePreference();
        this.checkNotificationState();
    }

    /**
     * Navigates to target step number.
     * @param step - Target step number (1 to 4).
     */
    goToStep(step: number): void {
        this.currentStep = step;
        if (this.onStepChange) {
            this.onStepChange(step);
        }
    }

    /**
     * Synchronizes current theme selection from storage.
     */
    syncThemePreference(callback?: (theme: string) => void): void {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['theme'], (result: { theme?: string }) => {
                    try {
                        if (UIUtils.checkStorageError('Onboarding', 'Storage error fetching theme')) return;
                        const theme = result?.theme || 'dark';
                        if (this.onThemeChange) this.onThemeChange(theme);
                        if (callback) callback(theme);
                    } catch (innerErr) {
                        UIUtils.catchError('Onboarding', 'Error processing storage theme result', innerErr);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Failed to sync theme preference', err);
        }
    }

    /**
     * Persists theme configuration changes.
     * @param theme - Theme identifier string ('dark' | 'light').
     */
    setThemePreference(theme: string, callback?: () => void): void {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ theme }, () => {
                    try {
                        if (UIUtils.checkStorageError('Onboarding', 'Storage set error saving theme', { theme })) return;
                        if (this.onThemeChange) this.onThemeChange(theme);
                        UIUtils.showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                        if (callback) callback();
                    } catch (setErr) {
                        UIUtils.catchError('Onboarding', 'Error in storage set callback for theme', setErr, { theme });
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('Onboarding', `Error persisting theme preference '${theme}'`, err, { theme });
        }
    }

    /**
     * Checks system notification permissions and storage settings.
     */
    checkNotificationState(callback?: (permission: string, enabled: boolean) => void): void {
        try {
            let perm = 'default';
            if (typeof Notification !== 'undefined') {
                perm = Notification.permission;
            }

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['notificationSettings'], (result) => {
                    const enabled = result.notificationSettings ? result.notificationSettings.enabled !== false : true;
                    if (this.onNotificationChange) this.onNotificationChange(perm, enabled);
                    if (callback) callback(perm, enabled);
                });
            } else {
                if (this.onNotificationChange) this.onNotificationChange(perm, true);
                if (callback) callback(perm, true);
            }
        } catch (err) {
            UIUtils.catchError('Onboarding', 'Error checking notification state', err);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the root WelcomeApp onboarding component.
 */
export interface WelcomeAppProps {
    /** Optional controller instance passed during testing */
    controller?: OnboardingWelcome;
}

/**
 * Root Preact component for the extension onboarding walkthrough.
 */
export function WelcomeApp({ controller: injectedController }: WelcomeAppProps): JSX.Element {
    const controller = useMemo(() => injectedController || new OnboardingWelcome(), [injectedController]);
    const [currentStep, setCurrentStep] = useState<number>(controller.currentStep || 1);
    const [theme, setTheme] = useState<string>('dark');
    const [notifEnabled, setNotifEnabled] = useState<boolean>(true);
    const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default'>('default');

    useEffect(() => {
        controller.onStepChange = (step) => {
            setCurrentStep(step);
        };
        controller.onThemeChange = (newTheme) => {
            setTheme(newTheme);
        };
        controller.onNotificationChange = (perm, enabled) => {
            setNotifPermission(perm as any);
            setNotifEnabled(enabled);
        };

        controller.syncThemePreference((savedTheme) => {
            setTheme(savedTheme);
        });
        controller.checkNotificationState((perm, enabled) => {
            setNotifPermission(perm as any);
            setNotifEnabled(enabled);
        });
    }, [controller]);

    const handleStepChange = useCallback((step: number) => {
        controller.goToStep(step);
        setCurrentStep(step);
    }, [controller]);

    const handleThemeChange = useCallback((newTheme: string) => {
        controller.setThemePreference(newTheme);
        setTheme(newTheme);
    }, [controller]);

    const handleToggleNotification = useCallback((e: Event) => {
        const target = e.target as HTMLInputElement;
        const checked = target.checked;
        setNotifEnabled(checked);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['notificationSettings'], (result) => {
                const settings = result.notificationSettings || { enabled: true };
                settings.enabled = checked;
                chrome.storage.local.set({ notificationSettings: settings }, () => {
                    UIUtils.showToast(checked ? "Reminders Enabled" : "Reminders Disabled");
                });
            });
        }
    }, []);

    const handleRequestPermission = useCallback(() => {
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
    }, []);

    const handlePrev = useCallback(() => {
        if (currentStep > 1) {
            handleStepChange(currentStep - 1);
        }
    }, [currentStep, handleStepChange]);

    const handleNext = useCallback(() => {
        if (currentStep < controller.totalSteps) {
            handleStepChange(currentStep + 1);
        } else {
            window.location.href = '../help/help.html';
        }
    }, [currentStep, controller.totalSteps, handleStepChange]);

    const handleSkip = useCallback(() => {
        window.close();
    }, []);

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
            <Toast id="status-toast" />
        </div>
    );
}

export function initWelcome(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<WelcomeApp />, root);
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

export default OnboardingWelcome;
