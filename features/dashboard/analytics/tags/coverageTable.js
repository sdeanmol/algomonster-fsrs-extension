export class CoverageTable {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stats = this.dataUtils.getStatsByTag();
        const totalCards = this.dataUtils.cards.length;

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

        const getTagColorClass = (dueCount) => {
            if (dueCount === 0) return 'tag-color-4'; // Green (No due)
            if (dueCount <= 5) return 'tag-color-2'; // Light Blue (Few due)
            if (dueCount <= 10) return 'tag-color-5'; // Yellow/Orange (Some due)
            if (dueCount <= 20) return 'tag-color-1'; // Pink (Many due)
            return 'tag-color-6'; // Red (A lot due)
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

        // Add event listeners for clickable tags
        const clickableTags = container.querySelectorAll('.clickable-tag');
        clickableTags.forEach(tagSpan => {
            tagSpan.addEventListener('click', () => {
                const tag = tagSpan.getAttribute('data-tag');
                const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=total&tag=${encodeURIComponent(tag)}`);
                chrome.tabs.create({ url: dataUrl });
            });
        });
    }
}
