/**
 * @file tests/unit/features/common/settings/SettingsComponents.test.tsx
 * @description Comprehensive unit tests for AlgoRecall Settings Hub Preact functional components.
 */

import { h, render } from 'preact';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    SettingsHeader,
    SettingsNav,
    NotificationsPanel,
    HighlighterPanel,
    DataPanel,
    IntegrationsPanel,
    DeveloperPanel,
    AboutPanel,
    SettingsApp
} from '../../../../../features/common/settings/settings';
import { BROWSER_CONFIG } from '../../../../../features/common/browserConfig';

describe('Settings Hub Preact Functional Components', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        (global as any).chrome = {
            storage: {
                local: {
                    get: jest.fn().mockImplementation((keys: any, cb?: any) => {
                        const data = {
                            extensionSettings: {
                                showMarkerPopup: true,
                                showLauncher: true,
                                showCharts: true,
                                showDailyFocus: true,
                                developerMode: false
                            },
                            notificationSettings: {
                                enabled: true,
                                frequency: '60',
                                sticky: true,
                                quietHoursEnabled: false,
                                quietHoursStart: '23:00',
                                quietHoursEnd: '07:00',
                                weeklyDigest: true,
                                badgeDueCount: true
                            },
                            weeklySummaryEnabled: true,
                            fsrsCards: [],
                            debugLogs: []
                        };
                        if (typeof cb === 'function') cb(data);
                        return Promise.resolve(data);
                    }),
                    set: jest.fn().mockImplementation((items: any, cb?: any) => {
                        if (typeof cb === 'function') cb();
                        return Promise.resolve();
                    })
                }
            },
            runtime: {
                sendMessage: jest.fn().mockImplementation((msg: any, cb?: any) => {
                    if (typeof cb === 'function') cb({ success: true });
                }),
                lastError: null
            }
        };
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        jest.restoreAllMocks();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SettingsHeader
    // ─────────────────────────────────────────────────────────────────────────
    describe('SettingsHeader', () => {
        it('renders brand title, badge, and subtitle', () => {
            render(<SettingsHeader />, container);

            expect(container.querySelector('.brand-title')?.textContent).toContain('AlgoRecall');
            expect(container.querySelector('.badge-sub')?.textContent).toBe('Settings');
            expect(container.querySelector('.brand-subtitle')?.textContent).toContain('Spaced Repetition');
        });

        it('triggers onToggleTheme when theme toggle button is clicked', () => {
            const handleToggleTheme = jest.fn();
            render(<SettingsHeader onToggleTheme={handleToggleTheme} />, container);

            const btn = container.querySelector('#theme-toggle-btn') as HTMLButtonElement;
            expect(btn).not.toBeNull();
            btn.click();
            expect(handleToggleTheme).toHaveBeenCalledTimes(1);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SettingsNav
    // ─────────────────────────────────────────────────────────────────────────
    describe('SettingsNav', () => {
        it('renders all 6 navigation tabs with correct aria-selected states', () => {
            render(<SettingsNav activeTab="notifications" onSelectTab={jest.fn()} />, container);

            const tabs = container.querySelectorAll('.nav-tab');
            expect(tabs.length).toBe(6);

            const notifTab = container.querySelector('#tab-btn-notifications') as HTMLButtonElement;
            const highTab = container.querySelector('#tab-btn-highlighter') as HTMLButtonElement;

            expect(notifTab.classList.contains('active')).toBe(true);
            expect(notifTab.getAttribute('aria-selected')).toBe('true');

            expect(highTab.classList.contains('active')).toBe(false);
            expect(highTab.getAttribute('aria-selected')).toBe('false');
        });

        it('invokes onSelectTab with selected tabId when clicked', () => {
            const handleSelectTab = jest.fn();
            render(<SettingsNav activeTab="notifications" onSelectTab={handleSelectTab} />, container);

            const dataTab = container.querySelector('#tab-btn-data') as HTMLButtonElement;
            dataTab.click();
            expect(handleSelectTab).toHaveBeenCalledWith('data');

            const aboutTab = container.querySelector('#tab-btn-about') as HTMLButtonElement;
            aboutTab.click();
            expect(handleSelectTab).toHaveBeenCalledWith('about');
        });

        it('renders privacy pill badge in sidebar footer', () => {
            render(<SettingsNav activeTab="notifications" onSelectTab={jest.fn()} />, container);

            const pill = container.querySelector('.privacy-pill');
            expect(pill?.textContent).toContain('100% Local & Private');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // NotificationsPanel
    // ─────────────────────────────────────────────────────────────────────────
    describe('NotificationsPanel', () => {
        it('applies active class according to isActive prop', () => {
            render(<NotificationsPanel isActive={true} />, container);
            expect(container.querySelector('#panel-notifications')?.classList.contains('active')).toBe(true);

            render(<NotificationsPanel isActive={false} />, container);
            expect(container.querySelector('#panel-notifications')?.classList.contains('active')).toBe(false);
        });

        it('toggles review reminders switch and triggers onUpdate', () => {
            const handleUpdate: any = jest.fn();
            render(
                <NotificationsPanel
                    isActive={true}
                    settings={{ enabled: true }}
                    onUpdate={handleUpdate}
                />,
                container
            );

            const toggle = container.querySelector('#toggle-notifications') as HTMLInputElement;
            expect(toggle.checked).toBe(true);
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));

            expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
        });

        it('handles interval dropdown selection', () => {
            const handleUpdate: any = jest.fn();
            render(
                <NotificationsPanel
                    isActive={true}
                    settings={{ frequency: '60' }}
                    onUpdate={handleUpdate}
                />,
                container
            );

            const select = container.querySelector('#notification-interval') as HTMLSelectElement;
            expect(select.value).toBe('60');

            select.value = '30';
            select.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ frequency: '30', customInterval: 30 }));
        });

        it('expands custom interval input when custom is selected and triggers update', () => {
            const handleUpdate: any = jest.fn();
            render(
                <NotificationsPanel
                    isActive={true}
                    settings={{ frequency: 'custom', customInterval: 45 }}
                    onUpdate={handleUpdate}
                />,
                container
            );

            const customContainer = container.querySelector('#custom-interval-container');
            expect(customContainer?.classList.contains('hide-panel')).toBe(false);

            const customInput = container.querySelector('#custom-interval-input') as HTMLInputElement;
            customInput.value = '90';
            customInput.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ frequency: '90', customInterval: 90 }));
        });

        it('toggles sticky notifications switch', () => {
            const handleUpdate: any = jest.fn();
            render(
                <NotificationsPanel
                    isActive={true}
                    settings={{ requireInteraction: true }}
                    onUpdate={handleUpdate}
                />,
                container
            );

            const toggle = container.querySelector('#toggle-sticky-notification') as HTMLInputElement;
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));

            expect(handleUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ requireInteraction: false, sticky: false })
            );
        });

        it('toggles quiet hours and triggers time inputs', () => {
            const handleUpdate: any = jest.fn();
            render(
                <NotificationsPanel
                    isActive={true}
                    settings={{ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00' }}
                    onUpdate={handleUpdate}
                />,
                container
            );

            const quietContainer = container.querySelector('#quiet-hours-container');
            expect(quietContainer?.classList.contains('hide-panel')).toBe(false);

            const startInput = container.querySelector('#quiet-hours-start') as HTMLInputElement;
            startInput.value = '21:00';
            startInput.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ quietHoursStart: '21:00' }));
        });

        it('toggles weekly digest and badge due count', () => {
            const handleUpdate: any = jest.fn();
            render(
                <NotificationsPanel
                    isActive={true}
                    settings={{ badgeEnabled: true, weeklyDigest: true }}
                    weeklySummaryEnabled={true}
                    onUpdate={handleUpdate}
                />,
                container
            );

            const weeklyToggle = container.querySelector('#toggle-weekly-digest') as HTMLInputElement;
            weeklyToggle.checked = false;
            weeklyToggle.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ weeklyDigest: false }), false);

            const badgeToggle = container.querySelector('#toggle-badge-due-count') as HTMLInputElement;
            badgeToggle.checked = false;
            badgeToggle.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ badgeEnabled: false, showDueBadge: false })
            );
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HighlighterPanel
    // ─────────────────────────────────────────────────────────────────────────
    describe('HighlighterPanel', () => {
        it('toggles floating marker popup and problem tracker launcher', () => {
            const handleUpdate: any = jest.fn();
            render(
                <HighlighterPanel
                    isActive={true}
                    settings={{ showMarkerPopup: true, showLauncher: true }}
                    onUpdate={handleUpdate}
                />,
                container
            );

            const markerToggle = container.querySelector('#toggle-marker-popup') as HTMLInputElement;
            markerToggle.checked = false;
            markerToggle.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith({ showMarkerPopup: false });

            const launcherToggle = container.querySelector('#toggle-algo-launcher') as HTMLInputElement;
            launcherToggle.checked = false;
            launcherToggle.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith({ showLauncher: false });
        });

        it('renders color options feature launcher card', () => {
            render(<HighlighterPanel isActive={true} />, container);

            const link = container.querySelector('a[href*="highlightOptions.html"]') as HTMLAnchorElement;
            expect(link).not.toBeNull();
            expect(link.textContent).toContain('Open Color Options');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // DataPanel
    // ─────────────────────────────────────────────────────────────────────────
    describe('DataPanel', () => {
        it('triggers onExportBackup and onExportAnki callbacks', () => {
            const handleExportBackup: any = jest.fn();
            const handleExportAnki: any = jest.fn();

            render(
                <DataPanel
                    isActive={true}
                    onExportBackup={handleExportBackup}
                    onExportAnki={handleExportAnki}
                />,
                container
            );

            const exportBtn = container.querySelector('#settings-export-btn') as HTMLButtonElement;
            exportBtn.click();
            expect(handleExportBackup).toHaveBeenCalledTimes(1);

            const ankiBtn = container.querySelector('#settings-anki-export-btn') as HTMLButtonElement;
            ankiBtn.click();
            expect(handleExportAnki).toHaveBeenCalledTimes(1);
        });

        it('handles file input for backup restore', () => {
            const handleImportBackup: any = jest.fn();

            render(
                <DataPanel
                    isActive={true}
                    onImportBackup={handleImportBackup}
                />,
                container
            );

            const backupFile = new File(['{}'], 'backup.json', { type: 'application/json' });
            const backupInput = container.querySelector('#settings-import-file') as HTMLInputElement;
            Object.defineProperty(backupInput, 'files', { value: [backupFile] });
            backupInput.dispatchEvent(new Event('change'));
            expect(handleImportBackup).toHaveBeenCalledWith(backupFile);
        });

        it('triggers file selection when pressing Enter or Space on import labels', () => {
            render(<DataPanel isActive={true} />, container);

            const backupInput = container.querySelector('#settings-import-file') as HTMLInputElement;
            const backupClickSpy = jest.spyOn(backupInput, 'click').mockImplementation(() => {});

            const backupLabel = container.querySelector('#settings-import-label') as HTMLLabelElement;
            backupLabel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            expect(backupClickSpy).toHaveBeenCalled();

            backupClickSpy.mockRestore();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // IntegrationsPanel
    // ─────────────────────────────────────────────────────────────────────────
    describe('IntegrationsPanel', () => {
        it('renders navigation links to whitelisted websites and FSRS config', () => {
            render(<IntegrationsPanel isActive={true} />, container);

            const websitesLink = container.querySelector('a[href*="websites.html"]');
            expect(websitesLink).not.toBeNull();
            expect(websitesLink?.textContent).toContain('Manage Active Websites');

            const fsrsLink = container.querySelector('a[href*="fsrsConfig.html"]');
            expect(fsrsLink).not.toBeNull();
            expect(fsrsLink?.textContent).toContain('Open Engine Configuration');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // DeveloperPanel
    // ─────────────────────────────────────────────────────────────────────────
    describe('DeveloperPanel', () => {
        it('toggles showCharts and showDailyFocus', () => {
            const handleUpdate: any = jest.fn();
            render(
                <DeveloperPanel
                    isActive={true}
                    settings={{ showCharts: true, showDailyFocus: true }}
                    onUpdate={handleUpdate}
                />,
                container
            );

            const chartsToggle = container.querySelector('#toggle-show-charts') as HTMLInputElement;
            chartsToggle.checked = false;
            chartsToggle.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith({ showCharts: false });

            const dailyFocusToggle = container.querySelector('#toggle-daily-focus') as HTMLInputElement;
            dailyFocusToggle.checked = false;
            dailyFocusToggle.dispatchEvent(new Event('change'));
            expect(handleUpdate).toHaveBeenCalledWith({ showDailyFocus: false });
        });

        it('expands dev actions container when developerMode is enabled', () => {
            render(
                <DeveloperPanel
                    isActive={true}
                    settings={{ developerMode: true }}
                />,
                container
            );

            const devActions = container.querySelector('#dev-actions-container');
            expect(devActions?.classList.contains('hide-panel')).toBe(false);
        });

        it('triggers test notifications and log export buttons', () => {
            const handleTestNotif: any = jest.fn();
            const handleTestSummary: any = jest.fn();
            const handleExportLogs: any = jest.fn();

            render(
                <DeveloperPanel
                    isActive={true}
                    settings={{ developerMode: true }}
                    onTestNotification={handleTestNotif}
                    onTestSummary={handleTestSummary}
                    onExportDebugLogs={handleExportLogs}
                />,
                container
            );

            const testNotifBtn = container.querySelector('#settings-test-notification-btn') as HTMLButtonElement;
            testNotifBtn.click();
            expect(handleTestNotif).toHaveBeenCalledTimes(1);

            const testSummaryBtn = container.querySelector('#settings-test-summary-notification-btn') as HTMLButtonElement;
            testSummaryBtn.click();
            expect(handleTestSummary).toHaveBeenCalledTimes(1);

            const exportLogsBtn = container.querySelector('#settings-export-debug-logs-btn') as HTMLButtonElement;
            exportLogsBtn.click();
            expect(handleExportLogs).toHaveBeenCalledTimes(1);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AboutPanel
    // ─────────────────────────────────────────────────────────────────────────
    describe('AboutPanel', () => {
        it('renders version info, privacy callout, and review store link', () => {
            render(<AboutPanel isActive={true} />, container);

            expect(container.querySelector('.version-text')?.textContent).toContain('Version 3.1');
            expect(container.querySelector('.privacy-callout')?.textContent).toContain('100% Private, Local-First');

            const rateBtn = container.querySelector('#about-rate-store-btn') as HTMLAnchorElement;
            expect(rateBtn).not.toBeNull();
            expect(rateBtn.href).toContain(BROWSER_CONFIG.reviewUrl);
            expect(rateBtn.title).toContain(BROWSER_CONFIG.storeName);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SettingsApp Root Component
    // ─────────────────────────────────────────────────────────────────────────
    describe('SettingsApp', () => {
        it('renders top app bar, navigation, and switches tabs when nav buttons clicked', async () => {
            render(<SettingsApp initialTab="notifications" />, container);

            // Initially notifications tab active
            expect(container.querySelector('#panel-notifications')?.classList.contains('active')).toBe(true);
            expect(container.querySelector('#panel-highlighter')?.classList.contains('active')).toBe(false);

            // Click highlighter tab
            const highlighterNavBtn = container.querySelector('#tab-btn-highlighter') as HTMLButtonElement;
            highlighterNavBtn.click();

            await Promise.resolve();

            expect(container.querySelector('#panel-highlighter')?.classList.contains('active')).toBe(true);
            expect(container.querySelector('#panel-notifications')?.classList.contains('active')).toBe(false);
        });

        it('renders toast container', () => {
            render(<SettingsApp />, container);

            const toast = container.querySelector('#status-toast');
            expect(toast).not.toBeNull();
        });
    });
});
