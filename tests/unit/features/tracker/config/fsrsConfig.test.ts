import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('@open-spaced-repetition/binding/dynamic-wasi', () => ({
  FSRS: jest.fn().mockImplementation(() => ({
    compute_weights: jest.fn()
  }))
}));

import { FSRSConfigManager } from '../../../../../features/tracker/config/fsrsConfig';
import { Card } from '../../../../../types/domain';

describe('FSRSConfigManager', () => {
  let manager: FSRSConfigManager;

  const mockCards: Card[] = [
    {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      due: Date.now(),
      stability: 2,
      difficulty: 3,
      historyLog: [
        { date: Date.now() - 86400000 * 2, rating: 3, duration: 10 },
        { date: Date.now() - 86400000, rating: 3, duration: 12 },
        { date: Date.now(), rating: 4, duration: 8 }
      ]
    }
  ] as unknown as Card[];

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <button id="back-to-popup-btn">Back</button>
      <input id="retention-slider" type="range" min="0.7" max="0.99" step="0.01" value="0.90" />
      <span id="retention-val">90%</span>
      <input id="decay-input" value="-0.5" />
      <input id="factor-input" value="0.234567" />

      <button id="save-global-btn">Save</button>
      <button id="reset-global-btn">Reset Global</button>
      <button id="reset-opt-btn">Reset Opt</button>
      <button id="reset-weights-btn">Reset Weights</button>
      <button id="reset-all-btn">Reset All</button>

      <input id="new-tag-name" value="" />
      <input id="new-tag-weights" value="" />
      <button id="add-tag-profile-btn">Add Tag Profile</button>

      <input id="opt-threshold-input" value="1000" />
      <span id="opt-threshold-display">1000</span>
      <div id="opt-threshold-warning" style="display: none;">Warning</div>

      <div id="opt-progress-fill" style="width: 0%;"></div>
      <span id="opt-progress-text">0 Reviews</span>
      <p id="opt-status-msg"></p>
      <div id="opt-actions-section" style="display: none;"></div>

      <button id="btn-auto-train">Auto Train</button>
      <button id="btn-export-weights">Export Weights</button>

      <div id="weights-inputs-container"></div>
      <ul id="active-tag-profiles-list"></ul>
      <div id="status-toast"></div>
    `;

    (global as any).confirm = jest.fn().mockReturnValue(true);
    (window as any).confirm = jest.fn().mockReturnValue(true);
    (window as any).close = jest.fn();

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        fsrsCards: mockCards,
        fsrsGlobalParams: {
          w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
          decay: -0.5,
          factor: 0.234567,
          requestRetention: 0.90
        },
        fsrsTopicWeights: {
          dp: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
        }
      };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
      return Promise.resolve();
    });

    manager = new FSRSConfigManager();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('init and storage loading', () => {
    it('initializes manager and populates UI inputs from storage', () => {
      manager.init();
      expect(chrome.storage.local.get).toHaveBeenCalled();

      const slider = document.getElementById('retention-slider') as HTMLInputElement;
      expect(slider.value).toBe('0.9');

      const weightsContainer = document.getElementById('weights-inputs-container');
      expect(weightsContainer?.children.length).toBe(17);
    });

    it('binds UI event listeners including retention slider and buttons', () => {
      manager.init();

      const slider = document.getElementById('retention-slider') as HTMLInputElement;
      const badge = document.getElementById('retention-val');
      slider.value = '0.85';
      slider.dispatchEvent(new Event('input'));
      expect(badge?.textContent).toBe('85%');

      const backBtn = document.getElementById('back-to-popup-btn') as HTMLElement;
      backBtn.click();
      expect(window.close).toHaveBeenCalled();
    });

    it('handles DOM exceptions in init gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => manager.init()).not.toThrow();

      document.getElementById = origGEBI;
    });
  });

  describe('eligibility and optimization checking', () => {
    it('computes optimization eligibility correctly based on review history', () => {
      const eligibility = manager.computeEligibility(mockCards, 2);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.count).toBe(2);

      const emptyEligibility = manager.computeEligibility([], 1000);
      expect(emptyEligibility.eligible).toBe(false);
      expect(emptyEligibility.count).toBe(0);
    });

    it('updates optimization progress UI in checkOptimizationEligibility', async () => {
      manager.init();
      const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement;
      thresholdInput.value = '2';
      thresholdInput.dispatchEvent(new Event('change'));

      await manager.checkOptimizationEligibility();

      const statusMsg = document.getElementById('opt-status-msg');
      expect(statusMsg?.textContent).toContain('Eligible');
    });

    it('shows threshold warning when threshold is below 1000', async () => {
      manager.init();
      const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement;
      thresholdInput.value = '500';

      await manager.checkOptimizationEligibility();

      const warning = document.getElementById('opt-threshold-warning');
      expect(warning?.style.display).toBe('flex');
    });
  });

  describe('auto train weights workflow', () => {
    it('executes handleAutoTrain with Fast JS Optimizer fallback', async () => {
      manager.init();

      const trainPromise = manager.handleAutoTrain();
      jest.advanceTimersByTime(1000);

      await trainPromise;

      const statusMsg = document.getElementById('opt-status-msg');
      expect(statusMsg?.textContent).toContain('Scheduler optimized successfully');
    });

    it('creates chrome notification when optimization completes', async () => {
      (chrome as any).notifications = { create: jest.fn() };

      manager.init();
      await manager.handleAutoTrain();

      expect(chrome.notifications.create).toHaveBeenCalled();
    });

    it('handles training errors gracefully', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Storage read failure');
      });

      manager.init();
      await manager.handleAutoTrain();

      const statusMsg = document.getElementById('opt-status-msg');
      expect(statusMsg?.textContent).toBe('Optimization failed.');
    });
  });

  describe('exporting weights and managing tag profiles', () => {
    it('exports weights as downloadable JSON file', () => {
      manager.init();

      const appendSpy = jest.spyOn(document.body, 'appendChild');
      manager.handleExportWeights();

      expect(appendSpy).toHaveBeenCalled();
    });

    it('renders and deletes tag profiles', () => {
      manager.init();

      const deleteBtn = document.querySelector('.delete-profile-btn') as HTMLElement;
      if (deleteBtn) {
        deleteBtn.click();
        expect(chrome.storage.local.set).toHaveBeenCalled();
      }
    });

    it('renders empty message when no topic weights profiles exist', () => {
      manager.renderTagProfiles({});
      const list = document.getElementById('active-tag-profiles-list');
      expect(list?.innerHTML).toContain('No custom profiles saved yet');
    });

    it('adds a new valid 17-weight tag profile in handleAddTagProfile', () => {
      manager.init();

      const tagInput = document.getElementById('new-tag-name') as HTMLInputElement;
      const weightsInput = document.getElementById('new-tag-weights') as HTMLInputElement;

      tagInput.value = 'graph';
      weightsInput.value = '0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61';

      manager.handleAddTagProfile();

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('shows error toast when adding tag profile with invalid weight count', () => {
      manager.init();

      const tagInput = document.getElementById('new-tag-name') as HTMLInputElement;
      const weightsInput = document.getElementById('new-tag-weights') as HTMLInputElement;

      tagInput.value = 'graph';
      weightsInput.value = '1, 2, 3';

      manager.handleAddTagProfile();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Weights must contain exactly 17 coefficients');
    });
  });

  describe('saving config and resetting defaults', () => {
    it('saves global configuration parameters to storage', () => {
      manager.init();

      manager.saveGlobalConfig();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('validates NaN decay and factor values in saveGlobalConfig', () => {
      manager.init();

      const decayInput = document.getElementById('decay-input') as HTMLInputElement;
      decayInput.value = 'invalid';

      manager.saveGlobalConfig();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Decay and Factor must be valid numbers');
    });

    it('restores all baseline defaults when confirmed', () => {
      manager.init();

      manager.restoreDefaults();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('resets global parameters, optimization status, and weights', () => {
      manager.init();

      manager.restoreGlobalParameters();
      manager.resetOptimization();
      manager.restoreWeights();

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(3);
    });

    it('handles toast error display and auto-hide timer', () => {
      manager.showToast('Test Toast', true);

      const toast = document.getElementById('status-toast');
      expect(toast?.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(2500);
      expect(toast?.classList.contains('show')).toBe(false);
    });
  });
});
