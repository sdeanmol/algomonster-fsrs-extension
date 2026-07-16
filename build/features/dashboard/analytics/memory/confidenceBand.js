export class ConfidenceBand {
    /**
     * Renders an SVG polygon representing a confidence interval around a curve.
     * @param {Array} points Array of {x, y, R} points
     * @param {string} color Hex color string
     * @param {number} n Sample size to determine confidence width (heuristic)
     * @returns {string} SVG polygon element string
     */
    static renderBand(points, color, n) {
        if (points.length < 2 || n < 1) return '';

        // Simple heuristic for confidence band width based on sample size
        // Smaller n = wider band
        const marginBase = Math.max(0.02, Math.min(0.1, 5 / Math.sqrt(n))); 
        
        // We'll create top and bottom paths, then combine them into a polygon
        const topPoints = [];
        const bottomPoints = [];

        points.forEach(p => {
            // Margin expands as time goes on (less certainty)
            const margin = marginBase * (1 + (p.t / 30));
            
            const rTop = Math.min(1.0, p.R + margin);
            const rBot = Math.max(0.0, p.R - margin);

            // y goes down as R goes up, so top y is smaller
            // Re-using the same scale logic approximately
            // Y_scale = padT + (1 - r) * chartH;
            // Since we don't have chartH directly, we'll calculate relative to p.y
            
            // To get accurate Y coordinates without passing scales, we approximate:
            // if y = padT + (1-R)*chartH, then dy/dR = -chartH.
            // chartH = svgH - padT - padB = 250 - 20 - 40 = 190. (Hardcoded from retentionChart)
            const chartH = 190;
            
            const dyTop = (rTop - p.R) * -chartH;
            const dyBot = (rBot - p.R) * -chartH;

            topPoints.push(`${p.x},${p.y + dyTop}`);
            bottomPoints.unshift(`${p.x},${p.y + dyBot}`); // Unshift to reverse order for polygon
        });

        const polygonPoints = [...topPoints, ...bottomPoints].join(' ');
        
        // Convert hex to rgb for opacity (naive)
        // Assume hex is like #a8c7fa
        return `<polygon points="${polygonPoints}" fill="${color}" opacity="0.15" class="confidence-band" />`;
    }
}
