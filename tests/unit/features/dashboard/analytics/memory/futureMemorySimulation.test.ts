import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { FutureMemorySimulation } from '../../../../../../features/dashboard/analytics/memory/futureMemorySimulation';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';

describe('FutureMemorySimulation Component', () => {
  let dataUtils: DataUtils;
  let simComponent: FutureMemorySimulation;
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'tab-simulation';
    document.body.appendChild(container);

    dataUtils = new DataUtils([], {}, null);
    simComponent = new FutureMemorySimulation(dataUtils);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes with default slider days', () => {
    expect(simComponent.sliderDays).toBe(45);
  });

  it('renders simulation panel into target container element', () => {
    simComponent.render('tab-simulation');
    expect(container.innerHTML).toContain('Future Memory Simulation');
    expect(container.innerHTML).toContain('Simulate zero reviews for:');
    expect(container.querySelector('#sim-days-range')).not.toBeNull();
  });

  it('renders varied retention thresholds (good, warning, danger, forgotten count)', () => {
    // 1. High retention (good threshold >= 90)
    jest.spyOn(dataUtils, 'getFutureMemorySimulation').mockReturnValue({
      today: 95,
      d30: 92,
      d90: 90,
      d180: 85,
      custom: { days: 45, retention: 91, forgottenCount: 0 },
      totalCards: 10,
      curvePoints: [{ day: 0, retention: 95 }, { day: 180, retention: 85 }]
    } as any);

    simComponent.render('tab-simulation');
    expect(container.innerHTML).toContain('text-success');
    expect(container.innerHTML).toContain('fill-success');

    // 2. Warning retention threshold (75-89%) and forgotten count > 0
    jest.spyOn(dataUtils, 'getFutureMemorySimulation').mockReturnValue({
      today: 80,
      d30: 78,
      d90: 76,
      d180: 75,
      custom: { days: 45, retention: 77, forgottenCount: 3 },
      totalCards: 10,
      curvePoints: [{ day: 0, retention: 80 }, { day: 180, retention: 75 }]
    } as any);

    simComponent.render('tab-simulation');
    expect(container.innerHTML).toContain('text-warning');
    expect(container.innerHTML).toContain('fill-warning');
    expect(container.innerHTML).toContain('3 / 10 cards');

    // 3. Danger retention threshold (< 75%)
    jest.spyOn(dataUtils, 'getFutureMemorySimulation').mockReturnValue({
      today: 60,
      d30: 50,
      d90: 40,
      d180: 30,
      custom: { days: 45, retention: 45, forgottenCount: 8 },
      totalCards: 10,
      curvePoints: [{ day: 0, retention: 60 }, { day: 180, retention: 30 }]
    } as any);

    simComponent.render('tab-simulation');
    expect(container.innerHTML).toContain('text-danger');
    expect(container.innerHTML).toContain('fill-danger');
  });

  it('generates curve SVG paths accurately', () => {
    const points = [
      { day: 0, retention: 100 },
      { day: 30, retention: 85 },
      { day: 180, retention: 40 }
    ];

    const result = simComponent.generateCurveSvgPath(points, 85);
    expect(result.svgPathD).toContain('M');
    expect(result.areaPathD).toContain('Z');
    expect(result.currentX).toBeGreaterThan(0);
  });

  it('handles input events on range slider', () => {
    simComponent.render('tab-simulation');
    const slider = container.querySelector('#sim-days-range') as HTMLInputElement;

    slider.value = '90';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    expect(simComponent.sliderDays).toBe(90);

    slider.value = 'invalid';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(simComponent.sliderDays).toBe(90);
  });

  it('handles empty curve points in generateCurveSvgPath', () => {
    const result = simComponent.generateCurveSvgPath([], 50);
    expect(result.svgPathD).toContain('M');
    expect(result.areaPathD).toContain('Z');
    expect(result.currentX).toBeGreaterThan(0);
  });

  it('handles error in generateCurveSvgPath with fallback return', () => {
    const throwingPoint = [{ get day() { throw new Error('Getter error'); }, retention: 50 }];
    const result = simComponent.generateCurveSvgPath(throwingPoint as any, 50);
    expect(result.svgPathD).toBe('M50,20 L880,210');
    expect(result.areaPathD).toContain('Z');
  });

  it('handles exception in render method gracefully', () => {
    jest.spyOn(dataUtils, 'getFutureMemorySimulation').mockImplementationOnce(() => {
      throw new Error('Simulation Error');
    });

    expect(() => simComponent.render('tab-simulation')).not.toThrow();
  });

  it('handles exception in range slider input listener gracefully', () => {
    simComponent.render('tab-simulation');
    const slider = container.querySelector('#sim-days-range') as HTMLInputElement;

    jest.spyOn(simComponent, 'render').mockImplementationOnce(() => {
      throw new Error('Render Error');
    });

    slider.value = '60';
    expect(() => slider.dispatchEvent(new Event('input', { bubbles: true }))).not.toThrow();
  });

  it('handles exception in bindEvents gracefully', () => {
    const origGEBI = document.getElementById;
    document.getElementById = () => { throw new Error('GEBI error'); };

    expect(() => simComponent.bindEvents()).not.toThrow();

    document.getElementById = origGEBI;
  });

  it('returns gracefully if container is missing or errors occur', () => {
    expect(() => simComponent.render('non-existent-container')).not.toThrow();
  });
});
