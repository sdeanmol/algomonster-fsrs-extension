/**
 * @file features/dashboard/analytics/insights/reviewTimeAnalytics.ts
 * @description Renders visual line charts and comparative statistics analyzing memory retention
 * and card review speed grouped by time of day (Morning, Afternoon, Evening, Night).
 *
 * Architecture Role: Time-of-Day Retention Analysis View.
 * Context: Extension Standalone Tab (`features/dashboard/analytics/analytics.html`).
 * Key Exports:
 * - {@link ReviewTimeBucketItem}: Single time bucket metric data point.
 * - {@link ReviewTimeAnalytics}: Chart renderer class plotting time bucket recall curves.
 */

import { UIUtils } from '../../../common/utils/uiUtils';
import { DataUtils, ReviewTimeInsights } from '../utils/dataUtils';
import { TIME_OF_DAY_BUCKET_NAMES } from '../../../common/constants';

/**
 * Data item representing review volume and accuracy within a specific time-of-day bucket.
 */
export type ReviewTimeBucketItem = ReviewTimeInsights['data'][number];

/**
 * Component that renders an SVG line chart correlating recall accuracy with time-of-day study buckets.
 */
export class ReviewTimeAnalytics {
    /** Statistical calculation engine reference. */
    dataUtils: DataUtils;

    /** Map of bucket identifier keys to localized display labels with hour spans. */
    private readonly nameMap: Record<string, string> = TIME_OF_DAY_BUCKET_NAMES;

    /**
     * Initializes ReviewTimeAnalytics with a DataUtils reference.
     * @param dataUtils - Statistical engine instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
        } catch (err) {
            UIUtils.catchError('ReviewTimeAnalytics', 'Error initializing ReviewTimeAnalytics constructor', err);
            this.dataUtils = dataUtils;
        }
    }

    /**
     * Renders the time-of-day performance line chart and best study time highlight banner into container.
     * @param containerId - ID of DOM element to render into.
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const timeInsights = this.dataUtils ? this.dataUtils.getReviewTimeInsights() : { hasTimeData: false, data: [] };
            const { hasTimeData, data } = timeInsights;

            if (!hasTimeData || !data || data.every(d => d.reviews === 0)) {
                container.innerHTML = `
                    <div class="retention-empty">
                        Not enough timestamp data available. 
                        Review more cards to see insights on your best study times!
                    </div>
                `;
                return;
            }

            const { bestBuckets, bestRetention } = this.findBestBuckets(data);
            const highlightText = this.buildHighlightText(bestBuckets, bestRetention);
            
            let html = `
                <div class="insights-highlight">
                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2v10l4.5 4.5"></path><circle cx="12" cy="12" r="10"></circle></svg>
                    <span>${highlightText}</span>
                </div>
            `;
            html += this.buildChartSVG(data);

            container.innerHTML = html;
        } catch (err) {
            UIUtils.catchError('ReviewTimeAnalytics', 'Error rendering ReviewTimeAnalytics', err, { containerId });
        }
    }

    /**
     * Identifies the time bucket(s) achieving the highest recall retention (min 5 reviews).
     */
    private findBestBuckets(data: ReviewTimeBucketItem[]): { bestBuckets: ReviewTimeBucketItem[]; bestRetention: number } {
        let bestRetention = -1;
        let bestBuckets: ReviewTimeBucketItem[] = [];
        
        data.forEach(d => {
            try {
                if (d.reviews > 5) {
                    if (d.retention > bestRetention) {
                        bestRetention = d.retention;
                        bestBuckets = [d];
                    } else if (d.retention === bestRetention) {
                        bestBuckets.push(d);
                    }
                }
            } catch (bErr) {
                UIUtils.catchError('ReviewTimeAnalytics', 'Error processing bucket data', bErr, { d });
            }
        });

        return { bestBuckets, bestRetention };
    }

