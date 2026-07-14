/**
 * @file features/dashboard/popup/notifications.js
 * @description Controls notification and reminder configuration panels inside the dashboard popup.
 * Checks active browser notification permissions, binds listeners to toggles (enable, snooze interval),
 * and routes test notifications through runtime messages to the background script.
 * Upstream dependencies: None.
 * Downstream dependencies: features/dashboard/popup/popup.js (invokes checkNotificationPermissions, initNotificationSettings), background/background.js (via chrome.runtime messaging).
 */

/**
 * Checks Chrome/HTML Notification permissions, toggling permission warning banners
 * and adjusting action button visibility appropriately.
 */
function checkNotificationPermissions() {
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
function initNotificationSettings() {
    const notifToggle = document.getElementById('toggle-notifications');
    const notifInterval = document.getElementById('notification-interval');
    const customIntervalContainer = document.getElementById('custom-interval-container');
    const customIntervalInput = document.getElementById('custom-interval-input');
    const notifStickyToggle = document.getElementById('toggle-sticky-notification');
    const testNotifBtn = document.getElementById('test-notification-btn');

    /**
     * Refreshes the HTML control inputs to match current settings values.
     * @param {Object} settings - Active notification settings structure.
     */
    function updateNotificationUI(settings) {
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
    }

    if (notifToggle && notifInterval && customIntervalContainer && customIntervalInput && notifStickyToggle && testNotifBtn) {
        chrome.storage.local.get(['notificationSettings'], (result) => {
            const settings = result.notificationSettings || {
                enabled: true,
                frequency: '60',
                priority: '2',
                requireInteraction: true
            };
            updateNotificationUI(settings);
        });

        notifInterval.addEventListener('change', () => {
            if (notifInterval.value === 'custom') {
                customIntervalContainer.classList.remove('hide-panel');
                if (!customIntervalInput.value) {
                    customIntervalInput.value = '60';
                }
            } else {
                customIntervalContainer.classList.add('hide-panel');
            }
            saveNotificationSettings();
        });

        notifToggle.addEventListener('change', saveNotificationSettings);
        notifStickyToggle.addEventListener('change', saveNotificationSettings);
        customIntervalInput.addEventListener('input', saveNotificationSettings);

        testNotifBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'test_notification' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error sending test message:", chrome.runtime.lastError.message);
                    showStatus("Error triggering notification.", true);
                } else if (response && response.success) {
                    showStatus("Test notification sent!");
                } else {
                    showStatus("Failed to send test notification.", true);
                }
            });
        });

        /**
         * Commits modified configurations from panel inputs back to storage database.
         */
        function saveNotificationSettings() {
            chrome.storage.local.get(['notificationSettings'], (result) => {
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

                chrome.storage.local.set({ notificationSettings: updatedSettings });
            });
        }
    }
}

