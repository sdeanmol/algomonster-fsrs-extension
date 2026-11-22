/**
 * @file features/dashboard/analytics/insights/reviewTimeAnalytics.tsx
 * @description Renders visual line charts and comparative statistics analyzing memory retention
 * and card review speed grouped by time of day (Morning, Afternoon, Evening, Night).
 *
 * Architecture Role: Time-of-Day Retention Analysis View.
 * Context: Extension Standalone Tab (`features/dashboard/analytics/analytics.html`).
 * Key Exports:
 * - {@link ReviewTimeBucketItem}: Single time bucket metric data point.
 * - {@link ReviewTimeAnalytics}: Chart renderer class plotting time bucket recall curves.
 */

import { h, Fragment, FunctionalComponent, render as preactRender } from 'preact';
import { UIUtils } from '../../../common/utils/uiUtils';
import { DataUtils, ReviewTimeInsights } from '../utils/dataUtils';
import { resolveContainer } from '../utils/resolveContainer';
import { TIME_OF_DAY_BUCKET_NAMES } from '../../../common/constants';

/**
 * Data item representing review volume and accuracy within a specific time-of-day bucket.
 */
export type ReviewTimeBucketItem = ReviewTimeInsights['data'][number];

export interface ReviewTimeHighlightBannerProps {
    highlightText: string;
}

export const ReviewTimeHighlightBanner: FunctionalComponent<ReviewTimeHighlightBannerProps> = ({ highlightText }) => {
    return (
        <div class="insights-highlight">
            <svg class="svg-icon" viewBox="0 0 24 24">
                <path d="M12 2v10l4.5 4.5" />
                <circle cx="12" cy="12" r="10" />
            </svg>
            <span dangerouslySetInnerHTML={{ __html: highlightText }} />
        </div>
    );
};

