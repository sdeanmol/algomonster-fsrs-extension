/**
 * @file features/common/help/help.js
 * @description Controls help panels and instructions guides display tabs.
 */
class OnboardingHelp {
    /**
     * Initializes elements and binds click listeners.
     */
    init() {
        this.bindEvents();
    }

    /**
     * Registers tab-switching and window-closing events.
     */
    bindEvents() {
        // Tab switching logic
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // Deactivate all buttons and panes
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));

                // Activate target
                button.classList.add('active');
                const targetPane = document.getElementById(`tab-${targetTab}`);
                if (targetPane) {
                    targetPane.classList.add('active');
                }
            });
        });

        // Close button logic
        const closeBtn = document.getElementById('close-help-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.close();
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const help = new OnboardingHelp();
    help.init();
});
