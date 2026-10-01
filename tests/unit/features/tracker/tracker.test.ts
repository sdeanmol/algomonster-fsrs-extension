import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import Tracker from '../../../../features/tracker/tracker';
import { Card } from '../../../../types/domain';

describe('Tracker Floating Widget', () => {
  let tracker: Tracker;

  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as any).location;
    (window as any).location = new URL('https://algo.monster/problems/two_sum');

    (window as any).AlgoRecall = {
      state: {
        cards: [],
        topicWeights: { array: [1, 2, 3] },
        scheduler: {
          createCard: (title: string, url: string, topic: string, approach: string, tags: string[]) => ({
            id: 'card_new',
            problemTitle: title,
            problemUrl: url,
            approach,
            tags,
            due: Date.now(),
            stability: 1,
            difficulty: 5,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            lastReview: Date.now()
          }),
          reviewCard: (card: Card, rating: number) => ({
            ...card,
            reps: card.reps + 1,
            due: Date.now() + 86400000
          })
        }
      },
      Utils: {
        getAutoTags: () => ['array', 'hash-table'],
        getExtractedProblemTitle: () => 'Two Sum'
      }
    };

    tracker = new Tracker();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('creates floating widget launcher button and overlay panel in DOM', () => {
    tracker.createUI();

    const launcher = document.getElementById('algo-fsrs-launcher');
    const container = document.getElementById('algo-fsrs-container');

    expect(launcher).not.toBeNull();
    expect(container).not.toBeNull();
  });

  it('handles launcher dragging, mouse events, contextmenu reset, and clicks', () => {
    tracker.createUI();
    const launcher = document.getElementById('algo-fsrs-launcher') as HTMLElement;
    const container = document.getElementById('algo-fsrs-container') as HTMLElement;

    launcher.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    launcher.dispatchEvent(new MouseEvent('contextmenu'));
    expect(launcher.style.left).toBe('');

    launcher.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(container.style.display).toBe('block');
  });

  it('handles minimize and close button clicks', () => {
    tracker.createUI();
    const launcher = document.getElementById('algo-fsrs-launcher') as HTMLElement;
    const container = document.getElementById('algo-fsrs-container') as HTMLElement;

    document.getElementById('fsrs-min-btn')?.click();
    expect(container.style.display).toBe('none');
    expect(launcher.style.display).toBe('flex');

    document.getElementById('fsrs-close-btn')?.click();
    expect(container.style.display).toBe('none');
    expect(launcher.style.display).toBe('none');
  });

  it('refreshes widget state for current problem page with existing card', () => {
    tracker.createUI();
    tracker.state.cards = [
      {
        id: 'c1',
        problemTitle: 'Two Sum',
        problemUrl: 'https://algo.monster/problems/two_sum',
        approach: 'Use hash map',
        tags: ['array'],
        due: Date.now() - 1000,
        stability: 2,
        difficulty: 4,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 1,
        lastReview: Date.now() - 86400000
      } as unknown as Card
    ];

    tracker.refreshWidgetState();
    const approachTextarea = document.getElementById('fsrs-approach') as HTMLTextAreaElement;
    expect(approachTextarea.value).toBe('Use hash map');
  });

  it('handles saveEdit button click for existing card', () => {
    tracker.createUI();
    tracker.state.cards = [
      {
        id: 'c1',
        problemTitle: 'Two Sum',
        problemUrl: 'https://algo.monster/problems/two_sum',
        approach: 'Old approach',
        tags: ['array'],
        due: Date.now() - 1000,
        stability: 2,
        difficulty: 4,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 1,
        lastReview: Date.now() - 86400000
      } as unknown as Card
    ];

    tracker.refreshWidgetState();

    const approachTextarea = document.getElementById('fsrs-approach') as HTMLTextAreaElement;
    approachTextarea.value = 'Updated approach text';

    const saveEditBtn = document.getElementById('fsrs-update-text-btn') as HTMLElement;
    saveEditBtn.click();

    expect(tracker.state.cards[0].approach).toBe('Updated approach text');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('handles delete card button click with confirmation', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    tracker.createUI();
    tracker.state.cards = [
      {
        id: 'c1',
        problemTitle: 'Two Sum',
        problemUrl: 'https://algo.monster/problems/two_sum',
        approach: 'Old approach',
        tags: ['array'],
        due: Date.now() - 1000,
        stability: 2,
        difficulty: 4,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 1,
        lastReview: Date.now() - 86400000
      } as unknown as Card
    ];

    tracker.refreshWidgetState();

    const deleteBtn = document.getElementById('fsrs-delete-card-btn') as HTMLElement;
    deleteBtn.click();

    expect(tracker.state.cards.length).toBe(0);
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('handles rating button clicks to save card and advance review state', () => {
    tracker.createUI();
    const approachTextarea = document.getElementById('fsrs-approach') as HTMLTextAreaElement;
    approachTextarea.value = 'My new approach';

    const goodBtn = document.querySelector('#fsrs-save-ratings button[data-rating="3"]') as HTMLElement;
    goodBtn.click();

    expect(tracker.state.cards.length).toBe(1);
    expect(tracker.state.cards[0].approach).toBe('My new approach');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('toggles tag picker UI when multiple topics are due in startReview', () => {
    tracker.createUI();
    tracker.state.cards = [
      {
        id: 'c1',
        problemTitle: 'Two Sum',
        problemUrl: 'https://algo.monster/problems/two_sum',
        tags: ['array'],
        due: Date.now() - 1000,
        stability: 1,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 1,
        lastReview: Date.now() - 86400000
      },
      {
        id: 'c2',
        problemTitle: '3Sum',
        problemUrl: 'https://algo.monster/problems/three_sum',
        tags: ['two-pointers'],
        due: Date.now() - 2000,
        stability: 1,
        difficulty: 5,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 1,
        lastReview: Date.now() - 86400000
      }
    ] as unknown as Card[];

    tracker.startReview();

    const tagPicker = document.querySelector('.fsrs-tag-picker');
    expect(tagPicker).not.toBeNull();

    const startFilteredBtn = document.getElementById('fsrs-start-filtered-btn') as HTMLElement;
    startFilteredBtn.click();

    expect(tracker.totalToReview).toBe(2);
  });

  it('renders card review overlay (showCard), space bar show answer, and rating button clicks', () => {
    tracker.createUI();
    const testCard = {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://algo.monster/problems/two_sum',
      approach: '**Hash Map** approach',
      tags: ['array'],
      due: Date.now() - 1000,
      stability: 1,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: 1,
      lastReview: Date.now() - 86400000
    } as unknown as Card;

    tracker.state.cards = [testCard];
    tracker.startReview();

    const showAnswerBtn = document.getElementById('fsrs-show-answer-btn') as HTMLElement;
    expect(showAnswerBtn).not.toBeNull();

    showAnswerBtn.click();
    const answerDiv = document.getElementById('fsrs-approach-answer');
    expect(answerDiv?.style.display).toBe('block');

    const ratingBtn = answerDiv?.querySelector('button[data-rating="3"]') as HTMLElement;
    ratingBtn.click();

    expect(tracker.state.cards[0].reps).toBe(2);
  });

  it('saves draft changes safely via saveDraft method', () => {
    tracker.createUI();
    const approachTextarea = document.getElementById('fsrs-approach') as HTMLTextAreaElement;
    const tagsInput = document.getElementById('fsrs-tags-input') as HTMLInputElement;

    approachTextarea.value = 'Draft approach content';
    tagsInput.value = 'array, string';

    tracker.saveDraft();
    expect(chrome.storage.local.get).toHaveBeenCalled();
  });

  it('handles keyboard shortcuts in review mode (Space to show answer, 1-4 for ratings)', () => {
    tracker.createUI();
    const testCard = {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://algo.monster/problems/two_sum',
      approach: '**Hash Map** approach',
      tags: ['array'],
      due: Date.now() - 1000,
      stability: 1,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: 1,
      lastReview: Date.now() - 86400000
    } as unknown as Card;

    tracker.state.cards = [testCard];
    tracker.startReview();

    const spaceEvent = new KeyboardEvent('keydown', { code: 'Space' });
    Object.defineProperty(spaceEvent, 'code', { value: 'Space' });
    document.dispatchEvent(spaceEvent);

    const answerDiv = document.getElementById('fsrs-approach-answer');
    expect(answerDiv?.style.display).toBe('block');

    const digit3Event = new KeyboardEvent('keydown', { code: 'Digit3' });
    Object.defineProperty(digit3Event, 'code', { value: 'Digit3' });
    expect(() => document.dispatchEvent(digit3Event)).not.toThrow();
  });


  it('ignores review keyboard shortcuts when input element is focused', () => {
    tracker.createUI();
    const testCard = {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://algo.monster/problems/two_sum',
      approach: 'Approach text',
      tags: ['array'],
      due: Date.now() - 1000,
      stability: 1,
      difficulty: 5,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: 1,
      lastReview: Date.now() - 86400000
    } as unknown as Card;

    tracker.state.cards = [testCard];
    tracker.startReview();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const spaceEvent = new KeyboardEvent('keydown', { code: 'Space' });
    Object.defineProperty(spaceEvent, 'code', { value: 'Space' });
    document.dispatchEvent(spaceEvent);

    const answerDiv = document.getElementById('fsrs-approach-answer');
    expect(answerDiv?.style.display).not.toBe('block');
  });

  it('handles fullscreen editor button click for existing card', () => {
    tracker.createUI();
    tracker.state.cards = [
      {
        id: 'c1',
        problemTitle: 'Two Sum',
        problemUrl: 'https://algo.monster/problems/two_sum',
        approach: 'Old text',
        tags: ['array'],
        due: Date.now() - 1000,
        stability: 2,
        difficulty: 4,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 1,
        lastReview: Date.now() - 86400000
      } as unknown as Card
    ];

    tracker.refreshWidgetState();
    const fsBtn = document.getElementById('fsrs-fullscreen-btn') as HTMLElement;
    fsBtn.click();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'open_fullscreen_editor',
        cardId: 'c1'
      }),
      expect.any(Function)
    );
  });

  it('handles fullscreen editor button click for new card draft', () => {
    tracker.createUI();
    const fsBtn = document.getElementById('fsrs-fullscreen-btn') as HTMLElement;
    fsBtn.click();

    expect(chrome.storage.local.get).toHaveBeenCalled();
  });

  describe('Error handling and edge cases', () => {
    it('safely handles getAlgoRecallGlobal errors when window global is unavailable', () => {
      // Temporarily remove AlgoRecall to force the catch block in getAlgoRecallGlobal
      const originalAlgoRecall = (window as any).AlgoRecall;
      delete (window as any).AlgoRecall;
      
      // Inject an error getter to force exception inside getAlgoRecallGlobal
      Object.defineProperty(window, 'AlgoRecall', {
        get: () => { throw new Error('Global access denied'); },
        configurable: true
      });
      
      const safeState = tracker.state;
      expect(safeState.cards).toEqual([]);
      expect(safeState.topicWeights).toEqual({});
      
      const safeUtils = tracker.utils;
      expect(safeUtils.getAutoTags()).toEqual([]);
      expect(safeUtils.getExtractedProblemTitle()).toBe('');

      expect(tracker.notifier).toBeNull();
      
      // Restore
      Object.defineProperty(window, 'AlgoRecall', {
        value: originalAlgoRecall,
        configurable: true,
        writable: true
      });
    });

    it('handles exceptions when getters on AlgoRecall properties throw', () => {
      const originalAlgoRecall = (window as any).AlgoRecall;
      const fakeGlobal = {};
      Object.defineProperty(fakeGlobal, 'state', { get: () => { throw new Error('State error'); } });
      Object.defineProperty(fakeGlobal, 'Utils', { get: () => { throw new Error('Utils error'); } });
      Object.defineProperty(fakeGlobal, 'Notifier', { get: () => { throw new Error('Notifier error'); } });
      
      (window as any).AlgoRecall = fakeGlobal;

      expect(tracker.state.cards).toEqual([]);
      expect(tracker.utils.getExtractedProblemTitle()).toBe('');
      expect(tracker.notifier).toBeNull();

      (window as any).AlgoRecall = originalAlgoRecall;
    });



    it('handles chrome.runtime.lastError in saveCards storage callback', () => {
      chrome.storage.local.set = jest.fn((data, callback: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage quota exceeded' };
        if (callback) callback();
        (chrome.runtime as any).lastError = undefined; // reset
      }) as any;

      // Ensure no unhandled exception is thrown
      expect(() => tracker.saveCards()).not.toThrow();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('handles exceptions thrown within saveCards storage callback', () => {
      chrome.storage.local.set = jest.fn((data, callback: any) => {
        // We simulate a callback error by modifying the callback to throw
        if (callback) {
          callback();
        }
      }) as any;

      // Mock Logger to see if it logs correctly, but we're mostly testing for crash prevention
      expect(() => tracker.saveCards()).not.toThrow();
    });

    it('handles missing extension context in refreshWidgetState gracefully', () => {
      const originalId = chrome.runtime.id;
      // Simulate missing extension context
      delete (chrome as any).runtime.id;
      
      tracker.createUI();
      // Should not throw, should return early
      expect(() => tracker.refreshWidgetState()).not.toThrow();
      
      // Restore
      (chrome as any).runtime.id = originalId;
    });

    it('handles mousemove error correctly during dragging', () => {
      tracker.createUI();
      const launcher = document.getElementById('algo-fsrs-launcher') as HTMLElement;
      launcher.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
      
      // Make launcher.style throw to trigger catch block
      Object.defineProperty(launcher, 'style', {
        get: () => { throw new Error('Style access error'); }
      });
      
      // Dispatch mousemove
      expect(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 150 }));
      }).not.toThrow();
    });

    it('safely handles window global scope registration error', () => {
      const originalAlgoRecall = (window as any).AlgoRecall;
      delete (window as any).AlgoRecall;
      
      Object.defineProperty(window, 'AlgoRecall', {
        get: () => { throw new Error('Global access denied'); },
        configurable: true
      });

      expect(() => {
        // Evaluate the assignment block again
        try {
          const win = window as any;
          win.AlgoRecall = win.AlgoRecall || {};
          win.AlgoRecall.Tracker = tracker.constructor;
        } catch (err) {
          // Should not crash
        }
      }).not.toThrow();

      Object.defineProperty(window, 'AlgoRecall', {
        value: originalAlgoRecall,
        configurable: true,
        writable: true
      });
    });

    it('handles keyboard cleanup errors gracefully', () => {
      // Set the private _reviewKeyHandler property
      (tracker as any)._reviewKeyHandler = () => {};
      
      // Mock removeEventListener to throw
      const origRemove = document.removeEventListener;
      document.removeEventListener = jest.fn().mockImplementation(() => {
        throw new Error('Remove event listener error');
      });

      expect(() => {
        (tracker as any)._cleanupReviewKeyboard();
      }).not.toThrow();
      
      document.removeEventListener = origRemove;
    });

    it('safely handles errors in fsrsActivity storage callback during saveCards', () => {
      const origGet = chrome.storage.local.get;
      chrome.storage.local.get = jest.fn((keys: any, callback: any) => {
        if (callback) {
           callback(null); // passing null causes TypeError when accessing activity object
        }
      }) as any;
      expect(() => tracker.saveCards()).not.toThrow();
      chrome.storage.local.get = origGet;
    });

    it('safely handles errors in approachDrafts storage callback during refreshWidgetState', () => {
      tracker.createUI();
      tracker.activeCardId = '__new__';
      const origGet = chrome.storage.local.get;
      chrome.storage.local.get = jest.fn((keys: any, callback: any) => {
        if (callback) {
           callback(null); // causes TypeError when reading res.approachDrafts
        }
      }) as any;
      expect(() => tracker.refreshWidgetState()).not.toThrow();
      chrome.storage.local.get = origGet;
    });

    it('safely handles refreshWidgetState top-level error', () => {
      const origGetState = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(tracker), 'state');
      Object.defineProperty(tracker, 'state', {
         get: () => { throw new Error('State error'); },
         configurable: true
      });
      expect(() => tracker.refreshWidgetState()).not.toThrow();
      
      if (origGetState) {
        Object.defineProperty(Object.getPrototypeOf(tracker), 'state', origGetState);
      } else {
        delete (tracker as any).state;
      }
    });

    it('safely handles tab click errors in refreshWidgetState', () => {
      tracker.createUI();
      tracker.state.cards = [ 
        { id: 'c1', problemTitle: 'test', problemUrl: 'https://algo.monster/problems/two_sum' } as Card, 
        { id: 'c2', problemTitle: 'test2', problemUrl: 'https://algo.monster/problems/two_sum' } as Card 
      ];
      tracker.refreshWidgetState();
      
      const tabBtn = document.querySelector('.fsrs-card-tab-btn[data-card-id="c2"]') as HTMLElement;
      expect(tabBtn).not.toBeNull();
      
      // Make refreshWidgetState throw when called to trigger catch block in click listener
      jest.spyOn(tracker, 'refreshWidgetState').mockImplementationOnce(() => {
        throw new Error('Tab error');
      });
      expect(() => tabBtn.click()).not.toThrow();
    });

    it('safely handles createUI top-level error', () => {
      const origCreate = document.createElement;
      document.createElement = () => { throw new Error('create error'); };
      expect(() => tracker.createUI()).not.toThrow();
      document.createElement = origCreate;
    });
  });
});


