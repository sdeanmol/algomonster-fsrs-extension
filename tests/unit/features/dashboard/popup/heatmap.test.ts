import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HeatmapComponent } from '../../../../../features/dashboard/popup/heatmap';
import { DashboardCoordinator } from '../../../../../features/dashboard/popup/DashboardComponent';

describe('HeatmapComponent (Popup)', () => {
  let component: HeatmapComponent;
  let mockCoordinator: DashboardCoordinator;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="heatmap-grid" style="scroll-left: 0;"></div>
      <button id="toggle-lifetime-btn"></button>
    `;

    mockCoordinator = {
      showStatus: jest.fn()
    };

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any) => {
      return Promise.resolve({
        fsrsActivity: {
          '2026-08-01': 1,
          '2026-08-02': 4,
          '2026-08-03': 10,
          '2025-10-10': 2
        }
      });
    });

    component = new HeatmapComponent(mockCoordinator);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('load', () => {
    it('returns early if heatmap-grid container element is missing', async () => {
      document.body.innerHTML = '';
      await expect(component.load(false)).resolves.not.toThrow();
    });

    it('renders recent 12 weeks heat cells by default', async () => {
      await component.load(false);

      const grid = document.getElementById('heatmap-grid');
      expect(grid?.children.length).toBeGreaterThan(0);
    });

    it('renders lifetime heat cells when lifetime flag is true', async () => {
      await component.load(true);

      const grid = document.getElementById('heatmap-grid');
      expect(grid?.children.length).toBeGreaterThan(0);
    });

    it('handles exception during load gracefully', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.reject(new Error('Storage failure'));
      });

      await expect(component.load(false)).resolves.not.toThrow();
    });
  });

  describe('bindEvents', () => {
    it('toggles lifetime view when toggle-lifetime-btn is clicked', async () => {
      component.bindEvents();

      const btn = document.getElementById('toggle-lifetime-btn');
      btn?.click();

      expect(component.isLifetimeView).toBe(true);
    });

    it('handles exception inside bindEvents listener handler', () => {
      component.bindEvents();
      (component as any).load = jest.fn().mockImplementation(() => {
        throw new Error('Load error');
      });

      const btn = document.getElementById('toggle-lifetime-btn');
      expect(() => btn?.click()).not.toThrow();
    });
  });
});
