/**
 * @file features/dashboard/analytics/performance/recoveryTracking.tsx
 * @description Renders trouble spots and recovered flashcards analytics.
 * Categorizes lapsed cards into 'Recovered' (previously lapsed cards that have re-achieved
 * memory stability) and 'Still Struggling' (cards with recent lapses requiring attention).
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent, render as preactRender } from 'preact';
import { Logger } from '@common/logger';
import { getLastReviewDate } from '../../../common/utils/cardUtils';
import { DataUtils } from '../utils/dataUtils';
import { resolveContainer } from '../utils/resolveContainer';
import { Card, ReviewLog } from '../../../../types/domain';

export interface RecoveryTableProps {
    cards: Card[];
    isRecovered: boolean;
}

export const RecoveryTable: FunctionalComponent<RecoveryTableProps> = ({ cards, isRecovered }) => {
    if (!cards || cards.length === 0) {
        return <div class="retention-empty">No cards found in this category.</div>;
    }

    return (
        <div class="table-responsive">
            <table class="recovery-table">
                <thead>
                    <tr>
                        <th>Card</th>
                        <th>Lapses</th>
                        <th>Since Lapse</th>
                        <th>Stability</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {cards.map(c => {
                        try {
                            const url = c.problemUrl || '#';
                            const title = c.problemTitle || 'Untitled';
                            const lapses = c.lapses || 0;
                            const stab = c.stability > 0 ? c.stability.toFixed(1) + 'd' : '0d';
                            
                            let daysSince = 0;
                            let lastLapseLog: ReviewLog | null = null;
                            
                            if (c.historyLog && c.historyLog.length > 0) {
                                const logs = c.historyLog.slice().reverse();
                                for (const log of logs) {
                                    if (typeof log === 'object' && log !== null && log.rating === 1) {
                                        lastLapseLog = log;
                                        break;
                                    }
                                }
                            }
                            
                            if (lastLapseLog && lastLapseLog.date) {
                                daysSince = Math.floor((Date.now() - lastLapseLog.date) / (1000 * 60 * 60 * 24));
                            } else {
                                const lr = getLastReviewDate(c);
                                if (lr) {
                                    daysSince = Math.floor((Date.now() - lr) / (1000 * 60 * 60 * 24));
                                }
                            }

                            return (
                                <tr key={c.id}>
                                    <td class="trunc">
                                        <a href={url} target="_blank" class="lapse-title-link" title={title} aria-label={title}>
                                            {title}
                                        </a>
                                    </td>
                                    <td>{lapses}</td>
                                    <td>{daysSince > 0 ? daysSince + 'd' : '-'}</td>
                                    <td>{stab}</td>
                                    <td>
                                        {isRecovered ? (
                                            <span style={{ color: 'var(--md-success)' }}>✓</span>
                                        ) : (
                                            <span style={{ color: 'var(--md-danger)' }}>⚠</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        } catch (cardErr) {
                            const errorMessage = cardErr instanceof Error ? cardErr.message : String(cardErr);
                            Logger.error('RecoveryTable', `Error rendering card row: ${errorMessage}`, { cardErr });
                            return null;
                        }
                    })}
                </tbody>
            </table>
        </div>
    );
};

export interface RecoveryTrackingProps {
    lapsed: Card[];
    recovered: Card[];
    tagFilter?: string | string[];
}

export const RecoveryTrackingComponent: FunctionalComponent<RecoveryTrackingProps> = ({
    lapsed = [],
    recovered = [],
    tagFilter = []
}) => {
    let filteredLapsed = lapsed || [];
    let filteredRecovered = recovered || [];

    const activeFilters = Array.isArray(tagFilter)
        ? tagFilter.filter(t => t && t !== 'all')
        : (!tagFilter || tagFilter === 'all' ? [] : [tagFilter]);

    if (activeFilters.length > 0) {
        filteredLapsed = lapsed.filter(c => c.tags && c.tags.some(t => activeFilters.includes(t)));
        filteredRecovered = recovered.filter(c => c.tags && c.tags.some(t => activeFilters.includes(t)));
    }

    return (
        <div class="recovery-sections">
            <div class="recovery-column">
                <h4 class="recovery-title"><span style={{ color: 'var(--md-success)' }}>✓</span> Recovered</h4>
                <p class="recovery-desc">Cards that had multiple lapses but are now stable.</p>
                <RecoveryTable cards={filteredRecovered.slice(0, 5)} isRecovered={true} />
            </div>
            
            <div class="recovery-column">
                <h4 class="recovery-title"><span style={{ color: 'var(--md-danger)' }}>⚠</span> Still Struggling</h4>
                <p class="recovery-desc">Cards with recent/frequent lapses.</p>
                <RecoveryTable cards={filteredLapsed.slice(0, 5)} isRecovered={false} />
            </div>
        </div>
    );
};

/**
 * Visualizes memory recovery after card lapses.
 * Separates lapsed cards into recovered and currently struggling subsets,
 * supporting tag-based filtering and lapse recency tracking.
 */
