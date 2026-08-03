import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RatingComponent } from '../../../../../features/dashboard/popup/rating';
import { DashboardCoordinator } from '../../../../../features/dashboard/popup/DashboardComponent';

describe('RatingComponent (Popup)', () => {
  let component: RatingComponent;
  let mockCoordinator: DashboardCoordinator;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;

    document.body.innerHTML = `
      <div id="rating-prompt-card" class="hide-panel">
        <div id="rating-prompt-state"></div>
        <div id="rating-thanks-state"></div>
        <a id="rate-store-btn" href="https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID/reviews">Rate</a>
        <button id="snooze-rate-btn">Snooze</button>
        <button id="already-rated-btn">Already Rated</button>
        <button id="edit-rating-btn">Edit Rating</button>
      </div>
    `;

    mockCoordinator = {
      showStatus: jest.fn()
    };

    (chrome as any).runtime = {
      id: 'mock-extension-id',
      lastError: undefined
    };

    (chrome as any).tabs = {
      create: jest.fn()
    };

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any) => {
      return Promise.resolve({
        ratingPromptState: { status: 'unrated', snoozedUntil: 0 },
        fsrsCards: [{ id: 'c1' }]
      });
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any) => Promise.resolve());

    component = new RatingComponent(mockCoordinator);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('load', () => {
    it('returns early if rating-prompt-card is missing', async () => {
      document.body.innerHTML = '';
      await expect(component.load()).resolves.not.toThrow();
    });

    it('replaces YOUR_EXTENSION_ID in rate store link with runtime extension ID', async () => {
      await component.load();

      const rateBtn = document.getElementById('rate-store-btn') as HTMLAnchorElement;
      expect(rateBtn.href).toContain('mock-extension-id');
    });

    it('shows unrated prompt state when cards count >= 1 and hides when cards count == 0', async () => {
      await component.load();
      const card = document.getElementById('rating-prompt-card');
      expect(card?.classList.contains('hide-panel')).toBe(false);

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          ratingPromptState: { status: 'unrated', snoozedUntil: 0 },
          fsrsCards: []
        });
      });

      await component.load();
      expect(card?.classList.contains('hide-panel')).toBe(true);
    });

    it('shows thanks state when status is rated and hides when status is active snoozed', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          ratingPromptState: { status: 'rated', snoozedUntil: 0 },
          fsrsCards: [{ id: 'c1' }]
        });
      });

      await component.load();
      const thanksState = document.getElementById('rating-thanks-state');
      expect(thanksState?.classList.contains('hide-panel')).toBe(false);

      // Active snoozed status (unexpired)
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          ratingPromptState: { status: 'snoozed', snoozedUntil: Date.now() + 86400000 },
          fsrsCards: [{ id: 'c1' }]
        });
      });

      await component.load();
      const card = document.getElementById('rating-prompt-card');
      expect(card?.classList.contains('hide-panel')).toBe(true);
    });

    it('resets snoozed status to unrated if snooze period expired', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          ratingPromptState: { status: 'snoozed', snoozedUntil: Date.now() - 1000 },
          fsrsCards: [{ id: 'c1' }]
        });
      });

      await component.load();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingPromptState: expect.objectContaining({ status: 'unrated' })
        })
      );
    });

    it('handles storage load error gracefully', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        return Promise.reject(new Error('Storage error'));
      });

      await expect(component.load()).resolves.not.toThrow();
    });
  });

  describe('bindEvents and action button error boundaries', () => {
    it('snoozes rating prompt for 7 days when clicking snoozeBtn', async () => {
      component.bindEvents();

      const snoozeBtn = document.getElementById('snooze-rate-btn');
      snoozeBtn?.click();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingPromptState: expect.objectContaining({ status: 'snoozed' })
        })
      );
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Notification paused for 7 days!');
    });

    it('saves already rated state when clicking alreadyBtn', async () => {
      component.bindEvents();

      const alreadyBtn = document.getElementById('already-rated-btn');
      alreadyBtn?.click();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        ratingPromptState: { status: 'rated', snoozedUntil: 0 }
      });
      expect(mockCoordinator.showStatus).toHaveBeenCalledWith('Thank you for your rating!');
    });

    it('resets rating prompt to unrated when clicking editBtn', async () => {
      component.bindEvents();

      const editBtn = document.getElementById('edit-rating-btn');
      editBtn?.click();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
      });
    });

    it('handles exceptions inside button click listeners gracefully', async () => {
      component.bindEvents();

      (chrome.storage.local.set as jest.Mock).mockImplementation(() => {
        throw new Error('Storage set error');
      });

      const snoozeBtn = document.getElementById('snooze-rate-btn');
      const alreadyBtn = document.getElementById('already-rated-btn');
      const editBtn = document.getElementById('edit-rating-btn');

      expect(() => snoozeBtn?.click()).not.toThrow();
      expect(() => alreadyBtn?.click()).not.toThrow();
      expect(() => editBtn?.click()).not.toThrow();
    });

    it('returns early from bindEvents if card is missing or handles outer errors', () => {
      document.body.innerHTML = '';
      expect(() => component.bindEvents()).not.toThrow();

      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('DOM error'); };

      expect(() => component.bindEvents()).not.toThrow();

      document.getElementById = origGEBI;
    });
  });
});
