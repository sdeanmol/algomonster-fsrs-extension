import { MemoryHealth } from './memoryHealth.js';
import { LearningVelocity } from './learningVelocity.js';
import { MiniForecast } from './miniForecast.js';

export class OverviewTab {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.memoryHealth = new MemoryHealth(this.dataUtils);
        this.learningVelocity = new LearningVelocity(this.dataUtils);
        this.miniForecast = new MiniForecast(this.dataUtils);
        this.rendered = false;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!this.rendered) {
            container.innerHTML = `
                <div id="overview-next-action-container"></div>
                <div class="overview-grid">
                    <div id="memory-health-container" class="overview-panel"></div>
                    <div id="learning-velocity-container" class="overview-panel"></div>
                </div>
                <div id="mini-forecast-container"></div>
            `;
            this.rendered = true;
        }

        this.renderNextAction('overview-next-action-container');
        this.memoryHealth.render('memory-health-container');
        this.learningVelocity.render('learning-velocity-container');
        this.miniForecast.render('mini-forecast-container');
    }

    renderNextAction(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Simple logic for next action priority:
        // 1. High due count
        // 2. Memory health low
        // 3. Keep it up

        const stats = this.dataUtils.getSummaryStats();
        const dueCount = stats.due || 0;
        
        let healthScore = 0;
        if (stats.trueRetention > 0) {
            healthScore = stats.trueRetention;
            if (stats.streak > 3) healthScore = Math.min(100, healthScore + 2);
            if (stats.streak > 7) healthScore = Math.min(100, healthScore + 3);
        } else if (stats.retention > 0) {
            healthScore = stats.retention;
        }
        const health = healthScore;
        
        let type = 'success';
        let icon = '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>';
        let title = 'You are all caught up!';
        let message = 'Your next step is to <strong>enjoy the rest of your day</strong>. Alternatively, you can learn some new cards.';

        if (dueCount > 0) {
            type = 'warning';
            icon = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
            title = 'Reviews Pending';
            message = `You have <strong>${dueCount} cards due</strong> right now. Your next action is to head back to the dashboard and clear your queue.`;
        } else if (health < 75 && stats.totalCards > 10) {
            type = 'warning';
            icon = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
            title = 'Memory Health Dropping';
            message = `Your memory health is currently at ${health}%. Your next action should be a <strong>custom study session</strong> to review difficult cards before you forget them.`;
        }

        container.innerHTML = `
            <div class="actionable-insight-banner ${type}">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
                <div class="insight-content">
                    <h3>Next Action: ${title}</h3>
                    <p>${message}</p>
                </div>
            </div>
        `;
    }
}
