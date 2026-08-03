import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import Tracker from '../../features/tracker/tracker';
import { Card } from '../../types/domain';

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
});


