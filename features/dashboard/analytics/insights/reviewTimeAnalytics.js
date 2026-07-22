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
        let bestRetention = -1;
        let bestBuckets = [];
        
        data.forEach(d => {
            if (d.reviews > 5) {
                if (d.retention > bestRetention) {
                    bestRetention = d.retention;
                    bestBuckets = [d];
                } else if (d.retention === bestRetention) {
                    bestBuckets.push(d);
                }
            }
        });
        
        // Format names nicely
        const nameMap = {
            morning: 'Morning (5AM - 12PM)',
            afternoon: 'Afternoon (12PM - 5PM)',
            evening: 'Evening (5PM - 9PM)',
            night: 'Night (9PM - 5AM)'
        };

        let highlightText = `Keep reviewing to discover your optimal study time!`;
        if (bestBuckets.length > 0) {
            if (bestBuckets.length === 4) {
                highlightText = `You retain information equally well across <strong>all times of day</strong> (${bestRetention}% recall).`;
            } else if (bestBuckets.length > 1) {
                const names = bestBuckets.map(b => nameMap[b.bucket].split(' ')[0]);
                const last = names.pop();
                const bucketStr = names.join(', ') + ' and ' + last;
                highlightText = `You retain information best when reviewing in the <strong>${bucketStr}</strong> (${bestRetention}% recall).`;
            } else {
                highlightText = `You retain information best when reviewing in the <strong>${nameMap[bestBuckets[0].bucket].split(' ')[0]}</strong> (${bestRetention}% recall).`;
            }
        }

        let html = `
            <div class="insights-highlight">
                <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2v10l4.5 4.5"></path><circle cx="12" cy="12" r="10"></circle></svg>
                <span>${highlightText}</span>
            </div>
            
            <div style="display: flex; height: 180px; margin-top: 16px;">
                <!-- Y Axis -->
                <div style="display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 28px;">
                    <div style="height: 150px; display: flex; flex-direction: column; justify-content: space-between; font-size: 0.75rem; color: var(--md-text-med); text-align: right; padding-right: 8px; border-right: 1px solid var(--md-border); width: 40px; box-sizing: border-box;">
                        <span style="transform: translateY(-50%);">100%</span>
                        <span style="transform: translateY(-50%);">75%</span>
                        <span style="transform: translateY(-50%);">50%</span>
                        <span style="transform: translateY(-50%);">25%</span>
                        <span style="transform: translateY(-20%);">0%</span>
                    </div>
                </div>
                
                <!-- Chart Area -->
                <div style="flex: 1; position: relative; height: 100%;">
                    <!-- Grid Lines -->
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 150px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; z-index: 0;">
                        <div style="border-top: 1px dashed var(--md-border); opacity: 0.3; width: 100%;"></div>
                        <div style="border-top: 1px dashed var(--md-border); opacity: 0.3; width: 100%;"></div>
                        <div style="border-top: 1px dashed var(--md-border); opacity: 0.3; width: 100%;"></div>
                        <div style="border-top: 1px dashed var(--md-border); opacity: 0.3; width: 100%;"></div>
                        <div style="border-top: 1px solid var(--md-border); opacity: 0.8; width: 100%;"></div>
                    </div>
                    
                    <!-- SVG Line Chart -->
                    <svg width="100%" height="150px" style="position: absolute; top: 0; left: 0; z-index: 1; overflow: visible;">
        `;
        
        // Calculate point coordinates (percentages)
        const points = data.map((d, i) => {
            const xPct = 12.5 + i * 25; // Centers at 12.5%, 37.5%, 62.5%, 87.5%
            const retention = d.retention || 0;
            const yPct = 10 + (1 - (retention / 100)) * 80; // Maps 100% to 10%, 0% to 90%
            return { x: xPct, y: yPct, d };
        });

        // Draw Lines
        for (let i = 0; i < points.length - 1; i++) {
            html += `<line x1="${points[i].x}%" y1="${points[i].y}%" x2="${points[i+1].x}%" y2="${points[i+1].y}%" stroke="var(--md-primary)" stroke-width="3" stroke-linecap="round" />`;
        }

        // Draw Dots and Hover Overlays
        let overlayHtml = `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 180px; z-index: 2;">`;
        
        points.forEach((p) => {
            const timeStr = (p.d.avgDurationMs !== null && p.d.avgDurationMs !== undefined) ? (p.d.avgDurationMs / 1000).toFixed(1) + 's' : 'N/A';
            
            // Draw circle on SVG
            html += `<circle cx="${p.x}%" cy="${p.y}%" r="5" fill="var(--md-bg)" stroke="var(--md-primary)" stroke-width="2" />`;
            
            // Draw interactive HTML column overlay
            overlayHtml += `
                <div style="position: absolute; left: ${p.x}%; top: 0; height: 100%; width: 25%; margin-left: -12.5%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer;" title="Recall: ${p.d.retention}%, Avg Time: ${timeStr}, Reviews: ${p.d.reviews}">
                    <!-- Invisible hover target area taking full height -->
                    <div style="flex: 1; width: 100%;" title="Recall: ${p.d.retention}%, Avg Time: ${timeStr}, Reviews: ${p.d.reviews}"></div>
                    <!-- Label below chart -->
                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--md-text); margin-bottom: 5px; white-space: nowrap;">
                        ${nameMap[p.d.bucket].split(' ')[0]}
                    </div>
                </div>
            `;
        });
        
        html += `</svg>`;
        html += overlayHtml + `</div>`; // Close overlay div
        html += `</div></div>`; // Close chart area and wrapper

        container.innerHTML = html;
    }
}
