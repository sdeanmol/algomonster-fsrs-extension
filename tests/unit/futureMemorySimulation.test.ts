import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { FutureMemorySimulation } from '../../features/dashboard/analytics/memory/futureMemorySimulation';
import { DataUtils } from '../../features/dashboard/analytics/utils/dataUtils';

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
  });

  it('returns gracefully if container is missing or errors occur', () => {
    expect(() => simComponent.render('non-existent-container')).not.toThrow();
  });
});
