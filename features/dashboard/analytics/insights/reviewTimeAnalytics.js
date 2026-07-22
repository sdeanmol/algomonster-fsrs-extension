export class ReviewTimeAnalytics {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { hasTimeData, data } = this.dataUtils.getReviewTimeInsights();

        if (!hasTimeData || data.every(d => d.reviews === 0)) {
            container.innerHTML = `
                <div class="retention-empty">
                    Not enough timestamp data available. 
                    Review more cards to see insights on your best study times!
                </div>
            `;
            return;
        }

        let maxReviews = Math.max(...data.map(d => d.reviews), 1);
        
        // Find best time
        let best = data[0];
        data.forEach(d => {
            if (d.retention > best.retention && d.reviews > 5) {
                best = d;
            }
        });
        
        // Format names nicely
        const nameMap = {
            morning: 'Morning (5AM - 12PM)',
            afternoon: 'Afternoon (12PM - 5PM)',
            evening: 'Evening (5PM - 9PM)',
            night: 'Night (9PM - 5AM)'
        };

        const highlightText = best.reviews > 5 
            ? `You retain information best when reviewing in the <strong>${best.bucket}</strong> (${best.retention}% recall).`
            : `Keep reviewing to discover your optimal study time!`;

        let html = `
            <div class="insights-highlight">
                <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2v10l4.5 4.5"></path><circle cx="12" cy="12" r="10"></circle></svg>
                <span>${highlightText}</span>
            </div>
            <div class="review-time-chart">
        `;
        
        data.forEach(d => {
            const hPct = (d.reviews / maxReviews) * 100;
            const timeStr = d.avgDurationMs ? (d.avgDurationMs / 1000).toFixed(1) + 's' : 'N/A';
            
            html += `
                <div class="time-bucket-col">
                    <div class="time-bucket-stats">
                        <span>Recall: <strong>${d.retention}%</strong></span>
                        <span>Avg Time: <strong>${timeStr}</strong></span>
                    </div>
                    <div class="time-bar-wrapper">
                        <div class="time-bar" style="height: ${Math.max(5, hPct)}%;">
                            <span class="time-bar-val">${d.reviews}</span>
                        </div>
                    </div>
                    <div class="time-bucket-lbl">${nameMap[d.bucket].split(' ')[0]}</div>
                </div>
            `;
        });
        
        html += `</div>`;
        container.innerHTML = html;
    }
}
