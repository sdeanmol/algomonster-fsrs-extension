/**
 * @file features/dashboard/analytics/tags/coverageTable.ts
 * @description Renders the tag coverage and stability table for tag analytics.
 */

import { Logger } from '@common/logger';
import { DataUtils } from '../utils/dataUtils';

export class CoverageTable {
    dataUtils: DataUtils;

    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('CoverageTable', `Error initializing CoverageTable constructor: ${errorMessage}`, { err });
            this.dataUtils = dataUtils;
        }
    }

    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const stats = this.dataUtils.getStatsByTag();
            const totalCards = this.dataUtils.cards ? this.dataUtils.cards.length : 0;

            if (stats.length === 0) {
                container.innerHTML = '<div class="retention-empty">No tags found.</div>';
                return;
            }

            let tableHtml = `
                <div class="table-responsive"><table class="coverage-table">
                    <thead>
                        <tr>
                            <th>Tag</th>
                            <th>Cards</th>
                            <th>Coverage <span class="help-icon" data-tooltip="The percentage of your total flashcard deck that belongs to this specific tag. Helps you identify if you are over-studying or under-studying a specific subject.">?</span></th>
                            <th>Retrievability <span class="help-icon" data-tooltip="The current probability of successfully recalling cards in this tag, calculated mathematically using the FSRS forgetting curve.">?</span></th>
                            <th>Avg Stability <span class="help-icon tooltip-right-align" data-tooltip="The average time (in days) it takes for your memory to decay from 100% to 90% for cards in this tag.">?</span></th>
                            <th>Due <span class="help-icon tooltip-right-align" data-tooltip="The number of cards in this tag that are currently due for review.">?</span></th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            const getTagColorClass = (dueCount: number) => {
                if (dueCount === 0) return 'tag-color-4';
                if (dueCount <= 5) return 'tag-color-2';
                if (dueCount <= 10) return 'tag-color-5';
                if (dueCount <= 20) return 'tag-color-1';
                return 'tag-color-6';
            };

            stats.forEach(s => {
                const pct = totalCards > 0 ? Math.round((s.count / totalCards) * 100) : 0;
                const colorClass = getTagColorClass(s.due);

                tableHtml += `
                    <tr>
                        <td class="tag-name-cell"><span class="tag-badge clickable-tag ${colorClass}" data-tag="${s.tag}" style="cursor:pointer;" title="View all cards for this tag">${s.tag}</span></td>
                        <td>${s.count}</td>
                        <td class="coverage-bar-cell">
                            <div class="cov-val">${pct}%</div>
                            <div class="lapse-bar-track"><div class="lapse-bar-fill cov-fill" style="width:${pct}%;"></div></div>
                        </td>
                        <td>${s.trueRetention}%</td>
                        <td>${s.avgStability.toFixed(1)}d</td>
                        <td class="${s.due > 0 ? 'due-alert' : ''}">${s.due}</td>
                    </tr>
                `;
            });

            tableHtml += `</tbody></table></div>`;
            container.innerHTML = tableHtml;

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
                                    Logger.error('CoverageTable', `Error creating tab on tag click: ${errorMessage}`, { tag, error: lastError });
                                }
                            });
                        }
                    } catch (clickErr) {
                        const errorMessage = clickErr instanceof Error ? clickErr.message : String(clickErr);
                        Logger.error('CoverageTable', `Error in tag click event handler: ${errorMessage}`, { clickErr });
                    }
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('CoverageTable', `Error rendering coverage table: ${errorMessage}`, { containerId, err });
        }
    }
}
