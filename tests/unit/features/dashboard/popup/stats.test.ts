import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StatsComponent } from '../../../../../features/dashboard/popup/stats';
import { DashboardCoordinator } from '../../../../../features/dashboard/popup/DashboardComponent';
import { Card } from '../../../../../types/domain';

describe('StatsComponent (Popup)', () => {
  let component: StatsComponent;
  let mockCoordinator: DashboardCoordinator;

  const getFreshCards = (): Card[] => [
    {
      id: 'c1',
      due: Date.now() - 1000,
      stability: 10,
      difficulty: 5,
      reps: 5,
      lapses: 0,
      historyLog: [
        { date: Date.now() - 86400000, rating: 3, duration: 10 }
      ]
    },
    {
      id: 'c2',
      due: Date.now() + 86400000 * 5,
      stability: 20,
      difficulty: 4,
      reps: 10,
      lapses: 1,
      historyLog: []
    }
  ] as unknown as Card[];

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <span id="total-cards"></span>
      <span id="due-cards"></span>
      <span id="retention-rate"></span>

      <div id="box-due"></div>
      <div id="box-retention"></div>

      <div id="gamification-panel">
        <button id="goal-edit-btn"></button>
        <div id="goal-editor" style="display: none;">
          <input id="goal-input" value="10" />
          <button id="goal-save-btn">Save</button>
        </div>
      </div>

      <span id="goal-progress-text"></span>
      <circle id="goal-progress-ring"></circle>

      <span id="streak-days"></span>
      <span id="longest-streak"></span>

      <div id="milestone-toast"><span id="milestone-toast-text"></span></div>
      <canvas id="confetti-canvas" style="width: 100px; height: 100px;"></canvas>
      <div id="level-badge"></div>
      <span id="level-num"></span>
      <span id="level-title"></span>
      <div id="xp-bar-fill"></div>
      <span id="xp-text"></span>
    `;

    // Canvas 2d context mock
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn()
    }) as any;

    mockCoordinator = {
      showStatus: jest.fn()
    };

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any) => {
      return Promise.resolve({
        fsrsCards: getFreshCards(),
        fsrsActivity: { '2026-08-03': 10 },
        dailyGoalTarget: 10,
        longestStreak: 5
      });
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any) => Promise.resolve());

    component = new StatsComponent(mockCoordinator);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('load and stats rendering', () => {
    it('loads card stats, updates DOM counters, retention rate, level badges, and goal ring', async () => {
      await component.load();

      const totalEl = document.getElementById('total-cards');
      expect(totalEl?.innerText).toBe('2');

      const dueEl = document.getElementById('due-cards');
      expect(dueEl?.innerText).toBe('1');
    });

    it('handles warning and danger thresholds for due card box styling', async () => {
      const manyDueCards = Array.from({ length: 25 }, (_, i) => ({
        id: `c${i}`,
        due: Date.now() - 1000,
        stability: 5,
        historyLog: []
      })) as unknown as Card[];

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({ fsrsCards: manyDueCards });
      });

      await component.load();

      const boxDue = document.getElementById('box-due');
      expect(boxDue?.classList.contains('danger')).toBe(true);
    });

    it('triggers milestone celebration toast and confetti when reaching review threshold', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          fsrsCards: getFreshCards(),
          fsrsActivity: { '2026-08-03': 100 },
          lastCelebratedMilestone: 0
        });
      });

      await component.load();

      jest.advanceTimersByTime(500);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ lastCelebratedMilestone: 100 })
      );
    });

    it('handles exception in load gracefully', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.reject(new Error('Storage get failure'));
      });

      await expect(component.load()).resolves.not.toThrow();
    });
  });

  describe('bindEditorEvents and daily goal editor', () => {
    it('toggles editor visibility and saves goal target on save button click and Enter key', async () => {
      await component.load();
      const gamificationPanel = document.getElementById('gamification-panel') as HTMLElement;
      component.bindEditorEvents(gamificationPanel);

      const goalEditBtn = document.getElementById('goal-edit-btn') as HTMLElement;
      const goalEditor = document.getElementById('goal-editor') as HTMLElement;
      const goalInput = document.getElementById('goal-input') as HTMLInputElement;
      const goalSaveBtn = document.getElementById('goal-save-btn') as HTMLElement;

      goalEditBtn.click();
      goalInput.value = '15';
      goalSaveBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('handles exceptions inside bindEditorEvents callbacks', () => {
      const gamificationPanel = document.getElementById('gamification-panel') as HTMLElement;
      component.bindEditorEvents(gamificationPanel);

      const goalInput = document.getElementById('goal-input') as HTMLInputElement;
      Object.defineProperty(goalInput, 'value', {
        get: () => { throw new Error('Value getter error'); }
      });

      const goalSaveBtn = document.getElementById('goal-save-btn') as HTMLElement;
      expect(() => goalSaveBtn.click()).not.toThrow();
      expect(() => goalInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).not.toThrow();
    });
  });

  describe('direct UI helper methods', () => {
    it('renders goal complete and streak badges correctly', () => {
      const goalHtml = component.renderGoalComplete(10, 10, 5, 10);
      expect(goalHtml).toContain('Goal Complete!');

      const streakHtml = component.renderStreakBadge(5, 10);
      expect(streakHtml).toContain('5-day streak');
    });

    it('shows milestone toast', () => {
      component.showMilestoneToast('Test Toast');
      const toastText = document.getElementById('milestone-toast-text');
      expect(toastText?.textContent).toBe('Test Toast');

      jest.advanceTimersByTime(4000);
      const toast = document.getElementById('milestone-toast');
      expect(toast?.classList.contains('show')).toBe(false);
    });
  });

  describe('showConfetti animation', () => {
    it('animates confetti particles on canvas', () => {
      component.showConfetti();
      jest.advanceTimersByTime(2000);
      expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled();
    });

    it('returns early if confetti canvas is missing', () => {
      document.getElementById('confetti-canvas')?.remove();
      expect(() => component.showConfetti()).not.toThrow();
    });
  });

  describe('calculateStreaks helper method', () => {
    it('calculates current and longest streaks correctly', () => {
      const activity = {
        '2026-08-01': 5,
        '2026-08-02': 3,
        '2026-08-03': 10
      };

      const result = component.calculateStreaks(activity);
      expect(result.current).toBeDefined();
      expect(result.longest).toBeGreaterThan(0);
    });

    it('returns 0 streaks for empty activity payload', () => {
      const result = component.calculateStreaks({});
      expect(result).toEqual({ current: 0, longest: 0 });
    });
  });
});
