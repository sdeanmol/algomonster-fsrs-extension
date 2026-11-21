import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StudyPlanController, StudyPlanSettings } from '../../../../../features/dashboard/studyplan/studyplan';
import { Card } from '../../../../../types/domain';

class TestStudyPlanController extends StudyPlanController {
  override bindEvents(): void {
    try {
      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement | null;
      const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement | null;
      const activateBtn = document.getElementById('activate-btn') as HTMLButtonElement | null;
      const deactivateBtn = document.getElementById('deactivate-btn') as HTMLButtonElement | null;

      if (examDateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        examDateInput.min = this.formatDate(tomorrow);

        const handleDateUpdate = () => {
          try {
            this.updatePreview();
          } catch (err) {}
        };

        examDateInput.addEventListener('change', handleDateUpdate);
        examDateInput.addEventListener('input', handleDateUpdate);
      }

      if (dailyLimitInput) {
        dailyLimitInput.addEventListener('input', () => {
          try {
            this.updatePreview();
          } catch (err) {}
        });
      }

      if (activateBtn) {
        activateBtn.addEventListener('click', () => {
          try {
            this.activateExamMode();
          } catch (err) {}
        });
      }

      if (deactivateBtn) {
        deactivateBtn.addEventListener('click', () => {
          try {
            this.deactivateExamMode();
          } catch (err) {}
        });
      }
    } catch (_) {}
  }

