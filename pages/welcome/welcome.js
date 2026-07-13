let currentStep = 1;
const totalSteps = 3;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation Event Listeners
    const prevBtn = document.getElementById('welcome-prev-btn');
    const nextBtn = document.getElementById('welcome-next-btn');

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            goToStep(currentStep - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentStep < totalSteps) {
            goToStep(currentStep + 1);
        } else {
            // Last step: Redirect to Help / Dashboard Instructions page
            window.location.href = '../help/help.html';
        }
    });

    // 2. Step 1: Theme Switcher Selector
    const darkBtn = document.getElementById('set-dark-btn');
    const lightBtn = document.getElementById('set-light-btn');

    // Fetch active theme to sync toggle buttons visual active status
    chrome.storage.local.get(['theme'], (result) => {
        const theme = result.theme || 'dark';
        if (theme === 'light') {
            setActiveThemeButton('light');
        } else {
            setActiveThemeButton('dark');
        }
    });

    darkBtn.addEventListener('click', () => {
        setThemePreference('dark');
    });

    lightBtn.addEventListener('click', () => {
        setThemePreference('light');
    });

    // 3. Step 3: Notification Setup
    const enableBtn = document.getElementById('welcome-enable-btn');
    checkNotificationState();

    enableBtn.addEventListener('click', () => {
        if (typeof Notification !== 'undefined') {
            Notification.requestPermission().then((permission) => {
                checkNotificationState();
                if (permission === 'granted') {
                    showToast("Notification settings initialized successfully!");
                } else {
                    showToast("Notifications were disabled.");
                }
            });
        }
    });
});

function goToStep(step) {
    // Toggle active card
    document.getElementById(`step-${currentStep}`).classList.remove('active');
    document.getElementById(`step-${step}`).classList.add('active');

    // Toggle indicator dot
    document.getElementById(`dot-${currentStep}`).classList.remove('active');
    document.getElementById(`dot-${step}`).classList.add('active');

    currentStep = step;

    // Update navigation button labels and visibility
    const prevBtn = document.getElementById('welcome-prev-btn');
    const nextBtn = document.getElementById('welcome-next-btn');

    if (currentStep === 1) {
        prevBtn.classList.add('invisible');
    } else {
        prevBtn.classList.remove('invisible');
    }

    if (currentStep === totalSteps) {
        nextBtn.textContent = 'Explore Guide';
    } else {
        nextBtn.textContent = 'Next';
    }
}

function setActiveThemeButton(theme) {
    const darkBtn = document.getElementById('set-dark-btn');
    const lightBtn = document.getElementById('set-light-btn');

    if (theme === 'light') {
        lightBtn.classList.add('active');
        darkBtn.classList.remove('active');
    } else {
        darkBtn.classList.add('active');
        lightBtn.classList.remove('active');
    }
}

function setThemePreference(theme) {
    chrome.storage.local.set({ theme: theme }, () => {
        setActiveThemeButton(theme);
        showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} Mode!`);
    });
}

function checkNotificationState() {
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

function showToast(msg) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(() => {
        toast.className = 'toast';
    }, 2000);
}
