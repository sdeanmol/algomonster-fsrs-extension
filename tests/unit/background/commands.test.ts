import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlgoRecallBackground } from '../../../background/background';
import { ActionService, CommandActionId } from '../../../features/common/services/actionService';
import { BackupManager } from '../../../features/common/data/backupManager';
import { BROWSER_CONFIG } from '../../../features/common/browserConfig';
import { Card } from '../../../types/domain';

jest.mock('../../../features/common/data/backupManager', () => ({
  BackupManager: {
    exportBackup: jest.fn().mockImplementation(() => Promise.resolve()),
    importBackup: jest.fn().mockImplementation(() => Promise.resolve())
  }
}));

describe('Keyboard Shortcuts & Command Dispatcher', () => {
  let background: AlgoRecallBackground;
  let storedData: Record<string, any>;

  const getMockCards = (): Card[] => [
    {
      id: 'card-1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      approach: 'Use a hash map to look up complements in O(n) time.',
      tags: ['Array', 'Hash Table'],
      due: Date.now() - 5000,
      stability: 3,
      difficulty: 2,
      elapsed_days: 1,
      scheduled_days: 1,
      learning_steps: 1,
      reps: 2,
      lapses: 0,
      state: 1,
      last_review: Date.now() - 86400000,
      historyLog: []
    },
    {
      id: 'card-2',
      problemTitle: 'Reverse Linked List',
      problemUrl: 'https://leetcode.com/problems/reverse-linked-list',
      approach: 'Iterative pointer reversal.',
      tags: ['Linked List'],
      due: Date.now() + 86400000,
      stability: 10,
      difficulty: 1,
      elapsed_days: 3,
      scheduled_days: 7,
      learning_steps: 3,
      reps: 5,
      lapses: 0,
      state: 2,
      last_review: Date.now() - 10000,
      historyLog: []
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    storedData = {
      theme: 'dark',
      extensionSettings: {
        showMarkerPopup: true,
        showLauncher: true,
        showCharts: true,
        developerMode: false
      },
      notificationSettings: {
        enabled: true,
        frequency: '60',
        priority: '2',
        requireInteraction: true
      },
      fsrsCards: getMockCards(),
      whitelistedWebsites: [{ domain: 'leetcode.com' }]
    };

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      let result: any = {};
      if (keys === null || keys === undefined) {
        result = { ...storedData };
      } else if (typeof keys === 'string') {
        result = { [keys]: storedData[keys] };
      } else if (Array.isArray(keys)) {
        keys.forEach((k) => { result[k] = storedData[k]; });
      }
      if (typeof cb === 'function') cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((items: any, cb?: any) => {
      Object.assign(storedData, items);
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    });

    (chrome.tabs.create as jest.Mock).mockImplementation((options: any, cb?: any) => {
      const tab = { id: 999, ...options };
      if (typeof cb === 'function') cb(tab);
      return Promise.resolve(tab);
    });

    if (chrome.downloads) {
      chrome.downloads.download = jest.fn().mockImplementation((options: any, cb?: any) => {
        if (typeof cb === 'function') cb(123);
        return Promise.resolve(123);
      }) as any;
    }

    (global as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    (global as any).URL.revokeObjectURL = jest.fn();

    background = new AlgoRecallBackground();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Commands Event Listener Registration', () => {
    it('registers onCommand listener in bindEvents', async () => {
      await background.init();
      expect(chrome.commands.onCommand.addListener).toHaveBeenCalled();
    });
  });

  describe('Direct Action Execution', () => {
    it('executes check-due-reviews by triggering review check and badge update', async () => {
      const checkDueCardsSpy = jest.spyOn(background, 'checkDueCards').mockResolvedValue(undefined as any);
      const updateDueCardsBadgeSpy = jest.spyOn(background, 'updateDueCardsBadge').mockResolvedValue(2);

      await background.handleCommand('check-due-reviews');

      expect(checkDueCardsSpy).toHaveBeenCalledWith('manual');
      expect(updateDueCardsBadgeSpy).toHaveBeenCalled();
    });

    it('executes export-backup via BackupManager', async () => {
      await background.handleCommand('export-backup');
      expect(BackupManager.exportBackup).toHaveBeenCalled();
    });

    it('executes export-anki and formats card deck properly', async () => {
      const cards = getMockCards();
      const ankiText = ActionService.formatCardsForAnki(cards);

      expect(ankiText).toContain('#deck:AlgoRecall');
      expect(ankiText).toContain('#separator:tab');
      expect(ankiText).toContain('Two Sum');
      expect(ankiText).toContain('Reverse Linked List');
      expect(ankiText).toContain('algorecall::Array');
      expect(ankiText).toContain('algorecall::Linked_List');

      const result = await ActionService.executeAction('export-anki');
      expect(result.success).toBe(true);
      expect((result.data as any).cardCount).toBe(2);
    });
  });

  describe('Toggle Action Execution', () => {
    it('toggles theme from dark to light and back to dark', async () => {
      storedData.theme = 'dark';
      await background.handleCommand('toggle-theme');
      expect(storedData.theme).toBe('light');

      await background.handleCommand('toggle-theme');
      expect(storedData.theme).toBe('dark');
    });

    it('toggles floating highlighter marker menu setting', async () => {
      storedData.extensionSettings.showMarkerPopup = true;
      await background.handleCommand('toggle-floating-marker');
      expect(storedData.extensionSettings.showMarkerPopup).toBe(false);

      await background.handleCommand('toggle-floating-marker');
      expect(storedData.extensionSettings.showMarkerPopup).toBe(true);
    });

    it('toggles problem tracker launcher setting', async () => {
      storedData.extensionSettings.showLauncher = true;
      await background.handleCommand('toggle-algo-launcher');
      expect(storedData.extensionSettings.showLauncher).toBe(false);

      await background.handleCommand('toggle-algo-launcher');
      expect(storedData.extensionSettings.showLauncher).toBe(true);
    });

    it('toggles review reminder notifications setting', async () => {
      storedData.notificationSettings.enabled = true;
      await background.handleCommand('toggle-notifications');
      expect(storedData.notificationSettings.enabled).toBe(false);

      await background.handleCommand('toggle-notifications');
      expect(storedData.notificationSettings.enabled).toBe(true);
    });
  });

  describe('Navigation Action Execution', () => {
    const navigationCases: [CommandActionId, string][] = [
      ['open-analytics', 'features/dashboard/analytics/analytics.html'],
      ['open-pomodoro', 'features/dashboard/pomodoro/pomodoro.html'],
      ['open-study-plan', 'features/dashboard/studyplan/studyplan.html'],
      ['open-forecast', 'features/dashboard/forecast/forecast.html'],
      ['open-history', 'features/dashboard/history/history.html'],
      ['open-heatmap', 'features/dashboard/heatmap/heatmap.html'],
      ['view-all-cards', 'features/common/data/data.html?view=total'],
      ['view-due-cards', 'features/common/data/data.html?view=due'],
      ['view-retention-cards', 'features/common/data/data.html?view=retention'],
      ['open-highlights-manager', 'features/highlighter/manager/highlights.html'],
      ['open-highlights-options', 'features/highlighter/options/highlightOptions.html'],
      ['open-summary', 'features/dashboard/summary/summary.html'],
      ['open-websites-manager', 'features/common/websites/websites.html'],
      ['open-fsrs-config', 'features/tracker/config/fsrsConfig.html'],
      ['open-help', 'features/common/help/help.html']
    ];

    it.each(navigationCases)('handles command %s by opening %s', async (command: CommandActionId, expectedPage: string) => {
      await background.handleCommand(command);

      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(expectedPage)
        }),
        expect.any(Function)
      );
    });

    it('handles rate-extension command by opening the store review URL', async () => {
      await background.handleCommand('rate-extension');

      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringMatching(/chromewebstore|addons\.mozilla|apps\.apple/)
        }),
        expect.any(Function)
      );
    });
  });

  describe('Resilience and Error Handling', () => {
    it('handles unknown command gracefully without crashing', async () => {
      await expect(background.handleCommand('non-existent-command' as any)).resolves.not.toThrow();
    });

    it('catches and logs execution errors gracefully', async () => {
      const spy = jest.spyOn(ActionService, 'executeAction').mockRejectedValue(new Error('Fatal error'));
      await expect(background.handleCommand('toggle-theme')).resolves.not.toThrow();
      spy.mockRestore();
    });

    it('handles Anki export failure when no cards exist', async () => {
      storedData.fsrsCards = [];
      const result = await ActionService.executeAction('export-anki');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No cards to export');
    });

    it('handles chrome.tabs.create error gracefully', async () => {
      (chrome.tabs.create as jest.Mock).mockImplementation(() => {
        throw new Error('Tab error');
      });
      const tab = await ActionService.openExtensionPage('test.html');
      expect(tab).toBeNull();
    });
  });

  describe('Decoupling from Popup UI', () => {
    it('executes shortcuts independently from popup DOM elements', async () => {
      // Empty popup DOM body completely to verify popup-independent execution
      document.body.innerHTML = '';

      // Theme toggle in pure background context
      const themeResult = await ActionService.executeAction('toggle-theme');
      expect(themeResult.success).toBe(true);
      expect(themeResult.data).toHaveProperty('theme');

      // Navigation in pure background context
      const navResult = await ActionService.executeAction('open-study-plan');
      expect(navResult.success).toBe(true);

      // Review check in pure background context
      const checkResult = await ActionService.executeAction('check-due-reviews', {
        background: {
          checkDueCards: async () => {},
          updateDueCardsBadge: async () => 3
        }
      });
      expect(checkResult.success).toBe(true);
      expect((checkResult.data as any).dueCount).toBe(3);
    });
  });
});
