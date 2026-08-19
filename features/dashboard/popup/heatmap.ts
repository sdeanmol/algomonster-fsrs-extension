import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData } from '../../../types/domain';
import { MS_PER_DAY, DAYS_PER_WEEK, HEATMAP_LEVEL_THRESHOLDS } from '../../common/constants';

/**
 * @class HeatmapComponent
 * @extends DashboardComponent
 * @description Renders a contribution activity heatmap grid inside the dashboard popup.
 * Calculates review volume metrics grouped by calendar date string in user's timezone.
 */
export class HeatmapComponent extends DashboardComponent {
    isLifetimeView: boolean;

    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
        this.isLifetimeView = false;
    }

    /**
     * Loads FSRS review activity counts from storage and renders heat cells inside grid containers.
     * Supports showing lifetime counts or constraints to the last 12 weeks.
     */
    async load(lifetime: boolean = false): Promise<void> {
        try {
            const result = (await chrome.storage.local.get(['fsrsActivity'])) as StorageData;
            const activity: Record<string, number> = result.fsrsActivity || {};
            const grid = document.getElementById('heatmap-grid');
            if (!grid) return;
            
            grid.innerHTML = ''; 

            const today = new Date();
            const dayOfWeek = today.getDay(); 
            
            let totalDays = 0;
            let startDate = new Date(today);

            if (lifetime && Object.keys(activity).length > 0) {
                const dateKeys = Object.keys(activity).sort();
                const oldestDateParts = dateKeys[0].split('-'); 
                const oldestDate = new Date(parseInt(oldestDateParts[0], 10), parseInt(oldestDateParts[1], 10) - 1, parseInt(oldestDateParts[2], 10));
                oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay());
                
                const diffTime = today.getTime() - oldestDate.getTime();
                totalDays = Math.floor(diffTime / MS_PER_DAY) + 1; 
                startDate = oldestDate;
            } else {
                totalDays = (11 * DAYS_PER_WEEK) + (dayOfWeek + 1); 
                startDate.setDate(today.getDate() - totalDays + 1);
            }

            for (let i = 0; i < totalDays; i++) {
                const cellDate = new Date(startDate);
                cellDate.setDate(startDate.getDate() + i);
                
                const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                const count = activity[dateString] || 0;

                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';
                
                const ariaLabelText = count === 1 ? `1 review on ${dateString}` : `${count} reviews on ${dateString}`;
                cell.title = ariaLabelText;
                cell.setAttribute('role', 'img');
                cell.setAttribute('aria-label', ariaLabelText);
                cell.setAttribute('tabindex', '0');

                if (count === HEATMAP_LEVEL_THRESHOLDS[0]) cell.classList.add('level-0');
                else if (count <= HEATMAP_LEVEL_THRESHOLDS[1]) cell.classList.add('level-1');
                else if (count <= HEATMAP_LEVEL_THRESHOLDS[2]) cell.classList.add('level-2');
                else if (count <= HEATMAP_LEVEL_THRESHOLDS[3]) cell.classList.add('level-3');
                else cell.classList.add('level-4');

                grid.appendChild(cell);
            }

            setTimeout(() => {
                try {
                    grid.scrollLeft = grid.scrollWidth;
                } catch (scrollErr) {
            UIUtils.catchError('HeatmapComponent', 'Error scrolling heatmap grid', scrollErr);
        }
            }, 10);
        } catch (error) {
            UIUtils.catchError('HeatmapComponent', 'Error rendering heatmap', error, { lifetime });
        }
    }

    /**
     * Binds click events for lifetime view toggle interactions.
     */
    bindEvents(): void {
        try {
            const toggleLifetimeBtn = document.getElementById('toggle-lifetime-btn');
            if (toggleLifetimeBtn) {
                toggleLifetimeBtn.addEventListener('click', () => {
                    try {
                        this.isLifetimeView = !this.isLifetimeView;
                        toggleLifetimeBtn.innerText = this.isLifetimeView ? "Show Last 12 Weeks" : "Show Lifetime";
                        this.load(this.isLifetimeView);
                    } catch (err) {
            UIUtils.catchError('HeatmapComponent', 'Error handling toggle lifetime button click', err);
        }
                });
            }
        } catch (err) {
            UIUtils.catchError('HeatmapComponent', 'Error binding heatmap events', err);
        }
    }
}
