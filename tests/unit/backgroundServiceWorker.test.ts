import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlgoRecallBackground as BackgroundServiceWorker } from '../../background/background';

describe('BackgroundServiceWorker', () => {
  let worker: BackgroundServiceWorker;

  beforeEach(() => {
    jest.clearAllMocks();

    (global as any).chrome = {
      runtime: {
        lastError: undefined,
        getURL: jest.fn((path: string) => `chrome-extension://mock_id/${path}`),
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        onInstalled: { addListener: jest.fn() }
      },
      storage: {
        local: {
          get: jest.fn().mockImplementation((keys: any, cb?: any) => {
            const data = {
              notificationSettings: { enabled: true, frequency: '30', priority: '2', requireInteraction: true },
              fsrsCards: [
                { id: 'c1', due: Date.now() - 1000, tags: ['array'] },
                { id: 'c2', due: Date.now() + 100000, tags: ['tree'] }
              ],
              fsrsActivity: { '2026-08-03': 5 },
              weeklySummaryEnabled: true,
              whitelistedWebsites: [{ domain: 'algo.monster' }]
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
          cb({ success: true });
        }),
        create: jest.fn()
      },
      webNavigation: {
        onHistoryStateUpdated: { addListener: jest.fn() }
      },
      action: {
        setBadgeText: jest.fn(),
        setTitle: jest.fn()
      }
    };

    worker = new BackgroundServiceWorker();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initializes event listeners and alarm schedules', async () => {
    await worker.init();
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
    expect(chrome.notifications.onClicked.addListener).toHaveBeenCalled();
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('schedules alarms based on notification settings', async () => {
    await worker.setupAlarm();
    await worker.setupWeeklySummaryAlarm();
    await worker.setupDailyNudgeAlarm();

    expect(chrome.alarms.create).toHaveBeenCalledWith('checkFsrsReviews', expect.objectContaining({ periodInMinutes: 30 }));
    expect(chrome.alarms.create).toHaveBeenCalledWith('weeklySummary', expect.anything());
    expect(chrome.alarms.create).toHaveBeenCalledWith('dailyNudge', expect.anything());
  });

  it('handles alarm triggers properly', async () => {
    const checkSpy = jest.spyOn(worker, 'checkDueCards').mockResolvedValue(undefined);
    const summarySpy = jest.spyOn(worker, 'handleWeeklySummary').mockResolvedValue(undefined);
    const nudgeSpy = jest.spyOn(worker, 'handleDailyNudge').mockResolvedValue(undefined);

    worker.handleAlarm({ name: 'checkFsrsReviews' } as chrome.alarms.Alarm);
    expect(checkSpy).toHaveBeenCalled();

    worker.handleAlarm({ name: 'weeklySummary' } as chrome.alarms.Alarm);
    expect(summarySpy).toHaveBeenCalled();

    worker.handleAlarm({ name: 'dailyNudge' } as chrome.alarms.Alarm);
    expect(nudgeSpy).toHaveBeenCalled();
  });

  it('checks due cards and triggers tab notification or system notification', async () => {
    await worker.checkDueCards();
    expect(chrome.tabs.query).toHaveBeenCalled();
  });

  it('generates system review notification correctly', () => {
    worker.createSystemReviewNotification(2, { priority: '2' }, '2 patterns due');
    expect(chrome.notifications.clear).toHaveBeenCalledWith('algo-review-notification', expect.any(Function));
  });

  it('generates weekly summary digest notification', async () => {
    await worker.handleWeeklySummary(true);
    expect(chrome.notifications.clear).toHaveBeenCalledWith('algo-weekly-summary', expect.any(Function));
  });

  it('handles daily nudge notification', async () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = { fsrsActivity: {}, notificationSettings: { enabled: true } };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });

    await worker.handleDailyNudge();
    expect(chrome.notifications.create).toHaveBeenCalledWith('algo-daily-nudge', expect.anything(), expect.any(Function));
  });

  it('shows test notification in active matching tab or system fallback', async () => {
    await worker.showTestNotification();
    expect(chrome.tabs.query).toHaveBeenCalled();
  });

  it('handles notification click events by launching target tabs', () => {
    worker.handleNotificationClicked('algo-review-notification');
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('popup.html') });

    worker.handleNotificationClicked('algo-weekly-summary');
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: expect.stringContaining('summary.html') });
  });

  it('handles message routing for extension actions', () => {
    const sendResponse = jest.fn();

    worker.handleMessage({ action: 'open_fullscreen_editor', url: 'https://algo.monster/problem' }, {} as any, sendResponse);
    expect(chrome.tabs.create).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });
});
