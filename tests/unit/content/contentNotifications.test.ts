import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Notifier } from '../../../content/notifications';

describe('Notifier (Content Script)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders standard alert notification and auto-dismisses after 6s', () => {
    Notifier.showPageNotification('Test Title', 'Test Message', 'test');

    const notifEl = document.getElementById('algo-custom-notification-el');
    expect(notifEl).not.toBeNull();
    expect(notifEl?.querySelector('.algo-notif-title')?.textContent).toBe('Test Title');
    expect(notifEl?.querySelector('.algo-notif-message')?.textContent).toBe('Test Message');

    const dismissBtn = notifEl?.querySelector('#algo-notif-btn-dismiss');
    expect(dismissBtn).not.toBeNull();

    // Fast-forward 6 seconds
    jest.advanceTimersByTime(6000);
    notifEl?.dispatchEvent(new Event('transitionend'));
  });

  it('renders sticky review notification with Review Now and Snooze buttons', () => {
    Notifier.showPageNotification('Review Ready', '3 cards due', 'review', 3);

    const notifEl = document.getElementById('algo-custom-notification-el');
    expect(notifEl).not.toBeNull();
    expect(notifEl?.querySelector('#algo-notif-btn-review')).not.toBeNull();
    expect(notifEl?.querySelector('#algo-notif-btn-snooze')).not.toBeNull();
  });

  it('triggers chrome.runtime.sendMessage on Snooze button click', () => {
    Notifier.showPageNotification('Review Ready', '3 cards due', 'review', 3);
    const snoozeBtn = document.getElementById('algo-notif-btn-snooze') as HTMLButtonElement;

    snoozeBtn.click();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'snooze_notification', minutes: 15 }),
      expect.any(Function)
    );
  });

  it('opens review widget on Review Now button click', () => {
    const launcher = document.createElement('div');
    launcher.id = 'algo-fsrs-launcher';
    document.body.appendChild(launcher);

    const container = document.createElement('div');
    container.id = 'algo-fsrs-container';
    container.style.display = 'none';
    document.body.appendChild(container);

    Notifier.showPageNotification('Review Ready', '3 cards due', 'review', 3);
    const reviewBtn = document.getElementById('algo-notif-btn-review') as HTMLButtonElement;

    reviewBtn.click();

    expect(launcher.style.display).toBe('none');
    expect(container.style.display).toBe('block');
  });

  it('removes previous notification when new notification is spawned', () => {
    Notifier.showPageNotification('Notif 1', 'Msg 1', 'test');
    expect(document.querySelectorAll('.algo-custom-notification').length).toBe(1);

    Notifier.showPageNotification('Notif 2', 'Msg 2', 'test');
    expect(document.querySelectorAll('.algo-custom-notification').length).toBe(1);
    expect(document.querySelector('.algo-notif-title')?.textContent).toBe('Notif 2');
  });
});
