require('../../features/tracker/tracker.js');
const FsrsScheduler = require('../../features/tracker/scheduler/fsrsScheduler.js');
const mockCards = require('../fixtures/mockCards.js');

describe('Tracker Integration', () => {
    let tracker;

    beforeEach(() => {
        document.body.innerHTML = '';
        
        // Setup mock global namespace expected by Tracker
        window.AlgoRecall = window.AlgoRecall || {};
        window.AlgoRecall.state = {
            currentTheme: 'dark',
            whitelistedWebsites: ['leetcode.com'],
            cards: JSON.parse(JSON.stringify(mockCards)),
            scheduler: new FsrsScheduler(),
            topicWeights: { 'Array': { m: 1.1, w: [1, 2, 3, 4] } }
        };

        Object.assign(window.AlgoRecall, {
            Utils: { 
                getAutoTags: jest.fn(() => ['MockTag']),
                getExtractedProblemTitle: jest.fn(() => 'Test')
            },
            saveData: jest.fn(callback => { if (callback) callback(); }),
            isAllowedDomain: jest.fn(() => true),
            Notifier: { show: jest.fn() }
        });

        // Mock alert
        global.alert = jest.fn();
        
        tracker = new window.AlgoRecall.Tracker();
    });

    afterEach(() => {
        tracker._cleanupReviewKeyboard();
    });

    it('injects UI correctly', () => {
        tracker.createUI();
        
        const launcher = document.getElementById('algo-fsrs-launcher');
        expect(launcher).not.toBeNull();
        expect(launcher.getAttribute('role')).toBe('button');

        const container = document.getElementById('algo-fsrs-container');
        expect(container).not.toBeNull();
        expect(container.style.display).toBe('none');
    });

    it('opens widget when launcher is clicked', () => {
        tracker.createUI();
        const launcher = document.getElementById('algo-fsrs-launcher');
        const container = document.getElementById('algo-fsrs-container');

        launcher.click();

        expect(launcher.style.display).toBe('none');
        expect(container.style.display).toBe('block');
    });

    it('saves a review when rating button is clicked in main UI', () => {
        tracker.createUI();
        const launcher = document.getElementById('algo-fsrs-launcher');
        launcher.click();

        // Spy on tracker.saveCards
        const saveSpy = jest.spyOn(tracker, 'saveCards');

        const goodBtn = document.querySelector('.fsrs-btn-good');
        expect(goodBtn).not.toBeNull();
        
        // Mock UI state before click
        document.getElementById('fsrs-tags-input').value = 'TestTag';
        document.getElementById('fsrs-approach').value = 'My Approach';

        goodBtn.click();

        expect(saveSpy).toHaveBeenCalled();
        const newCard = window.AlgoRecall.state.cards[window.AlgoRecall.state.cards.length - 1];
        expect(newCard.state).toBe(2); 
        expect(newCard.tags).toContain('TestTag');
    });

    describe('Review Session (startReview)', () => {
        it('alerts if no cards are due', () => {
            tracker.createUI();
            
            // All cards due in future
            window.AlgoRecall.state.cards.forEach(c => c.due = Date.now() + 100000);
            tracker.startReview();
            
            expect(global.alert).toHaveBeenCalledWith("No cards due right now!");
        });

        it('shows review directly if only one unique tag is due', () => {
            tracker.createUI();
            
            window.AlgoRecall.state.cards[0].due = Date.now() - 100000;
            window.AlgoRecall.state.cards[0].tags = ["Array"];
            
            // Only the first one is due
            window.AlgoRecall.state.cards[1].due = Date.now() + 100000;

            tracker.startReview();
            
            // Should jump directly to review UI without picker
            const reviewUi = document.getElementById('fsrs-review-ui');
            expect(reviewUi.style.display).toBe('block');
            expect(reviewUi.innerHTML).toContain('Open Problem Page');
            
            // Should cleanup when back button clicked
            document.getElementById('fsrs-back-btn').click();
            expect(reviewUi.style.display).toBe('none');
        });

        it('shows tag picker if multiple tags are due', () => {
            tracker.createUI();
            
            // Set up two due cards with different tags
            window.AlgoRecall.state.cards[0].due = Date.now() - 100000;
            window.AlgoRecall.state.cards[0].tags = ["Array"];
            
            window.AlgoRecall.state.cards[1].due = Date.now() - 100000;
            window.AlgoRecall.state.cards[1].tags = ["Hash Table"];

            tracker.startReview();
            
            const reviewUi = document.getElementById('fsrs-review-ui');
            expect(reviewUi.innerHTML).toContain('Select Topics to Review');
            
            // Test selecting a tag and clicking start
            const tagChip = Array.from(reviewUi.querySelectorAll('.fsrs-tag-chip')).find(chip => chip.getAttribute('data-tag') === 'Array');
            tagChip.click();
            
            document.getElementById('fsrs-start-filtered-btn').click();
            expect(tracker.activeReviewFilter).toBe('Array');
            
            // Should now show review UI for filtered cards
            expect(reviewUi.innerHTML).toContain('fsrs-filter-badge');
        });

        it('handles keyboard shortcuts during review', () => {
            tracker.createUI();
            window.AlgoRecall.state.cards.forEach(c => c.due = Date.now() + 100000); // ensure ALL are future
            window.AlgoRecall.state.cards[0].due = Date.now() - 100000;
            window.AlgoRecall.state.cards[0].tags = ["Array"];
            
            tracker.startReview();
            
            // Initially approach answer is hidden
            expect(document.getElementById('fsrs-approach-answer').style.display).toBe('none');
            
            // Hit Space to reveal answer
            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            
            expect(document.getElementById('fsrs-approach-answer').style.display).toBe('block');
            expect(document.getElementById('fsrs-show-answer-btn').style.display).toBe('none');
            
            // Spy on handleRating
            jest.spyOn(tracker, 'handleRating').mockImplementation(() => {});
            jest.spyOn(tracker, 'showCard').mockImplementation(() => {});
            
            // Hit 3 (Good)
            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' }));
            
            expect(tracker.handleRating).toHaveBeenCalledWith(window.AlgoRecall.state.cards[0], 3);
        });

        it('ignores keyboard shortcuts when typing in input', () => {
            tracker.createUI();
            window.AlgoRecall.state.cards.forEach(c => c.due = Date.now() + 100000); // ensure ALL are future
            window.AlgoRecall.state.cards[0].due = Date.now() - 100000;
            window.AlgoRecall.state.cards[0].tags = ["Array"];
            tracker.startReview();
            
            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();
            
            // Hit Space while focused
            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            
            expect(document.getElementById('fsrs-approach-answer').style.display).toBe('none');
        });
    });
});
