import { getLastReviewDate } from '../../../common/utils/cardUtils';
import { DataUtils } from '../utils/dataUtils';
import { Card, ReviewLog } from '../../../../types/domain';

export class RecoveryTracking {
    dataUtils: DataUtils;
    tagFilter: string;

    constructor(dataUtils: DataUtils) {
        this.dataUtils = dataUtils;
        this.tagFilter = 'all';
    }

    setTagFilter(tag: string): void {
        this.tagFilter = tag;
    }

    render(containerId: string): void {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { lapsed, recovered } = this.dataUtils.getPerformanceStats();
        
        let filteredLapsed = lapsed;
        let filteredRecovered = recovered;
        
        if (this.tagFilter !== 'all') {
            filteredLapsed = lapsed.filter(c => c.tags && c.tags.includes(this.tagFilter));
            filteredRecovered = recovered.filter(c => c.tags && c.tags.includes(this.tagFilter));
        }

        const html = `
            <div class="recovery-sections">
                <div class="recovery-column">
                    <h4 class="recovery-title"><span style="color:var(--md-success);">✓</span> Recovered</h4>
                    <p class="recovery-desc">Cards that had multiple lapses but are now stable.</p>
                    ${this.buildTable(filteredRecovered.slice(0, 5), true)}
                </div>
                
                <div class="recovery-column">
                    <h4 class="recovery-title"><span style="color:var(--md-danger);">⚠</span> Still Struggling</h4>
                    <p class="recovery-desc">Cards with recent/frequent lapses.</p>
                    ${this.buildTable(filteredLapsed.slice(0, 5), false)}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
    
    buildTable(cards: Card[], isRecovered: boolean): string {
        if (cards.length === 0) {
            return `<div class="retention-empty">No cards found in this category.</div>`;
        }
        
        const rows = cards.map(c => {
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
    }
}
