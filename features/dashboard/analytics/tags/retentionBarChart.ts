import { DataUtils } from '../utils/dataUtils';

export class RetentionBarChart {
    dataUtils: DataUtils;
    sortBy: string;

    constructor(dataUtils: DataUtils) {
        this.dataUtils = dataUtils;
        this.sortBy = 'retention';
    }

    setSortBy(val: string): void {
        this.sortBy = val;
    }

    render(containerId: string): void {
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
            }

            const colorClass = getTagColorClass(s.due);

            html += `
                <div class="h-bar-row">
                    <div class="h-bar-label"><span class="tag-badge clickable-tag ${colorClass}" data-tag="${s.tag}" style="cursor:pointer;" title="View all cards for this tag">${s.tag}</span></div>
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

        const clickableTags = container.querySelectorAll('.clickable-tag');
        clickableTags.forEach(tagSpan => {
            tagSpan.addEventListener('click', () => {
                const tag = tagSpan.getAttribute('data-tag');
                if (tag) {
                    const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=total&tag=${encodeURIComponent(tag)}`);
                    chrome.tabs.create({ url: dataUrl });
                }
            });
        });
    }
}
