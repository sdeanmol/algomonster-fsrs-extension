export class RetentionBarChart {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.sortBy = 'retention';
    }

    setSortBy(val) {
        this.sortBy = val;
    }

    render(containerId) {
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

        // Display top 10 max for neatness
        stats = stats.slice(0, 10);

        let html = '<div class="retention-bars-container">';
        
        stats.forEach(s => {
            let val, displayVal, fillClass;

            if (this.sortBy === 'retention') {
                val = s.trueRetention;
                displayVal = `${s.trueRetention}%`;
                fillClass = val < 70 ? 'fill-danger' : (val < 85 ? 'fill-warning' : 'fill-good');
            } else if (this.sortBy === 'stability') {
                val = Math.min(100, (s.avgStability / 30) * 100); // Normalize roughly against 30 days
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
            }

            html += `
                <div class="h-bar-row">
                    <div class="h-bar-label">${s.tag}</div>
                    <div class="h-bar-track-wrapper">
                        <div class="h-bar-track">
                            <div class="h-bar-fill" style="width:${val}%; background: var(--md-primary);"></div>
                        </div>
                    </div>
                    <div class="h-bar-value">${displayVal}</div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }
}
