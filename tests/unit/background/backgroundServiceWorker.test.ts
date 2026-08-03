import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlgoRecallBackground as BackgroundServiceWorker } from '../../../background/background';

describe('BackgroundServiceWorker', () => {
  let worker: BackgroundServiceWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (global as any).chrome = {
      runtime: {
        id: 'test-extension-id',
        lastError: undefined as any,
        getURL: jest.fn((path: string) => `chrome-extension://mock_id/${path}`),
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        onInstalled: { addListener: jest.fn() }
      },
      storage: {
        local: {
          get: jest.fn().mockImplementation((keys: any, cb?: any) => {
            const data: any = {
              notificationSettings: { enabled: true, frequency: '30', priority: '2', requireInteraction: true },
              fsrsCards: [
                { id: 'c1', due: Date.now() - 1000, tags: ['array'] },
                { id: 'c2', due: Date.now() + 100000, tags: ['tree'] }
              ],
              fsrsActivity: { '2026-08-03': 5 },
              weeklySummaryEnabled: true,
              whitelistedWebsites: [{ domain: 'algo.monster' }],
              pomodoroState: undefined,
              pomodoroSettings: { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
              pomodoroStats: { sessionsToday: 0, focusMinutesToday: 0, lastDate: new Date().toLocaleDateString() }
            };
            if (typeof cb === 'function') cb(data);
            return Promise.resolve(data);
          }),
          set: jest.fn().mockImplementation((data: any, cb?: any) => {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          })
        },
        onChanged: { addListener: jest.fn() }
      },
      alarms: {
        create: jest.fn(),
        clear: jest.fn().mockImplementation((name: any, cb?: any) => {
          if (typeof cb === 'function') cb(true);
          return Promise.resolve(true);
        }),
        onAlarm: { addListener: jest.fn() }
      },
      notifications: {
        create: jest.fn().mockImplementation((id: any, options: any, cb?: any) => {
          if (typeof cb === 'function') cb(id);
        }),
        clear: jest.fn().mockImplementation((id: any, cb?: any) => {
          if (typeof cb === 'function') cb(true);
        }),
        onClicked: { addListener: jest.fn() }
      },
      tabs: {
        query: jest.fn().mockImplementation((query: any, cb: any) => {
          cb([{ id: 101, url: 'https://algo.monster/problems/two_sum' }]);
        }),
        sendMessage: jest.fn().mockImplementation((tabId: any, msg: any, cb: any) => {
          if (typeof cb === 'function') cb({ success: true });
          return Promise.resolve();
        }),
        create: jest.fn()
      },
      webNavigation: {
        onHistoryStateUpdated: { addListener: jest.fn() }
      },
      action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn(),
        setTitle: jest.fn()
      }
    };

    worker = new BackgroundServiceWorker();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // ─── init & bindEvents ────────────────────────────────────────────────
  it('initializes event listeners and alarm schedules', async () => {
    await worker.init();
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
    expect(chrome.notifications.onClicked.addListener).toHaveBeenCalled();
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  // ─── handleInstalled ──────────────────────────────────────────────────
  it('opens welcome page on install', async () => {
    await worker.handleInstalled({ reason: 'install' } as chrome.runtime.InstalledDetails);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('welcome.html') });
  });

  it('opens welcome page on update', async () => {
    await worker.handleInstalled({ reason: 'update' } as chrome.runtime.InstalledDetails);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('welcome.html') });
  });

  it('sends test notification on other install reasons', async () => {
    await worker.handleInstalled({ reason: 'chrome_update' } as chrome.runtime.InstalledDetails);
    expect(chrome.notifications.create).toHaveBeenCalledWith('test-install', expect.anything(), expect.any(Function));
  });

  it('creates default notification settings when not found', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {};
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handleInstalled({ reason: 'install' } as chrome.runtime.InstalledDetails);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      notificationSettings: expect.objectContaining({ enabled: true })
    }));
  });

  // ─── setupAlarm ───────────────────────────────────────────────────────
  it('schedules alarms based on notification settings', async () => {
    await worker.setupAlarm();
    expect(chrome.alarms.create).toHaveBeenCalledWith('checkFsrsReviews', expect.objectContaining({ periodInMinutes: 30 }));
    expect(chrome.alarms.create).toHaveBeenCalledWith('smartReviewSchedule', expect.anything());
  });

  it('uses default interval when frequency is invalid', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { notificationSettings: { enabled: true, frequency: 'invalid' } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.setupAlarm();
    expect(chrome.alarms.create).toHaveBeenCalledWith('checkFsrsReviews', expect.anything());
  });

  it('clears alarms when notifications are disabled', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { notificationSettings: { enabled: false } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.setupAlarm();
    expect(chrome.alarms.clear).toHaveBeenCalledWith('checkFsrsReviews');
  });

  // ─── setupWeeklySummaryAlarm ──────────────────────────────────────────
  it('sets up weekly summary alarm', async () => {
    await worker.setupWeeklySummaryAlarm();
    expect(chrome.alarms.create).toHaveBeenCalledWith('weeklySummary', expect.anything());
  });

  it('clears weekly summary alarm when disabled', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { weeklySummaryEnabled: false };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.setupWeeklySummaryAlarm();
    expect(chrome.alarms.clear).toHaveBeenCalledWith('weeklySummary');
  });

  // ─── setupDailyNudgeAlarm ─────────────────────────────────────────────
  it('sets up daily nudge alarm', async () => {
    await worker.setupDailyNudgeAlarm();
    expect(chrome.alarms.create).toHaveBeenCalledWith('dailyNudge', expect.anything());
  });

  // ─── handleAlarm ──────────────────────────────────────────────────────
  it('handles checkFsrsReviews alarm', () => {
    const spy = jest.spyOn(worker, 'checkDueCards').mockResolvedValue(undefined);
    worker.handleAlarm({ name: 'checkFsrsReviews' } as chrome.alarms.Alarm);
    expect(spy).toHaveBeenCalled();
  });

  it('handles snoozeFsrsReviews alarm', () => {
    const spy = jest.spyOn(worker, 'checkDueCards').mockResolvedValue(undefined);
    worker.handleAlarm({ name: 'snoozeFsrsReviews' } as chrome.alarms.Alarm);
    expect(spy).toHaveBeenCalled();
  });

  it('handles smartReviewSchedule alarm', () => {
    const spy = jest.spyOn(worker, 'checkDueCards').mockResolvedValue(undefined);
    worker.handleAlarm({ name: 'smartReviewSchedule' } as chrome.alarms.Alarm);
    expect(spy).toHaveBeenCalled();
  });

  it('handles weeklySummary alarm', () => {
    const spy = jest.spyOn(worker, 'handleWeeklySummary').mockResolvedValue(undefined);
    worker.handleAlarm({ name: 'weeklySummary' } as chrome.alarms.Alarm);
    expect(spy).toHaveBeenCalled();
  });

  it('handles dailyNudge alarm', () => {
    const spy = jest.spyOn(worker, 'handleDailyNudge').mockResolvedValue(undefined);
    worker.handleAlarm({ name: 'dailyNudge' } as chrome.alarms.Alarm);
    expect(spy).toHaveBeenCalled();
  });

  it('handles pomodoroEnd alarm', () => {
    const spy = jest.spyOn(worker, 'handlePomodoroEnd').mockResolvedValue(undefined);
    worker.handleAlarm({ name: 'pomodoroEnd' } as chrome.alarms.Alarm);
    expect(spy).toHaveBeenCalled();
  });

  // ─── handleHistoryStateUpdated ────────────────────────────────────────
  it('sends spa_url_changed message on history state update', () => {
    (chrome.tabs.sendMessage as jest.Mock).mockReturnValue(Promise.resolve());
    worker.handleHistoryStateUpdated({ tabId: 1, url: 'https://algo.monster/problems/two_sum' } as any);
    expect(chrome.tabs.sendMessage).toHaveBeenCalled();
  });

  // ─── handleStorageChanged ─────────────────────────────────────────────
  it('reschedules alarm on notificationSettings storage change', async () => {
    const spy = jest.spyOn(worker, 'setupAlarm').mockResolvedValue(undefined);
    await worker.handleStorageChanged({ notificationSettings: { newValue: {}, oldValue: {} } as any }, 'local');
    expect(spy).toHaveBeenCalled();
  });

  it('reschedules weekly summary alarm on weeklySummaryEnabled change', async () => {
    const spy = jest.spyOn(worker, 'setupWeeklySummaryAlarm').mockResolvedValue(undefined);
    await worker.handleStorageChanged({ weeklySummaryEnabled: { newValue: true, oldValue: false } as any }, 'local');
    expect(spy).toHaveBeenCalled();
  });

  it('ignores storage changes from non-local area', async () => {
    const spy = jest.spyOn(worker, 'setupAlarm');
    await worker.handleStorageChanged({ notificationSettings: {} as any }, 'sync');
    expect(spy).not.toHaveBeenCalled();
  });

  // ─── checkDueCards ────────────────────────────────────────────────────
  it('checks due cards and triggers tab notification', async () => {
    await worker.checkDueCards();
    expect(chrome.tabs.query).toHaveBeenCalled();
  });

  it('returns early when notifications are disabled', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { notificationSettings: { enabled: false }, fsrsCards: [] };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.checkDueCards();
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  it('returns early when no cards exist', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { notificationSettings: { enabled: true }, fsrsCards: [] };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.checkDueCards();
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  it('falls back to system notification when tab URL does not match whitelisted sites', async () => {
    (chrome.tabs.query as jest.Mock).mockImplementation((query: any, cb: any) => {
      cb([{ id: 101, url: 'https://non-matching-site.com' }]);
    });
    const spy = jest.spyOn(worker, 'createSystemReviewNotification');
    await worker.checkDueCards();
    expect(spy).toHaveBeenCalled();
  });

  it('suppresses notification during quiet hours (same-day range)', async () => {
    const now = new Date();
    const startH = now.getHours();
    const startM = now.getMinutes();
    const endH = startH + 1;
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {
        notificationSettings: { enabled: true, quietHoursEnabled: true, quietHoursStart: `${startH}:00`, quietHoursEnd: `${endH}:00` },
        fsrsCards: [{ id: 'c1', due: Date.now() - 1000, tags: ['array'] }]
      };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.checkDueCards();
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  it('handles tag grouping for due cards with untagged cards', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {
        notificationSettings: { enabled: true },
        fsrsCards: [
          { id: 'c1', due: Date.now() - 1000, tags: [] },
          { id: 'c2', due: Date.now() - 2000, tags: ['hash'] }
        ]
      };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.checkDueCards();
    expect(chrome.tabs.query).toHaveBeenCalled();
  });

  // ─── createSystemReviewNotification ───────────────────────────────────
  it('creates system review notification', () => {
    worker.createSystemReviewNotification(2, { priority: '2' }, '2 patterns due');
    expect(chrome.notifications.clear).toHaveBeenCalledWith('algo-review-notification', expect.any(Function));
  });

  // ─── handleWeeklySummary ──────────────────────────────────────────────
  it('generates weekly summary digest notification', async () => {
    await worker.handleWeeklySummary(true);
    expect(chrome.notifications.clear).toHaveBeenCalledWith('algo-weekly-summary', expect.any(Function));
  });

  it('skips weekly summary when disabled and not forced', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { weeklySummaryEnabled: false, fsrsActivity: {}, fsrsCards: [] };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handleWeeklySummary(false);
    expect(chrome.notifications.clear).not.toHaveBeenCalled();
  });

  it('handles weekly summary with previous week activity comparison', async () => {
    const activity: Record<string, number> = {};
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      activity[key] = i < 7 ? 5 : 3;
    }
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { weeklySummaryEnabled: true, fsrsActivity: activity, fsrsCards: [{ id: 'c1', due: Date.now() + 86400000, tags: [] }] };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handleWeeklySummary(true);
    expect(chrome.notifications.clear).toHaveBeenCalledWith('algo-weekly-summary', expect.any(Function));
  });

  // ─── handleDailyNudge ─────────────────────────────────────────────────
  it('sends daily nudge when no reviews today', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { fsrsActivity: {}, notificationSettings: { enabled: true } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handleDailyNudge();
    expect(chrome.notifications.create).toHaveBeenCalledWith('algo-daily-nudge', expect.anything(), expect.any(Function));
  });

  it('skips daily nudge when reviews have been done today', async () => {
    const today = new Date();
    const dateKey = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { fsrsActivity: { [dateKey]: 5 }, notificationSettings: { enabled: true } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handleDailyNudge();
    expect(chrome.notifications.create).not.toHaveBeenCalledWith('algo-daily-nudge', expect.anything(), expect.any(Function));
  });

  it('skips daily nudge when notifications are disabled', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { notificationSettings: { enabled: false } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handleDailyNudge();
    expect(chrome.notifications.create).not.toHaveBeenCalled();
  });

  // ─── showTestNotification ─────────────────────────────────────────────
  it('shows test notification in active matching tab', async () => {
    await worker.showTestNotification();
    expect(chrome.tabs.query).toHaveBeenCalled();
  });

  it('falls back to system notification for non-matching tab', async () => {
    (chrome.tabs.query as jest.Mock).mockImplementation((query: any, cb: any) => {
      cb([{ id: 102, url: 'https://example.com' }]);
    });
    const spy = jest.spyOn(worker, 'createSystemTestNotification');
    await worker.showTestNotification();
    expect(spy).toHaveBeenCalled();
  });

  it('falls back to system notification when no tabs available', async () => {
    (chrome.tabs.query as jest.Mock).mockImplementation((query: any, cb: any) => { cb([]); });
    const spy = jest.spyOn(worker, 'createSystemTestNotification');
    await worker.showTestNotification();
    expect(spy).toHaveBeenCalled();
  });

  it('falls back to system notification when tab sendMessage fails', async () => {
    (chrome.tabs.sendMessage as jest.Mock).mockImplementation((tabId: any, msg: any, cb: any) => {
      if (typeof cb === 'function') cb(null);
    });
    const spy = jest.spyOn(worker, 'createSystemTestNotification');
    await worker.showTestNotification();
    expect(spy).toHaveBeenCalled();
  });

  // ─── createSystemTestNotification ─────────────────────────────────────
  it('creates system test notification', () => {
    worker.createSystemTestNotification({ frequency: '30', priority: '2' });
    expect(chrome.notifications.clear).toHaveBeenCalledWith('algo-test-notification', expect.any(Function));
  });

  // ─── handleNotificationClicked ────────────────────────────────────────
  it('opens popup on review notification click', () => {
    worker.handleNotificationClicked('algo-review-notification');
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('popup.html') });
  });

  it('opens summary page on weekly summary notification click', () => {
    worker.handleNotificationClicked('algo-weekly-summary');
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('summary.html') });
  });

  it('opens pomodoro page on pomodoro-complete notification click', () => {
    worker.handleNotificationClicked('pomodoro-complete');
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('pomodoro.html') });
  });

  it('opens popup on daily nudge notification click', () => {
    worker.handleNotificationClicked('algo-daily-nudge');
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('popup.html') });
  });

  // ─── handleMessage ────────────────────────────────────────────────────
  it('handles open_fullscreen_editor message', () => {
    const sendResponse = jest.fn();
    worker.handleMessage({ action: 'open_fullscreen_editor', url: 'https://algo.monster/problem' }, {} as any, sendResponse);
    expect(chrome.tabs.create).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('handles open_fullscreen_editor with cardId', () => {
    const sendResponse = jest.fn();
    worker.handleMessage({ action: 'open_fullscreen_editor', url: 'https://algo.monster/problem', cardId: 'c1' }, {} as any, sendResponse);
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('cardId=c1') });
  });

  it('handles test_notification message', () => {
    const sendResponse = jest.fn();
    const spy = jest.spyOn(worker, 'showTestNotification').mockResolvedValue(undefined);
    const result = worker.handleMessage({ action: 'test_notification' }, {} as any, sendResponse);
    expect(result).toBe(true);
  });

  it('handles snooze_notification message', () => {
    const sendResponse = jest.fn();
    const result = worker.handleMessage({ action: 'snooze_notification', minutes: 15 }, {} as any, sendResponse);
    expect(chrome.alarms.create).toHaveBeenCalledWith('snoozeFsrsReviews', { delayInMinutes: 15 });
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(result).toBe(true);
  });

  it('handles snooze_notification with default minutes', () => {
    const sendResponse = jest.fn();
    worker.handleMessage({ action: 'snooze_notification' }, {} as any, sendResponse);
    expect(chrome.alarms.create).toHaveBeenCalledWith('snoozeFsrsReviews', expect.anything());
  });

  it('handles toggle_weekly_summary message', () => {
    const sendResponse = jest.fn();
    jest.spyOn(worker, 'setupWeeklySummaryAlarm').mockResolvedValue(undefined);
    const result = worker.handleMessage({ action: 'toggle_weekly_summary' }, {} as any, sendResponse);
    expect(result).toBe(true);
  });

  it('handles test_summary_notification message', () => {
    const sendResponse = jest.fn();
    jest.spyOn(worker, 'handleWeeklySummary').mockResolvedValue(undefined);
    const result = worker.handleMessage({ action: 'test_summary_notification' }, {} as any, sendResponse);
    expect(result).toBe(true);
  });

  it('handles pomodoro_action message', () => {
    const sendResponse = jest.fn();
    jest.spyOn(worker, 'handlePomodoroAction').mockResolvedValue(undefined);
    const result = worker.handleMessage({
      action: 'pomodoro_action',
      payload: { command: 'start', state: { state: 'running', phase: 'focus', targetEndTime: Date.now() + 60000, currentSession: 1 } }
    }, {} as any, sendResponse);
    expect(result).toBe(true);
  });

  // ─── resumePomodoroBackground ─────────────────────────────────────────
  it('resumes pomodoro tick on startup when state is running', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { pomodoroState: { state: 'running', phase: 'focus', targetEndTime: Date.now() + 60000, currentSession: 1 } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    const spy = jest.spyOn(worker, 'startPomodoroTick');
    await worker.resumePomodoroBackground();
    expect(spy).toHaveBeenCalled();
  });

  it('does not resume pomodoro tick when state is idle', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { pomodoroState: { state: 'idle' } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    const spy = jest.spyOn(worker, 'startPomodoroTick');
    await worker.resumePomodoroBackground();
    expect(spy).not.toHaveBeenCalled();
  });

  // ─── handlePomodoroAction ─────────────────────────────────────────────
  it('starts pomodoro and creates alarm on start command', async () => {
    const spy = jest.spyOn(worker, 'startPomodoroTick');
    await worker.handlePomodoroAction({
      command: 'start',
      state: { state: 'running', phase: 'focus', targetEndTime: Date.now() + 60000, currentSession: 1 }
    });
    expect(spy).toHaveBeenCalled();
    expect(chrome.alarms.create).toHaveBeenCalledWith('pomodoroEnd', expect.anything());
  });

  it('resumes pomodoro on resume command', async () => {
    const spy = jest.spyOn(worker, 'startPomodoroTick');
    await worker.handlePomodoroAction({
      command: 'resume',
      state: { state: 'running', phase: 'focus', targetEndTime: Date.now() + 60000, currentSession: 1 }
    });
    expect(spy).toHaveBeenCalled();
  });

  it('pauses pomodoro on pause command', async () => {
    const spy = jest.spyOn(worker, 'stopPomodoroTick');
    await worker.handlePomodoroAction({
      command: 'pause',
      state: { state: 'paused', phase: 'focus', targetEndTime: Date.now() + 60000, currentSession: 1 }
    });
    expect(spy).toHaveBeenCalled();
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#95a5a6' });
    expect(chrome.action.setTitle).toHaveBeenCalledWith({ title: 'AlgoRecall (Paused)' });
  });

  it('resets pomodoro on reset command', async () => {
    const spy = jest.spyOn(worker, 'stopPomodoroTick');
    await worker.handlePomodoroAction({
      command: 'reset',
      state: { state: 'idle', phase: 'focus', targetEndTime: 0, currentSession: 1 }
    });
    expect(spy).toHaveBeenCalled();
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    expect(chrome.action.setTitle).toHaveBeenCalledWith({ title: 'AlgoRecall Dashboard' });
  });

  it('skips pomodoro on skip command', async () => {
    await worker.handlePomodoroAction({
      command: 'skip',
      state: { state: 'idle', phase: 'shortBreak', targetEndTime: 0, currentSession: 2 }
    });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  // ─── startPomodoroTick / stopPomodoroTick ─────────────────────────────
  it('starts tick and updates badge text', () => {
    worker.startPomodoroTick({ state: 'running', phase: 'focus', targetEndTime: Date.now() + 120000, currentSession: 1 });
    expect(chrome.action.setBadgeText).toHaveBeenCalled();
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#e74c3c' });
    worker.stopPomodoroTick();
  });

  it('uses green badge color for break phase', () => {
    worker.startPomodoroTick({ state: 'running', phase: 'shortBreak', targetEndTime: Date.now() + 60000, currentSession: 1 });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#2ecc71' });
    worker.stopPomodoroTick();
  });

  it('stops tick when time remaining is 0', () => {
    worker.startPomodoroTick({ state: 'running', phase: 'focus', targetEndTime: Date.now() - 1000, currentSession: 1 });
    const spy = jest.spyOn(worker, 'stopPomodoroTick');
    jest.advanceTimersByTime(1100);
    expect(spy).toHaveBeenCalled();
  });

  it('stopPomodoroTick clears interval', () => {
    worker.startPomodoroTick({ state: 'running', phase: 'focus', targetEndTime: Date.now() + 60000, currentSession: 1 });
    worker.stopPomodoroTick();
    expect((worker as any).pomodoroIntervalId).toBeNull();
  });

  // ─── handlePomodoroEnd ────────────────────────────────────────────────
  it('handles pomodoro end for focus phase transitioning to short break', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {
        pomodoroState: { state: 'running', phase: 'focus', targetEndTime: Date.now() - 1000, currentSession: 1 },
        pomodoroSettings: { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
        pomodoroStats: { sessionsToday: 0, focusMinutesToday: 0, lastDate: new Date().toLocaleDateString() }
      };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handlePomodoroEnd();
    expect(chrome.storage.local.set).toHaveBeenCalled();
    expect(chrome.notifications.create).toHaveBeenCalledWith('pomodoro-complete', expect.anything(), expect.any(Function));
  });

  it('transitions to long break when session limit reached', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {
        pomodoroState: { state: 'running', phase: 'focus', targetEndTime: Date.now() - 1000, currentSession: 4 },
        pomodoroSettings: { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
        pomodoroStats: { sessionsToday: 3, focusMinutesToday: 75, lastDate: new Date().toLocaleDateString() }
      };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handlePomodoroEnd();
    const setCall = (chrome.storage.local.set as jest.Mock).mock.calls[0][0] as any;
    expect(setCall.pomodoroState.phase).toBe('longBreak');
  });

  it('transitions from short break to focus and increments session', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {
        pomodoroState: { state: 'running', phase: 'shortBreak', targetEndTime: Date.now() - 1000, currentSession: 2 },
        pomodoroSettings: { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 },
        pomodoroStats: { sessionsToday: 2, focusMinutesToday: 50, lastDate: new Date().toLocaleDateString() }
      };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handlePomodoroEnd();
    const setCall = (chrome.storage.local.set as jest.Mock).mock.calls[0][0] as any;
    expect(setCall.pomodoroState.phase).toBe('focus');
    expect(setCall.pomodoroState.currentSession).toBe(3);
  });

  it('transitions from long break to focus and resets session to 1', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {
        pomodoroState: { state: 'running', phase: 'longBreak', targetEndTime: Date.now() - 1000, currentSession: 4 },
        pomodoroStats: { sessionsToday: 4, focusMinutesToday: 100, lastDate: new Date().toLocaleDateString() }
      };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handlePomodoroEnd();
    const setCall = (chrome.storage.local.set as jest.Mock).mock.calls[0][0] as any;
    expect(setCall.pomodoroState.phase).toBe('focus');
    expect(setCall.pomodoroState.currentSession).toBe(1);
  });

  it('returns early if pomodoro state is not running', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { pomodoroState: { state: 'idle' } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handlePomodoroEnd();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('resets daily stats when date changes', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {
        pomodoroState: { state: 'running', phase: 'focus', targetEndTime: Date.now() - 1000, currentSession: 1 },
        pomodoroStats: { sessionsToday: 5, focusMinutesToday: 125, lastDate: 'yesterday' }
      };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });
    await worker.handlePomodoroEnd();
    const setCall = (chrome.storage.local.set as jest.Mock).mock.calls[0][0] as any;
    expect(setCall.pomodoroStats.sessionsToday).toBe(1); // reset + 1 for this session
  });
});