export class RecoveryTracking {
    /** Data utility instance for card performance analysis */
    dataUtils: DataUtils;
    /** Current tag filter applied to the recovery analysis (empty array for all, or selected tag IDs) */
    tagFilter: string[];

    /**
     * Creates an instance of RecoveryTracking.
     * @param dataUtils - Card statistics and study history utility instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.tagFilter = [];
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RecoveryTracking', `Error initializing RecoveryTracking constructor: ${errorMessage}`, { err });
            this.dataUtils = dataUtils;
            this.tagFilter = [];
        }
    }

    /**
     * Updates the tag filter applied when displaying recovered and struggling cards.
     * @param tag - Tag ID/name or array of tag IDs/names to filter by, or 'all'/empty to show all cards.
     * @returns void
     */
    setTagFilter(tag: string | string[]): void {
        try {
            if (Array.isArray(tag)) {
                this.tagFilter = tag.filter(t => t && t !== 'all');
            } else {
                this.tagFilter = !tag || tag === 'all' ? [] : [tag];
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RecoveryTracking', `Error setting tag filter: ${errorMessage}`, { tag, err });
        }
    }

    /**
     * Renders the two-column Recovered vs Struggling cards breakdown into the target container.
     * @param containerId - DOM ID of the container element hosting the recovery section.
     * @returns void
     */
    render(containerId: string): void {
        try {
            const container = resolveContainer(containerId);
            if (!container) return;

            const { lapsed, recovered } = this.dataUtils.getPerformanceStats();

            preactRender(
                <RecoveryTrackingComponent
                    lapsed={lapsed}
                    recovered={recovered}
                    tagFilter={this.tagFilter}
                />,
                container
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RecoveryTracking', `Error rendering recovery tracking: ${errorMessage}`, { containerId, tagFilter: this.tagFilter, err });
        }
    }
    
    /**
     * Builds the HTML table representation for a list of recovered or struggling cards.
     * Computes elapsed days since the last lapse or review log.
     * @param cards - Array of cards to render in the table.
     * @param isRecovered - True if rendering the recovered cards table; false for struggling cards.
     * @returns Rendered HTML table markup or empty state placeholder.
     */
    buildTable(cards: Card[], isRecovered: boolean): string {
        try {
            if (!cards || cards.length === 0) {
                return `<div class="retention-empty">No cards found in this category.</div>`;
            }
            
            const rows = cards.map(c => {
                try {
                    const url = c.problemUrl || '#';
                    const title = c.problemTitle || 'Untitled';
                    const lapses = c.lapses || 0;
                    const stab = c.stability > 0 ? c.stability.toFixed(1) + 'd' : '0d';
                    
                    let daysSince = 0;
                    let lastLapseLog: ReviewLog | null = null;
                    
                    if (c.historyLog && c.historyLog.length > 0) {
                        const logs = c.historyLog.slice().reverse();
                        for (const log of logs) {
                            if (typeof log === 'object' && log !== null && log.rating === 1) {
                                lastLapseLog = log;
                                break;
                            }
                        }
                    }
                    
                    if (lastLapseLog && lastLapseLog.date) {
                        daysSince = Math.floor((Date.now() - lastLapseLog.date) / (1000 * 60 * 60 * 24));
                    } else {
                        const lr = getLastReviewDate(c);
                        if (lr) {
                            daysSince = Math.floor((Date.now() - lr) / (1000 * 60 * 60 * 24));
                        }
                    }
                    
                    return `
                        <tr>
                            <td class="trunc"><a href="${url}" target="_blank" class="lapse-title-link" title="${title}" aria-label="${title}">${title}</a></td>
                            <td>${lapses}</td>
                            <td>${daysSince > 0 ? daysSince + 'd' : '-'}</td>
                            <td>${stab}</td>
                            <td>${isRecovered ? '<span style="color:var(--md-success);">✓</span>' : '<span style="color:var(--md-danger);">⚠</span>'}</td>
                        </tr>
                    `;
                } catch (cardErr) {
                    const errorMessage = cardErr instanceof Error ? cardErr.message : String(cardErr);
                    Logger.error('RecoveryTracking', `Error building row for recovery card: ${errorMessage}`, { card: c, cardErr });
                    return '';
                }
            }).join('');
            
            return `
                <div class="table-responsive"><table class="recovery-table">
                    <thead>
                        <tr>
                            <th>Card</th>
                            <th>Lapses</th>
                            <th>Since Lapse</th>
                            <th>Stability</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table></div>
            `;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RecoveryTracking', `Error building recovery table: ${errorMessage}`, { isRecovered, err });
            return `<div class="retention-empty">Error rendering cards.</div>`;
        }
    }
}