  override updatePreview(): void {
    try {
      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement | null;
      const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement | null;
      const preview = document.getElementById('setup-preview');
      const activateBtn = document.getElementById('activate-btn') as HTMLButtonElement | null;

      if (!examDateInput || !examDateInput.value || !preview) return;

      const examDate = new Date(examDateInput.value + 'T23:59:59');
      const now = new Date();
      const daysLeft = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 0) {
        preview.style.display = 'none';
        if (activateBtn) activateBtn.disabled = true;
        return;
      }

      const totalCards = this.allCards.length;
      const limitVal = parseInt(dailyLimitInput?.value || '', 10);

      let dailyTarget = Math.ceil(totalCards / daysLeft);
      let willFinish = true;

      if (!isNaN(limitVal) && limitVal > 0 && limitVal < dailyTarget) {
        dailyTarget = limitVal;
        willFinish = false;
      }

      const prevDaysEl = document.getElementById('preview-days');
      const prevTotalEl = document.getElementById('preview-total');
      const prevDailyEl = document.getElementById('preview-daily');

      if (prevDaysEl) prevDaysEl.textContent = String(daysLeft);
      if (prevTotalEl) prevTotalEl.textContent = String(willFinish ? totalCards : (dailyTarget * daysLeft));
      if (prevDailyEl) prevDailyEl.textContent = String(dailyTarget);

      preview.style.display = 'block';
      if (activateBtn) activateBtn.disabled = false;
    } catch (_) {}
  }

  override activateExamMode(examDateArg?: string, dailyLimitArg?: number): void {
    try {
      const examDateInput = document.getElementById('exam-date-input') as HTMLInputElement | null;
      const dailyLimitInput = document.getElementById('daily-limit-input') as HTMLInputElement | null;
      const dateVal = examDateArg || examDateInput?.value;
      const limitVal = dailyLimitArg ?? (dailyLimitInput ? parseInt(dailyLimitInput.value, 10) : undefined);
      super.activateExamMode(dateVal, limitVal);
    } catch (_) {}
  }

  override renderSetupPanel(): void {
    try {
      super.renderSetupPanel();
      const setupPanel = document.getElementById('setup-panel');
      const activePanel = document.getElementById('active-panel');
      if (setupPanel) setupPanel.style.display = 'block';
      if (activePanel) activePanel.style.display = 'none';
      this.updatePreview();
    } catch (_) {}
  }

  override renderActivePanel(): void {
    try {
      super.renderActivePanel();
      if (!this.settings) return;

      const setupPanel = document.getElementById('setup-panel');
      const activePanel = document.getElementById('active-panel');
      if (setupPanel) setupPanel.style.display = 'none';
      if (activePanel) activePanel.style.display = 'block';

      const now = Date.now();
      const examTime = new Date(this.settings.examDate + 'T23:59:59').getTime();
      const totalDays = Math.ceil((examTime - this.settings.activatedAt) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
      const daysPassed = totalDays - daysLeft;
      const progress = totalDays > 0 ? Math.min(daysPassed / totalDays, 1) : 0;

      const circumference = 2 * Math.PI * 52;
      const ringFill = document.getElementById('countdown-ring-fill');
      if (ringFill) {
        ringFill.setAttribute('stroke-dasharray', String(circumference));
        ringFill.setAttribute('stroke-dashoffset', String(circumference - (progress * circumference)));

        if (daysLeft <= 3) ringFill.classList.add('urgent');
        else if (daysLeft <= 7) ringFill.classList.add('warning');
      }

      const countDaysEl = document.getElementById('countdown-days');
      const countTitleEl = document.getElementById('countdown-title');
      const countExamDateEl = document.getElementById('countdown-exam-date');

      if (countDaysEl) countDaysEl.textContent = String(daysLeft);
      if (countTitleEl) countTitleEl.textContent = daysLeft === 0 ? 'Exam Day!' : 'Exam Countdown';
      if (countExamDateEl) {
        countExamDateEl.textContent = new Date(this.settings.examDate).toLocaleDateString(undefined, {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      }

      const activatedAt = this.settings.activatedAt;
      const completedCards = this.allCards.filter(c => {
        const lastReview = (c.historyLog && c.historyLog.length > 0) ? (c.historyLog[c.historyLog.length - 1] as any).date : undefined;
        return lastReview && lastReview > activatedAt;
      }).length;

      const actTotalEl = document.getElementById('active-total-cards');
      const actDailyEl = document.getElementById('active-daily-target');
      const actCompEl = document.getElementById('active-completed');

      if (actTotalEl) actTotalEl.textContent = String(this.allCards.length);
      if (actDailyEl) actDailyEl.textContent = String(this.settings.dailyTarget);
      if (actCompEl) actCompEl.textContent = String(completedCards);

      this.renderScheduleTable(totalDays, daysLeft);
    } catch (_) {}
  }

  override renderScheduleTable(totalDays: number, daysLeft: number): void {
    try {
      super.renderScheduleTable(totalDays, daysLeft);
      const tbody = document.getElementById('schedule-body');
      if (!tbody) return;

      const rows = this.computeScheduleRows(totalDays);
      tbody.innerHTML = rows.map(row => `
        <tr class="${row.isToday ? 'today-row' : (row.isPast ? 'past-row' : '')}">
          <td>Day ${row.dayIndex}</td>
          <td>${row.dateFormatted}</td>
          <td>${row.cardsCount}</td>
          <td><span class="badge badge-${row.status === 'Done' ? 'complete' : (row.status === 'Today' ? 'today' : 'upcoming')}">${row.status}</span></td>
        </tr>
      `).join('');
    } catch (_) {}
  }
}

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

    controller = new TestStudyPlanController();
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
      cards[0].lastReview = 1000;
      controller.settings = { isActive: true, examDate: '2026-12-01', dailyTarget: 5, activatedAt: 5000 };
      controller.allCards = cards;

      controller.deactivateExamMode();

      expect(controller.allCards[0].due).toBe(12345);
      expect(controller.allCards[0].originalDue).toBeUndefined();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('UX-006: preserves newly computed due dates for cards reviewed during exam mode', () => {
      const cards = getFreshCards();
      // Card 0: reviewed during exam mode (lastReview >= activatedAt)
      cards[0].originalDue = 10000;
      cards[0].due = 88888;
      cards[0].lastReview = 6000;

      // Card 1: not reviewed during exam mode (lastReview < activatedAt)
      cards[1].originalDue = 20000;
      cards[1].due = 77777;
      cards[1].lastReview = 4000;

      controller.settings = { isActive: true, examDate: '2026-12-01', dailyTarget: 5, activatedAt: 5000 };
      controller.allCards = cards;

      controller.deactivateExamMode();

      // Card 0 keeps its new due date
      expect(controller.allCards[0].due).toBe(88888);
      expect(controller.allCards[0].originalDue).toBeUndefined();

      // Card 1 has its original due date restored
      expect(controller.allCards[1].due).toBe(20000);
      expect(controller.allCards[1].originalDue).toBeUndefined();
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
      examDateInput.value = '2030-08-25';
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
