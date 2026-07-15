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
            cards: [...mockCards],
            scheduler: new FsrsScheduler(),
            topicWeights: {}
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

        tracker = new window.AlgoRecall.Tracker();
    });

    it('injects UI correctly', () => {
        tracker.createUI();
        
        // Assert Launcher is created
        const launcher = document.getElementById('algo-fsrs-launcher');
        expect(launcher).not.toBeNull();
        expect(launcher.getAttribute('role')).toBe('button');

        // Assert Container is created
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

    it('saves a review when rating button is clicked', () => {
        tracker.createUI();
        const launcher = document.getElementById('algo-fsrs-launcher');
        launcher.click();

        // Simulate new card creation
        tracker.currentCard = window.AlgoRecall.state.scheduler.createCard('Test', 'https://leetcode.com', '', 'Approach');
        tracker.isExistingCard = false;

        // Spy on tracker.saveCards
        const saveSpy = jest.spyOn(tracker, 'saveCards');

        // We have to wait for the DOM to update or trigger it directly
        // Tracker sets up #fsrs-save-ratings buttons.
        const goodBtn = document.querySelector('.fsrs-btn-good');
        expect(goodBtn).not.toBeNull();
        
        // Mock UI state before click
        document.getElementById('fsrs-tags-input').value = 'TestTag';
        document.getElementById('fsrs-approach').value = 'My Approach';

        goodBtn.click();

        expect(saveSpy).toHaveBeenCalled();
        // The new card should be added to the end of the cards array
        const newCard = window.AlgoRecall.state.cards[window.AlgoRecall.state.cards.length - 1];
        expect(newCard.state).toBe(2); // 2 = Review state (transitioned from new)
        expect(newCard.tags).toContain('TestTag');
    });
});
