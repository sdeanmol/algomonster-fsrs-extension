import { h, render } from 'preact';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    TrackerFloatingLauncher,
    TrackerHeader,
    TrackerNavBar,
    TrackerRatingBar,
    TrackerCardReviewView,
    TrackerApp,
    Tracker
} from '../../../../features/tracker/tracker';
import { Card } from '../../../../types/domain';

describe('Tracker Preact Components', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        jest.clearAllMocks();
    });

    describe('TrackerFloatingLauncher', () => {
        it('renders launcher button and handles click', () => {
            const onClick = jest.fn();
            render(
                <TrackerFloatingLauncher
                    isOpen={false}
                    onClick={onClick as any}
                />,
                container
            );

            const launcher = container.querySelector('#algo-fsrs-launcher');
            expect(launcher).toBeTruthy();
            expect(launcher?.getAttribute('role')).toBe('button');
            expect(launcher?.getAttribute('aria-label')).toBe('Open AlgoRecall Tracker');
            expect(launcher?.getAttribute('aria-expanded')).toBe('false');

            const svg = container.querySelector('svg.launcher-svg');
            expect(svg).toBeTruthy();

            (launcher as HTMLElement).click();
            expect(onClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('TrackerHeader', () => {
        it('renders title, minimize button, and close button', () => {
            const onMinimize = jest.fn();
            const onClose = jest.fn();
            render(
                <TrackerHeader
                    onMinimize={onMinimize as any}
                    onClose={onClose as any}
                />,
                container
            );

            expect(container.textContent).toContain('AlgoRecall Tracker');

            const minBtn = container.querySelector('#fsrs-min-btn') as HTMLElement;
            expect(minBtn).toBeTruthy();
            expect(minBtn?.getAttribute('aria-label')).toBe('Minimize');
            minBtn.click();
            expect(onMinimize).toHaveBeenCalledTimes(1);

            const closeBtn = container.querySelector('#fsrs-close-btn') as HTMLElement;
            expect(closeBtn).toBeTruthy();
            expect(closeBtn?.getAttribute('aria-label')).toBe('Close');
            closeBtn.click();
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('TrackerNavBar', () => {
        const mockCards: Card[] = [
            {
                id: 'card-1',
                problemTitle: 'Two Sum',
                problemUrl: 'https://leetcode.com/problems/two-sum',
                tags: ['Array', 'Hash Table'],
                difficulty: 'Easy',
                state: 1
            } as any,
            {
                id: 'card-2',
                problemTitle: '3Sum',
                problemUrl: 'https://leetcode.com/problems/3sum',
                tags: ['Two Pointers'],
                difficulty: 'Medium',
                state: 2
            } as any
        ];

        it('renders card tabs and handles selection and add card', () => {
            const onSelectCard = jest.fn();
            const onAddCard = jest.fn();
            render(
                <TrackerNavBar
                    cards={mockCards}
                    activeCardId="card-1"
                    onSelectCard={onSelectCard as any}
                    onAddCard={onAddCard as any}
                />,
                container
            );

            expect(container.textContent).toContain('Card 1 (Array, Hash Table)');
            expect(container.textContent).toContain('Card 2 (Two Pointers)');
            expect(container.textContent).toContain('+ Add Card');

            const buttons = container.querySelectorAll('.fsrs-card-tab-btn');
            expect(buttons.length).toBe(3); // 2 cards + 1 add card

            (buttons[1] as HTMLElement).click();
            expect(onSelectCard).toHaveBeenCalledWith('card-2');

            (buttons[2] as HTMLElement).click();
            expect(onAddCard).toHaveBeenCalledTimes(1);
        });
    });

    describe('TrackerRatingBar', () => {
        it('renders 4 rating buttons and invokes onRate with rating number', () => {
            const onRate = jest.fn();
            render(<TrackerRatingBar onRate={onRate as any} lastRating={3} existingId="card-123" />, container);

            const wrapper = container.querySelector('#fsrs-save-ratings');
            expect(wrapper?.getAttribute('data-existing-id')).toBe('card-123');

            const againBtn = container.querySelector('.fsrs-btn-again') as HTMLButtonElement;
            const hardBtn = container.querySelector('.fsrs-btn-hard') as HTMLButtonElement;
            const goodBtn = container.querySelector('.fsrs-btn-good') as HTMLButtonElement;
            const easyBtn = container.querySelector('.fsrs-btn-easy') as HTMLButtonElement;

            expect(againBtn).toBeTruthy();
            expect(hardBtn).toBeTruthy();
            expect(goodBtn).toBeTruthy();
            expect(easyBtn).toBeTruthy();

            againBtn.click();
            expect(onRate).toHaveBeenCalledWith(1);

            hardBtn.click();
            expect(onRate).toHaveBeenCalledWith(2);

            goodBtn.click();
            expect(onRate).toHaveBeenCalledWith(3);

            easyBtn.click();
            expect(onRate).toHaveBeenCalledWith(4);
        });
    });

    describe('TrackerCardReviewView', () => {
        const mockCard: Card = {
            id: 'card-1',
            problemTitle: 'Reverse Linked List',
            problemUrl: 'https://leetcode.com/problems/reverse-linked-list',
            approach: 'Use 3 pointers: prev, curr, next',
            tags: ['LinkedList', 'Recursion'],
            difficulty: 'Easy',
            state: 2
        } as any;

        it('renders full card details, tags, ratings, and triggers callbacks', () => {
            const onRate = jest.fn();
            const onBack = jest.fn();
            const onShowAnswer = jest.fn();

            render(
                <TrackerCardReviewView
                    card={mockCard}
                    index={1}
                    total={5}
                    activeFilter="LinkedList"
                    isAnswerShown={true}
                    onShowAnswer={onShowAnswer as any}
                    onBack={onBack as any}
                    onRate={onRate as any}
                />,
                container
            );

            expect(container.textContent).toContain('Reverse Linked List');
            expect(container.textContent).toContain('LinkedList');
            expect(container.textContent).toContain('Recursion');
            expect(container.textContent).toContain('1 of 5');
            expect(container.textContent).toContain('Use 3 pointers: prev, curr, next');

            // Rating button inside review
            const againBtn = container.querySelector('[data-rating="1"]') as HTMLButtonElement;
            againBtn.click();
            expect(onRate).toHaveBeenCalledWith(1);

            // Back button
            const backBtn = container.querySelector('#fsrs-back-btn') as HTMLElement;
            backBtn.click();
            expect(onBack).toHaveBeenCalledTimes(1);
        });
    });

    describe('TrackerApp Feedback Banner, Focus Trap & Case-Insensitive Weights', () => {
        it('GAP-014: showReviewFeedback displays #fsrs-feedback-banner with daily goal progress and hides after 2.5s', () => {
            jest.useFakeTimers();
            const tracker = new Tracker();
            render(<TrackerApp tracker={tracker} />, container);

            const today = new Date();
            const dateString = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

            (chrome.storage.local.get as any).mockImplementation((_keys: any, cb: (res: any) => void) => {
                cb({ fsrsActivity: { [dateString]: 10 }, dailyGoalTarget: 10 });
            });

            tracker.showReviewFeedback();

            const banner = container.querySelector('#fsrs-feedback-banner') as HTMLElement;
            expect(banner).not.toBeNull();
            expect(banner.style.display).toBe('block');
            expect(banner.classList.contains('fsrs-feedback-visible')).toBe(true);
            expect(banner.textContent).toContain('Daily goal reached! (10/10)');

            jest.advanceTimersByTime(2500);
            expect(banner.style.display).toBe('none');
            expect(banner.classList.contains('fsrs-feedback-visible')).toBe(false);
            jest.useRealTimers();
        });

        it('GAP-015: Tab and Shift+Tab trap focus inside #algo-fsrs-container', () => {
            const tracker = new Tracker();
            render(<TrackerApp tracker={tracker} />, container);

            const modal = container.querySelector('#algo-fsrs-container') as HTMLElement;
            const focusable = Array.from(
                modal.querySelectorAll<HTMLElement>('button, input, textarea, [tabindex]:not([tabindex="-1"])')
            ).filter(el => !el.hasAttribute('disabled') && el.style.display !== 'none');

            expect(focusable.length).toBeGreaterThan(1);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            // Tab on last element wraps to first
            last.focus();
            const firstFocusSpy = jest.spyOn(first, 'focus');
            modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
            expect(firstFocusSpy).toHaveBeenCalled();

            // Shift+Tab on first element wraps to last
            first.focus();
            const lastFocusSpy = jest.spyOn(last, 'focus');
            modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
            expect(lastFocusSpy).toHaveBeenCalled();
        });

        it('GAP-016: handleRating matches topicWeights case-insensitively', () => {
            const tracker = new Tracker();
            const customW = Array(17).fill(0.5);
            const reviewCardSpy = jest.fn((card: Card) => card);
            (window as any).AlgoRecall = {
                state: {
                    cards: [{ id: 'c1', url: 'https://example.com', tags: ['tag-1'], approach: 'test' } as unknown as Card],
                    tagRegistry: [{ id: 'tag-1', name: 'Dynamic Programming' }],
                    topicWeights: { 'dynamic programming': customW },
                    scheduler: { reviewCard: reviewCardSpy }
                },
                Utils: { getAutoTags: () => [], getExtractedProblemTitle: () => 'Test' }
            };

            tracker.handleRating((window as any).AlgoRecall.state.cards[0], 3, 1000);
            expect(reviewCardSpy).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'c1' }),
                3,
                customW,
                expect.any(Number),
                1000
            );
        });
    });
});