export function findBestBuckets(data: ReviewTimeBucketItem[]): { bestBuckets: ReviewTimeBucketItem[]; bestRetention: number } {
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

export function buildHighlightText(bestBuckets: ReviewTimeBucketItem[], bestRetention: number, nameMap: Record<string, string> = TIME_OF_DAY_BUCKET_NAMES): string {
    let highlightText = `Keep reviewing to discover your optimal study time!`;
    if (bestBuckets.length > 0) {
        if (bestBuckets.length === 4) {
            highlightText = `You retain information equally well across <strong>all times of day</strong> (${bestRetention}% recall).`;
        } else if (bestBuckets.length > 1) {
            const names = bestBuckets.map(b => (nameMap[b.bucket] || b.bucket).split(' ')[0]);
            const last = names.pop();
            const bucketStr = names.join(', ') + ' and ' + last;
            highlightText = `You retain information best when reviewing in the <strong>${bucketStr}</strong> (${bestRetention}% recall).`;
        } else {
            const bucketName = (nameMap[bestBuckets[0].bucket] || bestBuckets[0].bucket).split(' ')[0];
            highlightText = `You retain information best when reviewing in the <strong>${bucketName}</strong> (${bestRetention}% recall).`;
        }
    }
    return highlightText;
}

export interface ReviewTimeAnalyticsViewProps {
    timeInsights: ReviewTimeInsights;
}

export const ReviewTimeAnalyticsView: FunctionalComponent<ReviewTimeAnalyticsViewProps> = ({ timeInsights }) => {
    const { hasTimeData, data } = timeInsights || { hasTimeData: false, data: [] };

    if (!hasTimeData || !data || data.every(d => d.reviews === 0)) {
        return (
            <div class="retention-empty">
                Not enough timestamp data available. 
                Review more cards to see insights on your best study times!
            </div>
        );
    }

    const { bestBuckets, bestRetention } = findBestBuckets(data);
    const highlightText = buildHighlightText(bestBuckets, bestRetention);

    const points = data.map((d, i) => {
        const xPct = 12.5 + i * 25;
        const retention = d.retention || 0;
        const yPct = 10 + (1 - (retention / 100)) * 80;
        return { x: xPct, y: yPct, d };
    });

    return (
        <div>
            <ReviewTimeHighlightBanner highlightText={highlightText} />
            <div style={{ display: 'flex', height: '180px', marginTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '28px' }}>
                    <div style={{ height: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--md-text-med)', textAlign: 'right', paddingRight: '8px', borderRight: '1px solid var(--md-border)', width: '40px', boxSizing: 'border-box' }}>
                        <span style={{ transform: 'translateY(-50%)' }}>100%</span>
                        <span style={{ transform: 'translateY(-50%)' }}>75%</span>
                        <span style={{ transform: 'translateY(-50%)' }}>50%</span>
                        <span style={{ transform: 'translateY(-50%)' }}>25%</span>
                        <span style={{ transform: 'translateY(-20%)' }}>0%</span>
                    </div>
                </div>
                
                <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', zIndex: 0 }}>
                        <div style={{ borderTop: '1px dashed var(--md-border)', opacity: 0.3, width: '100%' }} />
                        <div style={{ borderTop: '1px dashed var(--md-border)', opacity: 0.3, width: '100%' }} />
                        <div style={{ borderTop: '1px dashed var(--md-border)', opacity: 0.3, width: '100%' }} />
                        <div style={{ borderTop: '1px dashed var(--md-border)', opacity: 0.3, width: '100%' }} />
                        <div style={{ borderTop: '1px solid var(--md-border)', opacity: 0.8, width: '100%' }} />
                    </div>
                    
                    <svg width="100%" height="150px" style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, overflow: 'visible' }}>
                        {points.slice(0, points.length - 1).map((p, i) => (
                            <line
                                key={i}
                                x1={`${p.x}%`}
                                y1={`${p.y}%`}
                                x2={`${points[i + 1].x}%`}
                                y2={`${points[i + 1].y}%`}
                                stroke="var(--md-primary)"
                                stroke-width="3"
                                stroke-linecap="round"
                            />
                        ))}
                        {points.map((p, i) => (
                            <circle
                                key={i}
                                cx={`${p.x}%`}
                                cy={`${p.y}%`}
                                r="5"
                                fill="var(--md-bg)"
                                stroke="var(--md-primary)"
                                stroke-width="2"
                            />
                        ))}
                    </svg>
                    
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '180px', zIndex: 2 }}>
                        {points.map((p, i) => {
                            const timeStr = (p.d.avgDurationMs !== null && p.d.avgDurationMs !== undefined) ? (p.d.avgDurationMs / 1000).toFixed(1) + 's' : 'N/A';
                            const bucketLabel = (TIME_OF_DAY_BUCKET_NAMES[p.d.bucket] || p.d.bucket).split(' ')[0];
                            return (
                                <div
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        left: `${p.x}%`,
                                        top: 0,
                                        height: '100%',
                                        width: '25%',
                                        marginLeft: '-12.5%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        cursor: 'pointer'
                                    }}
                                    title={`Recall: ${p.d.retention}%, Avg Time: ${timeStr}, Reviews: ${p.d.reviews}`}
                                >
                                    <div style={{ flex: 1, width: '100%' }} title={`Recall: ${p.d.retention}%, Avg Time: ${timeStr}, Reviews: ${p.d.reviews}`} />
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--md-text)', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                                        {bucketLabel}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Component that renders an SVG line chart correlating recall accuracy with time-of-day study buckets.
 */
export class ReviewTimeAnalytics {
    /** Statistical calculation engine reference. */
    dataUtils: DataUtils;

    /** Map of bucket identifier keys to localized display labels with hour spans. */
    readonly nameMap: Record<string, string> = TIME_OF_DAY_BUCKET_NAMES;

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
            const container = resolveContainer(containerId);
            if (!container) return;

            const timeInsights = this.dataUtils ? this.dataUtils.getReviewTimeInsights() : { hasTimeData: false, data: [] };

            preactRender(
                <ReviewTimeAnalyticsView timeInsights={timeInsights} />,
                container
            );
        } catch (err) {
            UIUtils.catchError('ReviewTimeAnalytics', 'Error rendering ReviewTimeAnalytics', err, { containerId });
        }
    }

    /**
     * Identifies the time bucket(s) achieving the highest recall retention (min 5 reviews).
     */
    findBestBuckets(data: ReviewTimeBucketItem[]): { bestBuckets: ReviewTimeBucketItem[]; bestRetention: number } {
        return findBestBuckets(data);
    }

    /**
     * Synthesizes user-facing summary text highlighting the most effective study period.
     */
    buildHighlightText(bestBuckets: ReviewTimeBucketItem[], bestRetention: number): string {
        return buildHighlightText(bestBuckets, bestRetention, this.nameMap);
    }
}
