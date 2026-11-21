import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';

jest.mock('@open-spaced-repetition/binding/dynamic-wasi', () => ({
  FSRS: jest.fn().mockImplementation(() => ({
    compute_weights: jest.fn()
  }))
}));

import { FSRSConfigManager, FSRSConfigApp } from '../../../../../features/tracker/config/fsrsConfig';
import { Card } from '../../../../../types/domain';

describe('FSRSConfigManager & FSRSConfigApp', () => {
  let manager: FSRSConfigManager;
  let container: HTMLDivElement;

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

  const flush = async () => {
    await Promise.resolve();
    jest.advanceTimersByTime(20);
    await Promise.resolve();
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);

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
    manager.init();
    await flush();
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    document.body.innerHTML = '';
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('init and storage loading', () => {
    it('initializes manager and populates UI inputs from storage', async () => {
      expect(chrome.storage.local.get).toHaveBeenCalled();

      const slider = document.getElementById('retention-slider') as HTMLInputElement;
      expect(slider.value).toBe('0.9');

      const weightsContainer = document.getElementById('weights-inputs-container');
      expect(weightsContainer?.children.length).toBe(17);
    });

    it('binds UI event listeners including retention slider and buttons', async () => {
      const slider = document.getElementById('retention-slider') as HTMLInputElement;
      const badge = document.getElementById('retention-val');
      slider.value = '0.85';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
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

    it('handles storage lastError in loadFSRSConfig gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb: any) => {
        (chrome.runtime as any).lastError = { message: 'Load error' };
        if (cb) cb({});
      });

      expect(() => manager.loadFSRSConfig()).not.toThrow();
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
      const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement;
      thresholdInput.value = '2';
      thresholdInput.dispatchEvent(new Event('input', { bubbles: true }));

      await manager.checkOptimizationEligibility();
      await flush();

      const statusMsg = document.getElementById('opt-status-msg');
      expect(statusMsg?.textContent).toContain('Eligible');
    });

    it('shows threshold warning when threshold is below 1000', async () => {
      const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement;
      thresholdInput.value = '500';
      thresholdInput.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();

      await manager.checkOptimizationEligibility();
      await flush();

      const warning = document.getElementById('opt-threshold-warning');
      expect(warning?.style.display).toBe('flex');
    });
  });

  describe('auto train weights workflow', () => {
    it('executes handleAutoTrain with Fast JS Optimizer fallback', async () => {
      const trainPromise = manager.handleAutoTrain();
      jest.advanceTimersByTime(1000);

      await trainPromise;
      await flush();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Personal memory optimization successful');
    });

    it('creates chrome notification when optimization completes', async () => {
      (chrome as any).notifications = { create: jest.fn() };

      await manager.handleAutoTrain();
      await flush();

      expect(chrome.notifications.create).toHaveBeenCalled();
    });

    it('handles training errors gracefully', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Storage read failure');
      });

      await manager.handleAutoTrain();
      await flush();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Optimization failed');
    });
  });

  describe('exporting weights and managing tag profiles', () => {
    it('exports weights as downloadable JSON file', () => {
      const appendSpy = jest.spyOn(document.body, 'appendChild');
      manager.handleExportWeights();

      expect(appendSpy).toHaveBeenCalled();
    });

    it('renders and deletes tag profiles', async () => {
      const deleteBtn = document.querySelector('.delete-profile-btn') as HTMLElement;
      if (deleteBtn) {
        deleteBtn.click();
        await flush();
        expect(chrome.storage.local.set).toHaveBeenCalled();
      }
    });

    it('renders empty message when no topic weights profiles exist', async () => {
      manager.renderTagProfiles({});
      await flush();
      const list = document.getElementById('active-tag-profiles-list');
      expect(list?.innerHTML).toContain('No custom profiles saved yet');
    });

    it('adds a new valid 17-weight tag profile in handleAddTagProfile', async () => {
      const tagInput = document.getElementById('new-tag-name') as HTMLInputElement;
      const weightsInput = document.getElementById('new-tag-weights') as HTMLInputElement;

      tagInput.value = 'graph';
      tagInput.dispatchEvent(new Event('input', { bubbles: true }));
      weightsInput.value = '0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61';
      weightsInput.dispatchEvent(new Event('input', { bubbles: true }));

      manager.handleAddTagProfile();
      await flush();

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('shows error toast when adding tag profile with invalid weight count or empty tag', async () => {
      const tagInput = document.getElementById('new-tag-name') as HTMLInputElement;
      const weightsInput = document.getElementById('new-tag-weights') as HTMLInputElement;

      // Empty tag name
      tagInput.value = '';
      tagInput.dispatchEvent(new Event('input', { bubbles: true }));
      weightsInput.value = '1, 2';
      weightsInput.dispatchEvent(new Event('input', { bubbles: true }));
      manager.handleAddTagProfile();
      await flush();

      // Invalid weight count
      tagInput.value = 'graph';
      tagInput.dispatchEvent(new Event('input', { bubbles: true }));
      weightsInput.value = '1, 2, 3';
      weightsInput.dispatchEvent(new Event('input', { bubbles: true }));
      manager.handleAddTagProfile();
      await flush();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Weights must contain exactly 17 coefficients');
    });

    it('handles confirm false during handleDeleteTagProfile', () => {
      (window as any).confirm.mockReturnValue(false);

      expect(() => manager.handleDeleteTagProfile('dp')).not.toThrow();
    });
  });

  describe('saving config and resetting defaults', () => {
    it('saves global configuration parameters to storage', async () => {
      manager.saveGlobalConfig();
      await flush();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('validates NaN decay and factor values in saveGlobalConfig', async () => {
      const decayInput = document.getElementById('decay-input') as HTMLInputElement;
      decayInput.value = 'invalid';
      decayInput.dispatchEvent(new Event('input', { bubbles: true }));

      manager.saveGlobalConfig();
      await flush();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Decay and Factor must be valid numbers');
    });

    it('restores all baseline defaults when confirmed', async () => {
      manager.restoreDefaults();
      await flush();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('handles confirm false during restoreDefaults, restoreGlobalParameters, resetOptimization, restoreWeights', () => {
      (window as any).confirm.mockReturnValue(false);

      manager.restoreDefaults();
      manager.restoreGlobalParameters();
      manager.resetOptimization();
      manager.restoreWeights();
    });

    it('resets global parameters, optimization status, and weights when confirmed', async () => {
      manager.restoreGlobalParameters();
      manager.resetOptimization();
      manager.restoreWeights();
      await flush();

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(3);
    });

    it('handles toast error display and auto-hide timer', async () => {
      manager.showToast('Test Toast', true);
      await flush();

      const toast = document.getElementById('status-toast');
      expect(toast?.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(2500);
      await flush();
      expect(toast?.classList.contains('show')).toBe(false);
    });

    it('handles internal method errors gracefully across all config methods', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => null;

      expect(() => manager.bindEvents()).not.toThrow();
      expect(() => manager.saveGlobalConfig()).not.toThrow();
      expect(() => manager.restoreGlobalParameters()).not.toThrow();
      expect(() => manager.restoreDefaults()).not.toThrow();
      expect(() => manager.restoreWeights()).not.toThrow();
      expect(() => manager.resetOptimization()).not.toThrow();
      expect(() => manager.renderTagProfiles(null as any)).not.toThrow();
      expect(() => manager.handleAddTagProfile()).not.toThrow();
      expect(() => manager.handleDeleteTagProfile('tag')).not.toThrow();
      expect(() => manager.handleExportWeights()).not.toThrow();
      expect(() => manager.computeEligibility(null as any, 10)).not.toThrow();
      expect(() => manager.checkOptimizationEligibility()).not.toThrow();
      expect(() => manager.showToast('err', true)).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('UX-013: switches between Simple and Advanced modes and handles preset chips', async () => {
      const simpleBtn = document.getElementById('mode-simple-btn') as HTMLElement;
      const advancedBtn = document.getElementById('mode-advanced-btn') as HTMLElement;
      const advSection = document.querySelector('.advanced-config-only') as HTMLElement;
      const slider = document.getElementById('retention-slider') as HTMLInputElement;
      const badge = document.getElementById('retention-val') as HTMLElement;

      expect(manager.currentMode).toBe('simple');
      expect(advSection.style.display).toBe('none');

      // Click Advanced mode
      advancedBtn.click();
      await flush();
      expect(manager.currentMode).toBe('advanced');
      expect(advSection.style.display).toBe('');
      expect(advancedBtn.classList.contains('active')).toBe(true);
      expect(simpleBtn.classList.contains('active')).toBe(false);

      // Click Simple mode
      simpleBtn.click();
      await flush();
      expect(manager.currentMode).toBe('simple');
      expect(advSection.style.display).toBe('none');
      expect(simpleBtn.classList.contains('active')).toBe(true);
      expect(advancedBtn.classList.contains('active')).toBe(false);

      // Click preset chip (Relaxed 80%)
      const relaxedChip = document.querySelector('.preset-chip[data-retention="0.8"]') as HTMLElement;
      relaxedChip.click();
      await flush();
      expect(slider.value).toBe('0.8');
      expect(badge.textContent).toBe('80%');
      expect(relaxedChip.classList.contains('active')).toBe(true);
    });
  });
});
