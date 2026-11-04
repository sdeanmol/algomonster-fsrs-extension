/**
 * @file features/dashboard/analytics/memory/confidenceBand.tsx
 * @description Helper class and Preact component for calculating and rendering semi-transparent SVG polygon confidence interval
 * bands around retention decay curves, reflecting statistical sample size variance.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, FunctionalComponent } from 'preact';
import { UIUtils } from '../../../common/utils/uiUtils';

/**
 * Geometric coordinates and memory parameters for a single point along a retention decay curve.
 */
export interface PointR {
    /** Elapsed time offset in days */
    t: number;
    /** Retrievability value (probability of recall between 0.0 and 1.0) */
    R: number;
    /** Scaled X coordinate within the SVG viewBox */
    x: number;
    /** Scaled Y coordinate within the SVG viewBox */
    y: number;
}

export interface ConfidenceBandPolygonProps {
    points: PointR[];
    color: string;
    n: number;
}

export const ConfidenceBandPolygon: FunctionalComponent<ConfidenceBandPolygonProps> = ({ points, color, n }) => {
    if (!points || points.length < 2 || n < 1) return null;

    try {
        const marginBase = Math.max(0.02, Math.min(0.1, 5 / Math.sqrt(n))); 
        const topPoints: string[] = [];
        const bottomPoints: string[] = [];

        points.forEach(p => {
            const margin = marginBase * (1 + (p.t / 30));
            const rTop = Math.min(1.0, p.R + margin);
            const rBot = Math.max(0.0, p.R - margin);
            const chartH = 190;
            const dyTop = (rTop - p.R) * -chartH;
            const dyBot = (rBot - p.R) * -chartH;

            topPoints.push(`${p.x},${p.y + dyTop}`);
            bottomPoints.unshift(`${p.x},${p.y + dyBot}`);
        });

        const polygonPoints = [...topPoints, ...bottomPoints].join(' ');
        return <polygon points={polygonPoints} fill={color} opacity="0.15" class="confidence-band" />;
    } catch {
        return null;
    }
};

/**
 * Utility for generating SVG polygons representing statistical confidence intervals
 * surrounding retention decay curves based on sample size (n).
 */
export class ConfidenceBand {
    /**
     * Renders an SVG polygon element representing an empirical confidence interval around a retention curve.
     * Computes top and bottom envelope bounds where margin narrows with larger sample sizes (n).
     * @param points - Array of calculated retention coordinates along the curve.
     * @param color - Fill color for the semi-transparent polygon (e.g. hex or CSS variable).
     * @param n - Number of cards represented in this curve group (determines interval width).
     * @returns Rendered SVG polygon element string, or empty string if invalid input.
     */
    static renderBand(points: PointR[], color: string, n: number): string {
        try {
            if (!points || points.length < 2 || n < 1) return '';

            const marginBase = Math.max(0.02, Math.min(0.1, 5 / Math.sqrt(n))); 
            
            const topPoints: string[] = [];
            const bottomPoints: string[] = [];

            points.forEach(p => {
                const margin = marginBase * (1 + (p.t / 30));
                
                const rTop = Math.min(1.0, p.R + margin);
                const rBot = Math.max(0.0, p.R - margin);

                const chartH = 190;
                
                const dyTop = (rTop - p.R) * -chartH;
                const dyBot = (rBot - p.R) * -chartH;

                topPoints.push(`${p.x},${p.y + dyTop}`);
                bottomPoints.unshift(`${p.x},${p.y + dyBot}`);
            });

            const polygonPoints = [...topPoints, ...bottomPoints].join(' ');
            
            return `<polygon points="${polygonPoints}" fill="${color}" opacity="0.15" class="confidence-band" />`;
        } catch (err) {
            UIUtils.catchError('ConfidenceBand', 'Error rendering confidence band polygon', err, { color, n });
            // Return empty string fallback on non-fatal SVG rendering failure
            return '';
        }
    }
}

