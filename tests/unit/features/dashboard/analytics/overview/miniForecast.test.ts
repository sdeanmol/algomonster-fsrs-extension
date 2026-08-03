import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MiniForecast } from '../../../../../../features/dashboard/analytics/overview/miniForecast';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';
import { Card } from '../../../../../../types/domain';

describe('MiniForecast', () => {
  let mockDataUtils: DataUtils;
  let component: MiniForecast;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="mini-forecast-container"></div>';

    (chrome as any).runtime = {
      getURL: jest.fn().mockImplementation((path: any) => `chrome-extension://mock-id/${path}`),
      lastError: undefined
    };

    (chrome as any).tabs = {
      create: jest.fn().mockImplementation((options: any, cb?: any) => {
        if (cb) cb({ id: 3 });
      })
    };

    const now = Date.now();
    mockDataUtils = {
      cards: [
        { id: 'c1', due: now - 86400000 }, // past due
        { id: 'c2', due: now + 86400000 }, // day 1
        { id: 'c3', due: now + 86400000 * 2 }, // day 2
        { id: 'c4', due: now + 86400000 * 2 },
        { id: 'c5', due: now + 86400000 * 2 },
        { id: 'c6', due: now + 86400000 * 2 }, // day 2 count = 4 -> count-med
        { id: 'c7', due: now + 86400000 * 3 },
        { id: 'c8', due: now + 86400000 * 3 },
        { id: 'c9', due: now + 86400000 * 3 },
        { id: 'c10', due: now + 86400000 * 3 },
        { id: 'c11', due: now + 86400000 * 3 },
        { id: 'c12', due: now + 86400000 * 3 },
        { id: 'c13', due: now + 86400000 * 3 },
        { id: 'c14', due: now + 86400000 * 3 },
        { id: 'c15', due: now + 86400000 * 3 } // day 3 count = 9 -> count-high
      ] as Card[]
    } as unknown as DataUtils;

    component = new MiniForecast(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor', () => {
    it('initializes dataUtils property correctly', () => {
      expect(component.dataUtils).toBe(mockDataUtils);
    });

    it('handles constructor exception gracefully', () => {
      const faultyInit = () => new MiniForecast(null as any);
      expect(faultyInit).not.toThrow();
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('mini-forecast-container')).not.toThrow();
    });

    it('renders 7-day forecast cards with count classes count-low, count-med, count-high', () => {
      component.render('mini-forecast-container');

      const container = document.getElementById('mini-forecast-container');
      expect(container?.innerHTML).toContain('Upcoming Reviews');
      expect(container?.innerHTML).toContain('count-low');
      expect(container?.innerHTML).toContain('count-med');
      expect(container?.innerHTML).toContain('count-high');
    });

    it('handles full 30-day forecast link click to open full forecast tab', () => {
      component.render('mini-forecast-container');

      const fullLink = document.getElementById('full-forecast-link');
      expect(fullLink).not.toBeNull();

      fullLink?.click();
      expect(chrome.tabs.create).toHaveBeenCalled();
    });

    it('handles exception in full forecast link click listener', () => {
      component.render('mini-forecast-container');
      (chrome.tabs.create as jest.Mock).mockImplementation(() => {
        throw new Error('Create tab error');
      });

      const fullLink = document.getElementById('full-forecast-link');
      expect(() => fullLink?.click()).not.toThrow();
    });

    it('handles forecast day card click to open data tab with forecast filters', () => {
      component.render('mini-forecast-container');

      const dayCard = document.querySelector('.forecast-day-card') as HTMLElement;
      expect(dayCard).not.toBeNull();

      dayCard.click();
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('view=forecast') })
      );
    });

    it('handles exception in day card click listener', () => {
      component.render('mini-forecast-container');
      (chrome.tabs.create as jest.Mock).mockImplementation(() => {
        throw new Error('Day card tab error');
      });

      const dayCard = document.querySelector('.forecast-day-card') as HTMLElement;
      expect(() => dayCard?.click()).not.toThrow();
    });

    it('handles invalid card due date during calculation gracefully', () => {
      mockDataUtils.cards.push({ id: 'cErr', due: 'invalid-date' as any } as Card);
      expect(() => component.render('mini-forecast-container')).not.toThrow();
    });

    it('handles exception in render gracefully', () => {
      (mockDataUtils as any).cards = {
        forEach: () => { throw new Error('Cards error'); }
      };

      expect(() => component.render('mini-forecast-container')).not.toThrow();
    });
  });
});
