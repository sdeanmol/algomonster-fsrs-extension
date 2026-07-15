export class RecoveryTracking {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.tagFilter = 'all';
    }

    setTagFilter(tag) {
        this.tagFilter = tag;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { lapsed, recovered } = this.dataUtils.getPerformanceStats();
        
        let filteredLapsed = lapsed;
        let filteredRecovered = recovered;
        
        if (this.tagFilter !== 'all') {
            filteredLapsed = lapsed.filter(c => c.tags && c.tags.includes(this.tagFilter));
            filteredRecovered = recovered.filter(c => c.tags && c.tags.includes(this.tagFilter));
        }

        let html = `
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
    
    buildTable(cards, isRecovered) {
        if (cards.length === 0) {
            return `<div class="retention-empty">No cards found in this category.</div>`;
        }
        
        let rows = cards.map(c => {
            const url = c.problemUrl || '#';
            const title = c.problemTitle || 'Untitled';
            const lapses = c.lapses || 0;
            const stab = c.stability > 0 ? c.stability.toFixed(1) + 'd' : '0d';
            
            // Heuristic for days since last lapse (assume last review was a lapse if struggling)
            // Ideally derived from historyLog
            let daysSince = 0;
            if (c.historyLog && c.historyLog.length > 0) {
                const lastLapseLog = c.historyLog.find(l => l.rating === 1);
                if (lastLapseLog) {
                    daysSince = Math.floor((Date.now() - lastLapseLog.date) / (1000 * 60 * 60 * 24));
                } else if (c.lastReview) {
                    daysSince = Math.floor((Date.now() - c.lastReview) / (1000 * 60 * 60 * 24));
                }
            }
            
            return `
                <tr>
                    <td class="trunc"><a href="${url}" target="_blank" class="lapse-title-link" title="${title}">${title}</a></td>
                    <td>${lapses}</td>
                    <td>${daysSince > 0 ? daysSince + 'd' : '-'}</td>
                    <td>${stab}</td>
                    <td>${isRecovered ? '<span style="color:var(--md-success);">✓</span>' : '<span style="color:var(--md-danger);">⚠</span>'}</td>
                </tr>
            `;
        }).join('');
        
        return `
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
                    ${rows}
                </tbody>
            </table>
        `;
    }
}
