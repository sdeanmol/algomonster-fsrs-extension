/**
 * @file features/dashboard/analytics/memory/confidenceBand.ts
 * @description Helper class for rendering SVG confidence interval bands around retention decay curves.
 */

import { UIUtils } from '../../../common/utils/uiUtils';

export interface PointR {
    t: number;
    R: number;
    x: number;
    y: number;
}

export class ConfidenceBand {
    /**
     * Renders an SVG polygon representing a confidence interval around a curve.
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
