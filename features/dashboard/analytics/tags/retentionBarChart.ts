/**
 * @file features/dashboard/analytics/tags/retentionBarChart.ts
 * @description Renders a sorted horizontal bar chart comparing memory performance metrics
 * (retention, stability, card count, or lapse rate) across the top 10 tags.
 * Supports interactive tag filtering via Chrome tab creation.
 * @context Popup / Analytics SPA Dashboard
 */

import { Logger } from '@common/logger';
import { DataUtils } from '../utils/dataUtils';

/**
 * Visualizes comparative performance across tags using horizontal progress bars.
 * Allows sorting by retrievability, stability, card count, or lapse count.
 */
export class RetentionBarChart {
    /** Data utility instance for querying card stats grouped by tag */
    dataUtils: DataUtils;
    /** Current metric used to sort the displayed tags ('retention' | 'stability' | 'cards' | 'lapses') */
    sortBy: string;

    /**
     * Initializes the RetentionBarChart with the data provider and default sorting.
     * @param dataUtils - Card statistics helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.sortBy = 'retention';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RetentionBarChart', `Error initializing RetentionBarChart constructor: ${errorMessage}`, { err });
            this.dataUtils = dataUtils;
            this.sortBy = 'retention';
        }
    }

    /**
     * Updates the current sort criterion for the bar chart.
     * @param val - Selected sorting key ('retention', 'stability', 'cards', or 'lapses').
     * @returns void
     */
    setSortBy(val: string): void {
        try {
            this.sortBy = val || 'retention';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RetentionBarChart', `Error setting sortBy value: ${errorMessage}`, { val, err });
        }
    }

    /**
     * Generates horizontal bars for the top 10 tags sorted by the selected metric
     * and injects the markup into the target container. Attaches click handlers to tag pills.
     * @param containerId - DOM ID of the container element hosting the bar chart.
     * @returns void
     * @fires chrome.tabs.create
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            let stats = this.dataUtils.getStatsByTag();

            if (this.sortBy === 'retention') {
                stats.sort((a, b) => b.trueRetention - a.trueRetention);
            } else if (this.sortBy === 'stability') {
                stats.sort((a, b) => b.avgStability - a.avgStability);
            } else if (this.sortBy === 'cards') {
                stats.sort((a, b) => b.count - a.count);
            } else if (this.sortBy === 'lapses') {
                stats.sort((a, b) => b.lapses - a.lapses);
            }

            stats = stats.slice(0, 10);

            const getTagColorClass = (dueCount: number) => {
                if (dueCount === 0) return 'tag-color-4';
                if (dueCount <= 5) return 'tag-color-2';
                if (dueCount <= 10) return 'tag-color-5';
                if (dueCount <= 20) return 'tag-color-1';
                return 'tag-color-6';
            };

            let html = '<div class="retention-bars-container">';
            
            stats.forEach(s => {
                let val = 0;
                let displayVal = '';
                let fillClass = '';

                if (this.sortBy === 'retention') {
                    val = s.trueRetention;
                    displayVal = `${s.trueRetention}%`;
                    fillClass = val < 70 ? 'fill-danger' : (val < 85 ? 'fill-warning' : 'fill-good');
                } else if (this.sortBy === 'stability') {
                    val = Math.min(100, (s.avgStability / 30) * 100);
                    displayVal = `${s.avgStability.toFixed(1)}d`;
                    fillClass = 'fill-default';
                } else if (this.sortBy === 'cards') {
                    const max = Math.max(...stats.map(x => x.count), 1);
                    val = (s.count / max) * 100;
                    displayVal = `${s.count}`;
                    fillClass = 'fill-default';
                } else if (this.sortBy === 'lapses') {
                    const max = Math.max(...stats.map(x => x.lapses), 1);
                    val = (s.lapses / max) * 100;
                    displayVal = `${s.lapses}`;
                    fillClass = 'fill-danger';
                }

                const colorClass = getTagColorClass(s.due);

                html += `
                    <div class="h-bar-row">
                        <div class="h-bar-label"><span class="tag-badge clickable-tag ${colorClass}" data-tag="${s.tag}" style="cursor:pointer;" title="View all cards for this tag">${s.tag}</span></div>
                        <div class="h-bar-track-wrapper">
                            <div class="h-bar-track">
                                <div class="h-bar-fill ${fillClass}" style="width:${val}%;"></div>
                            </div>
                        </div>
                        <div class="h-bar-value">${displayVal}</div>
                    </div>
                `;
            });

            html += '</div>';
            container.innerHTML = html;

            const clickableTags = container.querySelectorAll('.clickable-tag');
            clickableTags.forEach(tagSpan => {
                tagSpan.addEventListener('click', () => {
                    try {
                        const tag = tagSpan.getAttribute('data-tag');
                        if (tag) {
                            const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=total&tag=${encodeURIComponent(tag)}`);
                            chrome.tabs.create({ url: dataUrl }, () => {
                                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                if (lastError) {
                                    const errorMessage = lastError.message || String(lastError);
                                    Logger.error('RetentionBarChart', `Error creating tab on tag click: ${errorMessage}`, { tag, error: lastError });
                                }
                            });
                        }
                    } catch (clickErr) {
                        const errorMessage = clickErr instanceof Error ? clickErr.message : String(clickErr);
                        Logger.error('RetentionBarChart', `Error in tag click event handler: ${errorMessage}`, { clickErr });
                    }
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RetentionBarChart', `Error rendering retention bar chart: ${errorMessage}`, { containerId, sortBy: this.sortBy, err });
        }
    }
}
