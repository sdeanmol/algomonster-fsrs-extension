const Scheduler = require('../../features/tracker/scheduler/scheduler.js');
const FsrsScheduler = require('../../features/tracker/scheduler/fsrsScheduler.js');

describe('Scheduler Interface', () => {
    it('enforces unimplemented methods', () => {
        class DummyScheduler extends Scheduler {}
        const dummy = new DummyScheduler();
        expect(() => dummy.createCard()).toThrow(/must be implemented/);
        expect(() => dummy.reviewCard({}, 1)).toThrow(/must be implemented/);
        expect(() => dummy.getRetrievability({})).toThrow(/must be implemented/);
        expect(() => dummy.getProjectedRetrievability(1, 1)).toThrow(/must be implemented/);
        expect(() => dummy.getDefaultRequestRetention()).toThrow(/must be implemented/);
        expect(() => dummy.isHighDifficulty({})).toThrow(/must be implemented/);
        expect(() => dummy.isGraduated({})).toThrow(/must be implemented/);
    });
});

describe('FsrsScheduler functionality', () => {
    let fsrs;

    beforeEach(() => {
        fsrs = new FsrsScheduler();
    });

    it('creates standard schema', () => {
        const card = fsrs.createCard('Two Sum', 'https://leetcode.com/problems/two-sum/', '', 'Use Hash Map', ['Array']);
        expect(card.problemTitle).toBe('Two Sum');
        expect(card.tags.length).toBe(1);
        expect(card.stability).toBe(0);
        expect(card.difficulty).toBe(0);
        expect(card.state).toBe(0);
    });

    it('processes initial review', () => {
        let card = fsrs.createCard('Title', 'URL', '', '');
        card = fsrs.reviewCard(card, 3); // 3 = Good
        expect(card.state).toBe(1); // 1 = Learning
        expect(card.stability).toBeGreaterThan(0);
        expect(card.difficulty).toBeGreaterThan(0);
        expect(card.reps).toBe(1);
        expect(card.historyLog.length).toBe(2); // initial creation + review
    });

    it('calculates getRetrievability correctly over time', () => {
        let card = fsrs.createCard('Title', 'URL', '', '');
        const now = Date.now();
        card.lastReview = now;
        card.stability = 10;
        card.state = 2; // ts-fsrs only calculates R>0 for Review states
        
        // At T=0, retrievability should be exactly 1.0 (100%)
        const retNow = fsrs.getRetrievability(card, now);
        expect(retNow).toBe(1);

        // At T = stability (10 days), retrievability = Math.exp(-0.5) ≈ 0.606
        const ret10Days = fsrs.getRetrievability(card, now + (10 * 24 * 60 * 60 * 1000));
        expect(ret10Days).toBeGreaterThan(0.89);
        expect(ret10Days).toBeLessThan(0.91);
    });

    it('identifies high difficulty', () => {
        expect(fsrs.isHighDifficulty({ difficulty: 7 })).toBe(true);
        expect(fsrs.isHighDifficulty({ difficulty: 6.9 })).toBe(false);
    });

    it('graduates cards correctly', () => {
        expect(fsrs.isGraduated({ state: 2, stability: 25 })).toBe(true);
        expect(fsrs.isGraduated({ state: 1, stability: 25 })).toBe(false); // Learning state
        expect(fsrs.isGraduated({ state: 2, stability: 5 })).toBe(false); // Too low stability
    });
});