    /**
     * Synthesizes user-facing summary text highlighting the most effective study period.
     */
    private buildHighlightText(bestBuckets: ReviewTimeBucketItem[], bestRetention: number): string {
        let highlightText = `Keep reviewing to discover your optimal study time!`;
        if (bestBuckets.length > 0) {
            if (bestBuckets.length === 4) {
                highlightText = `You retain information equally well across <strong>all times of day</strong> (${bestRetention}% recall).`;
            } else if (bestBuckets.length > 1) {
                const names = bestBuckets.map(b => (this.nameMap[b.bucket] || b.bucket).split(' ')[0]);
                const last = names.pop();
                const bucketStr = names.join(', ') + ' and ' + last;
                highlightText = `You retain information best when reviewing in the <strong>${bucketStr}</strong> (${bestRetention}% recall).`;
            } else {
                const bucketName = (this.nameMap[bestBuckets[0].bucket] || bestBuckets[0].bucket).split(' ')[0];
                highlightText = `You retain information best when reviewing in the <strong>${bucketName}</strong> (${bestRetention}% recall).`;
            }
        }
        return highlightText;
    }

    /**
     * Constructs HTML and SVG markup plotting retention data points across time buckets.
     */
    private buildChartSVG(data: ReviewTimeBucketItem[]): string {
        let html = `
            <div style="display: flex; height: 180px; margin-top: 16px;">
                <div style="display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 28px;">
                    <div style="height: 150px; display: flex; flex-direction: column; justify-content: space-between; font-size: 0.75rem; color: var(--md-text-med); text-align: right; padding-right: 8px; border-right: 1px solid var(--md-border); width: 40px; box-sizing: border-box;">
                        <span style="transform: translateY(-50%);">100%</span>
                        <span style="transform: translateY(-50%);">75%</span>
                        <span style="transform: translateY(-50%);">50%</span>
                        <span style="transform: translateY(-50%);">25%</span>
                        <span style="transform: translateY(-20%);">0%</span>
                    </div>
                </div>
                
                <div style="flex: 1; position: relative; height: 100%;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; height: 150px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; z-index: 0;">
                        <div style="border-top: 1px dashed var(--md-border); opacity: 0.3; width: 100%;"></div>
                        <div style="border-top: 1px dashed var(--md-border); opacity: 0.3; width: 100%;"></div>
                        <div style="border-top: 1px dashed var(--md-border); opacity: 0.3; width: 100%;"></div>
                        <div style="border-top: 1px dashed var(--md-border); opacity: 0.3; width: 100%;"></div>
                        <div style="border-top: 1px solid var(--md-border); opacity: 0.8; width: 100%;"></div>
                    </div>
                    
                    <svg width="100%" height="150px" style="position: absolute; top: 0; left: 0; z-index: 1; overflow: visible;">
        `;
        
        const points = data.map((d, i) => {
            const xPct = 12.5 + i * 25;
            const retention = d.retention || 0;
            const yPct = 10 + (1 - (retention / 100)) * 80;
            return { x: xPct, y: yPct, d };
        });

        for (let i = 0; i < points.length - 1; i++) {
            html += `<line x1="${points[i].x}%" y1="${points[i].y}%" x2="${points[i+1].x}%" y2="${points[i+1].y}%" stroke="var(--md-primary)" stroke-width="3" stroke-linecap="round" />`;
        }

        let overlayHtml = `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 180px; z-index: 2;">`;
        
        points.forEach((p) => {
            const timeStr = (p.d.avgDurationMs !== null && p.d.avgDurationMs !== undefined) ? (p.d.avgDurationMs / 1000).toFixed(1) + 's' : 'N/A';
            const bucketLabel = (this.nameMap[p.d.bucket] || p.d.bucket).split(' ')[0];
            
            html += `<circle cx="${p.x}%" cy="${p.y}%" r="5" fill="var(--md-bg)" stroke="var(--md-primary)" stroke-width="2" />`;
            
            overlayHtml += `
                <div style="position: absolute; left: ${p.x}%; top: 0; height: 100%; width: 25%; margin-left: -12.5%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; cursor: pointer;" title="Recall: ${p.d.retention}%, Avg Time: ${timeStr}, Reviews: ${p.d.reviews}">
                    <div style="flex: 1; width: 100%;" title="Recall: ${p.d.retention}%, Avg Time: ${timeStr}, Reviews: ${p.d.reviews}"></div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--md-text); margin-bottom: 5px; white-space: nowrap;">
                        ${bucketLabel}
                    </div>
                </div>
            `;
        });
        
        html += `</svg>`;
        html += overlayHtml + `</div>`;
        html += `</div></div>`;
        return html;
    }
}
