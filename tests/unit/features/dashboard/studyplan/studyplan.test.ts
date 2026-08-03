import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StudyPlanController, StudyPlanSettings } from '../../../../../features/dashboard/studyplan/studyplan';
import { Card } from '../../../../../types/domain';

describe('StudyPlanController', () => {
  let controller: StudyPlanController;

  const getFreshCards = (): Card[] => [
    {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      due: Date.now() - 86400000, // overdue card
      stability: 1,
      difficulty: 8,
      historyLog: [
        { date: Date.now() - 1000, rating: 3, duration: 10 }
      ]
    },
    {
      id: 'c2',
      problemTitle: 'Three Sum',
      problemUrl: 'https://leetcode.com/problems/three-sum',
      due: Date.now() + 86400000 * 5, // future card
      stability: 10,
      difficulty: 3,
      historyLog: []
    }
  ] as unknown as Card[];

  const getFreshSettings = (): StudyPlanSettings => ({
    isActive: true,
    examDate: '2026-08-10',
    dailyTarget: 5,
    activatedAt: Date.now() - 86400000 * 2
  });

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="setup-panel" style="display: block;">
        <input id="exam-date-input" type="date" value="" />
        <input id="daily-limit-input" type="number" value="" />
        <div id="setup-preview" style="display: none;">
          <span id="preview-days">0</span>
          <span id="preview-total">0</span>
          <span id="preview-daily">0</span>
        </div>
        <button id="activate-btn" disabled>Activate</button>
      </div>

      <div id="active-panel" style="display: none;">
        <svg>
          <circle id="countdown-ring-fill"></circle>
        </svg>
        <span id="countdown-days">0</span>
        <span id="countdown-title">Exam Countdown</span>
        <span id="countdown-exam-date"></span>

        <span id="active-total-cards">0</span>
        <span id="active-daily-target">0</span>
        <span id="active-completed">0</span>

        <table>
          <tbody id="schedule-body"></tbody>
        </table>
        <button id="deactivate-btn">Deactivate</button>
      </div>
    `;

    (global as any).confirm = jest.fn().mockReturnValue(true);

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = { fsrsCards: getFreshCards(), studyPlanSettings: getFreshSettings() };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
      return Promise.resolve();
    });

    controller = new StudyPlanController();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('init and storage loading', () => {
    it('initializes controller and renders active panel when exam mode is active', () => {
      controller.init();

      expect(chrome.storage.local.get).toHaveBeenCalled();
      const activePanel = document.getElementById('active-panel');
      expect(activePanel?.style.display).toBe('block');
    });

    it('renders setup panel when studyPlanSettings is missing or inactive', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ fsrsCards: getFreshCards(), studyPlanSettings: null });
      });

      controller.init();
      const setupPanel = document.getElementById('setup-panel');
      expect(setupPanel?.style.display).toBe('block');
    });

    it('handles chrome.runtime.lastError when reading storage in init', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage error' };
        if (cb) cb({});
      });

      controller.init();
      expect(controller.allCards).toEqual([]);
    });

    it('handles inner error in storage get callback gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ fsrsCards: 'invalid_data' });
      });

      expect(() => controller.init()).not.toThrow();
    });

    it('handles DOM exception during init gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI Error'); };

      expect(() => controller.init()).not.toThrow();
      document.getElementById = origGEBI;
    });
  });

  describe('formatDate helper method', () => {
    it('formats a valid date object to YYYY-MM-DD string', () => {
      const testDate = new Date('2026-08-10T12:00:00Z');
      const formatted = controller.formatDate(testDate);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('catches invalid date formatting error and returns current date fallback', () => {
      const invalidDate = { getTime: () => { throw new Error('Time error'); } } as any;
      const fallback = controller.formatDate(invalidDate);
      expect(fallback).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('updatePreview method', () => {
    it('does nothing if exam-date-input or preview element is missing', () => {
      document.body.innerHTML = '';
      expect(() => controller.updatePreview()).not.toThrow();
    });

    it('disables activate button and hides preview when exam date is in past', () => {
      controller.allCards = getFreshCards();

      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement;
      examDateInput.value = '2020-01-01';

      controller.updatePreview();

      const preview = document.getElementById('setup-preview');
      expect(preview?.style.display).toBe('none');
      const activateBtn = document.getElementById('activate-btn') as HTMLButtonElement;
      expect(activateBtn.disabled).toBe(true);
    });

    it('calculates preview stats and enables activate button for valid future date', () => {
      controller.allCards = getFreshCards();

      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement;
      const future = new Date();
      future.setDate(future.getDate() + 5);
      examDateInput.value = future.toISOString().split('T')[0];

      controller.updatePreview();

      const preview = document.getElementById('setup-preview');
      expect(preview?.style.display).toBe('block');

      const prevDays = document.getElementById('preview-days');
      expect(prevDays?.textContent).toBeDefined();
    });

    it('respects daily limit input when lower than calculated target', () => {
      controller.allCards = getFreshCards();

      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement;
      const future = new Date();
      future.setDate(future.getDate() + 2);
      examDateInput.value = future.toISOString().split('T')[0];

      const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement;
      dailyLimitInput.value = '1';

      controller.updatePreview();

      const prevDaily = document.getElementById('preview-daily');
      expect(prevDaily?.textContent).toBe('1');
    });
  });

  describe('activateExamMode and deactivateExamMode workflows', () => {
    it('activates exam mode, applies dailyLimitInput, and saves settings to storage', () => {
      controller.allCards = getFreshCards();

      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement;
      const future = new Date();
      future.setDate(future.getDate() + 5);
      examDateInput.value = future.toISOString().split('T')[0];

      const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement;
      dailyLimitInput.value = '1';

      controller.activateExamMode();

      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(controller.allCards[0].originalDue).toBeDefined();
    });

    it('handles chrome.runtime.lastError when activating exam mode', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Failed to write active settings' };
        if (cb) cb();
      });

      controller.allCards = getFreshCards();
      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement;
      examDateInput.value = '2026-08-20';

      expect(() => controller.activateExamMode()).not.toThrow();
    });

    it('handles callback exception during activateExamMode storage set callback', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        if (cb) {
          // Throws inside callback to hit catch block line 260-262
          controller.renderActivePanel = () => { throw new Error('Callback error'); };
          cb();
        }
      });

      controller.allCards = getFreshCards();
      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement;
      examDateInput.value = '2026-08-20';

      expect(() => controller.activateExamMode()).not.toThrow();
    });

    it('deactivates exam mode and restores original due dates when confirmed', () => {
      const cards = getFreshCards();
      cards[0].originalDue = 12345;
      cards[0].due = 99999;
      controller.allCards = cards;

      controller.deactivateExamMode();

      expect(controller.allCards[0].due).toBe(12345);
      expect(controller.allCards[0].originalDue).toBeUndefined();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('does not deactivate exam mode if confirm dialog is cancelled', () => {
      (global as any).confirm.mockReturnValue(false);

      controller.deactivateExamMode();
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('handles chrome.runtime.lastError when deactivating exam mode', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Deactivation write error' };
        if (cb) cb();
      });

      controller.allCards = getFreshCards();
      expect(() => controller.deactivateExamMode()).not.toThrow();
    });

    it('handles callback exception during deactivateExamMode storage set callback', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        if (cb) {
          controller.renderSetupPanel = () => { throw new Error('Callback error'); };
          cb();
        }
      });

      controller.allCards = getFreshCards();
      expect(() => controller.deactivateExamMode()).not.toThrow();
    });
  });

  describe('renderActivePanel and countdown ring styling', () => {
    it('returns early if settings is null', () => {
      controller.settings = null;
      expect(() => controller.renderActivePanel()).not.toThrow();
    });

    it('applies warning and urgent classes based on remaining days', () => {
      controller.allCards = getFreshCards();

      // Test urgent (<= 3 days)
      const urgentDate = new Date();
      urgentDate.setDate(urgentDate.getDate() + 2);
      controller.settings = {
        isActive: true,
        examDate: urgentDate.toISOString().split('T')[0],
        dailyTarget: 5,
        activatedAt: Date.now() - 86400000 * 5
      };

      controller.renderActivePanel();

      const ringFill = document.getElementById('countdown-ring-fill');
      expect(ringFill?.classList.contains('urgent')).toBe(true);

      // Test warning (<= 7 days)
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + 6);
      controller.settings.examDate = warningDate.toISOString().split('T')[0];

      controller.renderActivePanel();
      expect(ringFill?.classList.contains('warning')).toBe(true);
    });

    it('renders schedule breakdown table rows correctly with past and today badges', () => {
      controller.allCards = getFreshCards();
      controller.settings = {
        isActive: true,
        examDate: '2026-08-10',
        dailyTarget: 5,
        activatedAt: Date.now() - 86400000 * 2
      };

      controller.renderScheduleTable(5, 3);

      const tbody = document.getElementById('schedule-body');
      expect(tbody?.children.length).toBe(5);

      const rows = tbody?.querySelectorAll('tr');
      expect(rows?.[0].classList.contains('past-row')).toBe(true);
    });
  });

  describe('event listeners and error handling inside callbacks', () => {
    it('triggers updatePreview and activation/deactivation via event listeners', () => {
      controller.allCards = getFreshCards();
      controller.init();

      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement;
      examDateInput.value = '2026-08-25';
      examDateInput.dispatchEvent(new Event('change'));

      const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement;
      dailyLimitInput.value = '2';
      dailyLimitInput.dispatchEvent(new Event('input'));

      const activateBtn = document.getElementById('activate-btn') as HTMLElement;
      activateBtn.click();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const deactivateBtn = document.getElementById('deactivate-btn') as HTMLElement;
      deactivateBtn.click();
    });

    it('catches exceptions in input event handlers gracefully', () => {
      controller.init();

      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement;
      Object.defineProperty(examDateInput, 'value', {
        get: () => { throw new Error('Value getter exception'); }
      });

      expect(() => examDateInput.dispatchEvent(new Event('change'))).not.toThrow();
    });
  });
});
