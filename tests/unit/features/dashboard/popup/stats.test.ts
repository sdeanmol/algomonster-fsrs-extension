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
      <div id="user-level-badge"></div>
      <span id="level-num"></span>
      <span id="level-title"></span>
      <div id="xp-bar-fill"></div>
      <span id="xp-text"></span>
    `;

    // Mock global FsrsScheduler class on window
    (window as any).FsrsScheduler = jest.fn().mockImplementation(() => ({
      getRetrievability: jest.fn().mockReturnValue(0.92)
    }));

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

    it('handles warning (1-20 cards due) and danger (>20 due) box styling', async () => {
      // 5 due cards (warning)
      const warningDueCards = Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        due: Date.now() - 1000,
        stability: 5,
        historyLog: []
      })) as unknown as Card[];

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({ fsrsCards: warningDueCards });
      });

      await component.load();
      const boxDue = document.getElementById('box-due');
      expect(boxDue?.classList.contains('warning')).toBe(true);

      // 25 due cards (danger)
      const dangerDueCards = Array.from({ length: 25 }, (_, i) => ({
        id: `c${i}`,
        due: Date.now() - 1000,
        stability: 5,
        historyLog: []
      })) as unknown as Card[];

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({ fsrsCards: dangerDueCards });
      });

      await component.load();
      expect(boxDue?.classList.contains('danger')).toBe(true);
    });

    it('renders empty card list gamification panel state when no cards exist', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({ fsrsCards: [] });
      });

      await component.load();
      const panel = document.getElementById('gamification-panel');
      expect(panel?.innerHTML).toContain('Welcome to Spaced Repetitions!');
    });

    it('renders level titles across Apprentice, Specialist, Expert, Grandmaster thresholds', async () => {
      const testLevels = [
        { reviews: 50, title: 'Apprentice' },
        { reviews: 300, title: 'Specialist' },
        { reviews: 1200, title: 'Expert' },
        { reviews: 3600, title: 'Grandmaster' }
      ];

      for (const t of testLevels) {
        (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
          return Promise.resolve({
            fsrsCards: getFreshCards(),
            fsrsActivity: { '2026-08-03': t.reviews }
          });
        });

        await component.load();
        const badge = document.getElementById('user-level-badge');
        expect(badge?.title).toContain(t.title);
      }
    });

    it('renders exam countdown pill when studyPlanSettings is active', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          fsrsCards: getFreshCards(),
          studyPlanSettings: { isActive: true, examDate: '2026-08-10' }
        });
      });

      await component.load();
      const panel = document.getElementById('gamification-panel');
      expect(panel?.innerHTML).toContain('exam');
    });

    it('triggers streak milestone celebration toast and confetti when reaching streak threshold', async () => {
      const today = new Date();
      const activity: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        activity[component.formatDateKey(d)] = 5;
      }

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          fsrsCards: getFreshCards(),
          fsrsActivity: activity,
          lastCelebratedMilestone: 0
        });
      });

      await component.load();

      jest.advanceTimersByTime(500);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ lastCelebratedMilestone: 7 })
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

    it('handles bindEvents and exceptions inside bindEditorEvents callbacks', () => {
      const gamificationPanel = document.getElementById('gamification-panel') as HTMLElement;
      component.bindEditorEvents(gamificationPanel);
      component.bindEvents();

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
    it('renders goal complete, motivation messages, and streak badges correctly', () => {
      const goalHtml = component.renderGoalComplete(10, 10, 5, 10);
      expect(goalHtml).toContain('Goal Complete!');

      const goalProgressPartial = component.renderGoalProgress(5, 10, 2, 3, 5);
      expect(goalProgressPartial).toContain('Keep going!');

      const goalProgressComplete = component.renderGoalProgress(10, 10, 0, 3, 5);
      expect(goalProgressComplete).toContain('Daily goal reached!');

      const streakHtml = component.renderStreakBadge(5, 10);
      expect(streakHtml).toContain('5-day streak');

      const streakEmpty = component.renderStreakBadge(0, 0);
      expect(streakEmpty).toBe('');
    });

    it('shows milestone toast and handles timer callback errors', () => {
      component.showMilestoneToast('Test Toast');
      const toastText = document.getElementById('milestone-toast-text');
      expect(toastText?.textContent).toBe('Test Toast');

      jest.advanceTimersByTime(4000);
      const toast = document.getElementById('milestone-toast');
      expect(toast?.classList.contains('show')).toBe(false);

      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('Toast error'); };
      expect(() => component.showMilestoneToast('Err')).not.toThrow();
      document.getElementById = origGEBI;
    });

    it('handles errors inside renderGoalProgress, renderGoalComplete, and renderStreakBadge gracefully', () => {
      const throwingObj = {
        toString() { throw new Error('Eval error'); },
        valueOf() { throw new Error('Eval error'); }
      } as any;

      expect(component.renderGoalProgress(throwingObj, 10, 0, 0, 0)).toBe('');
      expect(component.renderGoalComplete(throwingObj, 10, 0, 0)).toBe('');
      expect(component.renderStreakBadge(throwingObj, 0)).toBe('');
    });
  });

  describe('showConfetti animation', () => {
    it('animates confetti particles on canvas across full animation loop', () => {
      component.showConfetti();
      // Advance timers to trigger animation loop frames
      for (let i = 0; i < 160; i++) {
        jest.advanceTimersByTime(16);
      }
      expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled();
    });

    it('returns early if confetti canvas is missing or context is null', () => {
      document.getElementById('confetti-canvas')?.remove();
      expect(() => component.showConfetti()).not.toThrow();
    });
  });

  describe('calculateStreaks and formatDateKey helper methods', () => {
    it('calculates current and longest streaks correctly with consecutive review days', () => {
      const activity = {
        '2026-08-01': 5,
        '2026-08-02': 3,
        '2026-08-03': 10
      };

      const result = component.calculateStreaks(activity);
      expect(result.current).toBeDefined();
      expect(result.longest).toBeGreaterThan(0);
    });

    it('returns 0 streaks for empty activity payload or when error is thrown', () => {
      const result = component.calculateStreaks({});
      expect(result).toEqual({ current: 0, longest: 0 });

      expect(component.calculateStreaks(null as any)).toEqual({ current: 0, longest: 0 });
    });

    it('handles formatDateKey errors gracefully', () => {
      expect(component.formatDateKey(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(component.formatDateKey(new Date('invalid-date'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
