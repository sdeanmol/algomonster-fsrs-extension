import { DashboardComponent } from './DashboardComponent.js';

/**
 * @class NotificationsComponent
 * @extends DashboardComponent
 * @description Controls notification and reminder configuration panels inside the dashboard popup.
 * Checks active browser notification permissions, binds listeners to toggles (enable, snooze interval),
 * and routes test notifications through runtime messages to the background script.
 */
export class NotificationsComponent extends DashboardComponent {
    constructor(coordinator) {
        super(coordinator);
    }

    /**
     * Checks Chrome/HTML Notification permissions, toggling permission warning banners
     * and adjusting action button visibility appropriately.
     */
    checkPermissions() {
        if (typeof Notification !== 'undefined') {
            const warningBanner = document.getElementById('permission-warning-banner');
            const enableBtn = document.getElementById('enable-notifications-btn');
            if (!warningBanner) return;

            if (Notification.permission !== 'granted') {
                warningBanner.classList.remove('hide-panel');
                if (Notification.permission === 'denied') {
                    if (enableBtn) enableBtn.style.display = 'none';
                    const spanEl = warningBanner.querySelector('span');
                    if (spanEl) spanEl.innerText = "⚠️ Notifications blocked. Enable them in settings for reminders.";
                } else {
                    if (enableBtn) enableBtn.style.display = 'inline-block';
                    const spanEl = warningBanner.querySelector('span');
                    if (spanEl) spanEl.innerText = "⚠️ Reminders work best with notifications enabled.";
                }
            } else {
                warningBanner.classList.add('hide-panel');
            }
        }
    }

    /**
     * Initializes notification toggles, frequency select dropdowns, and test triggers.
     * Sets up local change listeners to sync preferences back to storage databases.
     */
    async loadSettings() {
        const notifToggle = document.getElementById('toggle-notifications');
        const notifInterval = document.getElementById('notification-interval');
        const customIntervalContainer = document.getElementById('custom-interval-container');
        const customIntervalInput = document.getElementById('custom-interval-input');
        const notifStickyToggle = document.getElementById('toggle-sticky-notification');

        const updateNotificationUI = (settings) => {
            if (!notifToggle) return;
            notifToggle.checked = settings.enabled !== false;
            if (notifStickyToggle) {
                notifStickyToggle.checked = settings.requireInteraction !== false;
            }

            const freqStr = settings.frequency || '60';
            const standardOptions = ['1', '15', '30', '60', '120', '360', '720', '1440'];
            if (notifInterval) {
                if (standardOptions.includes(freqStr)) {
                    notifInterval.value = freqStr;
                    if (customIntervalContainer) customIntervalContainer.classList.add('hide-panel');
                } else {
                    notifInterval.value = 'custom';
                    if (customIntervalContainer) customIntervalContainer.classList.remove('hide-panel');
                    if (customIntervalInput) customIntervalInput.value = freqStr;
                }
            }
        };

        try {
            const result = await chrome.storage.local.get(['notificationSettings']);
            const settings = result.notificationSettings || {
                enabled: true,
                frequency: '60',
                priority: '2',
                requireInteraction: true
            };
            updateNotificationUI(settings);
        } catch (error) {
            console.error("Error loading notification settings:", error);
        }
    }

    /**
     * Binds event listeners to enable button, interval inputs, and test triggers.
     */
    bindEvents() {
        const enableBtn = document.getElementById('enable-notifications-btn');
        const notifToggle = document.getElementById('toggle-notifications');
        const notifInterval = document.getElementById('notification-interval');
        const customIntervalContainer = document.getElementById('custom-interval-container');
        const customIntervalInput = document.getElementById('custom-interval-input');
        const notifStickyToggle = document.getElementById('toggle-sticky-notification');
        const testNotifBtn = document.getElementById('test-notification-btn');

        if (enableBtn) {
            enableBtn.addEventListener('click', () => {
                if (typeof Notification !== 'undefined') {
                    Notification.requestPermission().then((permission) => {
                        this.checkPermissions();
                        if (permission === 'granted') {
                            this.showStatus("Notifications enabled successfully!");
                        } else {
                            this.showStatus("Notifications were not allowed.", true);
                        }
                    });
                }
            });
        }

        const saveNotificationSettings = async () => {
            try {
                const result = await chrome.storage.local.get(['notificationSettings']);
                const oldSettings = result.notificationSettings || { priority: '2' };
                let frequency = notifInterval.value;
                if (frequency === 'custom') {
                    const customVal = parseInt(customIntervalInput.value, 10);
                    frequency = (!isNaN(customVal) && customVal > 0) ? String(customVal) : '60';
                }

                const updatedSettings = {
                    enabled: notifToggle.checked,
                    frequency: frequency,
                    priority: oldSettings.priority || '2',
                    requireInteraction: notifStickyToggle.checked
                };

                await chrome.storage.local.set({ notificationSettings: updatedSettings });
            } catch (error) {
                console.error("Error saving notification settings:", error);
            }
        };

        if (notifInterval) {
            notifInterval.addEventListener('change', () => {
                if (notifInterval.value === 'custom') {
                    if (customIntervalContainer) customIntervalContainer.classList.remove('hide-panel');
                    if (customIntervalInput && !customIntervalInput.value) {
                        customIntervalInput.value = '60';
                    }
                } else {
                    if (customIntervalContainer) customIntervalContainer.classList.add('hide-panel');
                }
                saveNotificationSettings();
            });
        }

        if (notifToggle) {
            notifToggle.addEventListener('change', saveNotificationSettings);
        }

        if (notifStickyToggle) {
            notifStickyToggle.addEventListener('change', saveNotificationSettings);
        }

        if (customIntervalInput) {
            customIntervalInput.addEventListener('input', saveNotificationSettings);
        }

        if (testNotifBtn) {
            testNotifBtn.addEventListener('click', () => {
                chrome.runtime.sendMessage({ action: 'test_notification' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error sending test message:", chrome.runtime.lastError.message);
                        this.showStatus("Error triggering notification.", true);
                    } else if (response && response.success) {
                        this.showStatus("Test notification sent!");
                    } else {
                        this.showStatus("Failed to send test notification.", true);
                    }
                });
            });
        }
    }
}
