import { describe, it, expect } from '@jest/globals';
import { ConfidenceBand, PointR } from '../../../../../../features/dashboard/analytics/memory/confidenceBand';

describe('ConfidenceBand', () => {
  it('returns empty string for invalid points array or sample count n < 1', () => {
    expect(ConfidenceBand.renderBand([], '#a8c7fa', 10)).toBe('');
    expect(ConfidenceBand.renderBand([{ t: 0, R: 1, x: 10, y: 10 }], '#a8c7fa', 10)).toBe('');
    expect(ConfidenceBand.renderBand([{ t: 0, R: 1, x: 10, y: 10 }, { t: 10, R: 0.8, x: 50, y: 30 }], '#a8c7fa', 0)).toBe('');
  });

  it('renders SVG polygon element with calculated coordinates', () => {
    const points: PointR[] = [
      { t: 0, R: 1.0, x: 50, y: 20 },
      { t: 15, R: 0.85, x: 200, y: 50 },
      { t: 30, R: 0.70, x: 350, y: 90 }
    ];

    const svgPolygon = ConfidenceBand.renderBand(points, '#a8c7fa', 25);
    expect(svgPolygon).toContain('<polygon points=');
    expect(svgPolygon).toContain('fill="#a8c7fa"');
    expect(svgPolygon).toContain('class="confidence-band"');
  });

  it('catches invalid calculation errors and returns fallback empty string', () => {
    const invalidPoint: any = {
      get t() {
        throw new Error('Point error');
      }
    };
    expect(ConfidenceBand.renderBand([invalidPoint, invalidPoint], '#a8c7fa', 10)).toBe('');
  });
});
