import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlgoRecallOrchestrator } from '../../content/content';

describe('AlgoRecallOrchestrator (Content Script)', () => {
  let orchestrator: AlgoRecallOrchestrator;

  beforeEach(() => {
    document.body.innerHTML = '';
    jest.useFakeTimers();

    // Stub window location hostname
    delete (window as any).location;
    (window as any).location = new URL('https://algo.monster/problems/two_sum');

    orchestrator = new AlgoRecallOrchestrator();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (orchestrator && orchestrator.domObserver) {
      orchestrator.domObserver.disconnect();
    }
    document.body.innerHTML = '';
  });

  it('initializes components and verifies domain whitelisting during init()', async () => {
    const getSpy = jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
      callback({
        whitelistedWebsites: [{ domain: 'algo.monster' }],
        fsrsCards: [],
        theme: 'dark'
      });
    });

    await orchestrator.init();
    expect(getSpy).toHaveBeenCalled();
    expect(orchestrator.state.currentTheme).toBe('dark');
  });

  it('exits init early if host domain is not whitelisted', async () => {
    delete (window as any).location;
    (window as any).location = new URL('https://unsupported-domain.com/test');

    const trackerCreateSpy = jest.spyOn(orchestrator.tracker, 'createUI');

    jest.spyOn(chrome.storage.local, 'get').mockImplementation((keys: any, callback: any) => {
      callback({
        whitelistedWebsites: [{ domain: 'algo.monster' }]
      });
    });

    await orchestrator.init();
    expect(trackerCreateSpy).not.toHaveBeenCalled();
  });

  it('handles storage changes dynamically (theme, cards, params)', () => {
    orchestrator.handleStorageChanged({
      theme: { newValue: 'light' },
      fsrsCards: { newValue: [{ id: 'card-1' }] }
    }, 'local');

    expect(orchestrator.state.currentTheme).toBe('light');
    expect(orchestrator.state.cards.length).toBe(1);
  });

  it('handles incoming runtime messages (show_custom_notification)', () => {
    const notifierSpy = jest.spyOn(orchestrator.notifier, 'showPageNotification').mockImplementation(() => {});
    const sendResponse = jest.fn();

    orchestrator.handleMessage({
      action: 'show_custom_notification',
      title: 'Alarm',
      message: 'Time to review',
      type: 'review',
      count: 2
    }, {} as any, sendResponse);

    expect(notifierSpy).toHaveBeenCalledWith('Alarm', 'Time to review', 'review', 2);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('applies light/dark theme CSS classes to widgets', () => {
    const launcher = document.createElement('div');
    launcher.id = 'algo-fsrs-launcher';
    document.body.appendChild(launcher);

    orchestrator.state.currentTheme = 'light';
    orchestrator.applyThemeClass();

    expect(launcher.classList.contains('light-theme')).toBe(true);

    orchestrator.state.currentTheme = 'dark';
    orchestrator.applyThemeClass();
    expect(launcher.classList.contains('light-theme')).toBe(false);
  });
});
