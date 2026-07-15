const assert = require('assert');
const Scheduler = require('./features/tracker/scheduler/scheduler.js');
const FsrsScheduler = require('./features/tracker/scheduler/fsrsScheduler.js');

async function runTests() {
    console.log('Running Tests...\n');
    let passed = 0;
    let failed = 0;

    function runTest(name, fn) {
        try {
            fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (error) {
            console.error(`❌ ${name}`);
            console.error(error);
            failed++;
        }
    }

    // 1. Test Scheduler Abstract Interface
    runTest('Scheduler interface enforces unimplemented methods', () => {
        class DummyScheduler extends Scheduler {}
        const dummy = new DummyScheduler();
        assert.throws(() => dummy.createCard(), /must be implemented/);
        assert.throws(() => dummy.reviewCard({}, 1), /must be implemented/);
        assert.throws(() => dummy.getRetrievability({}), /must be implemented/);
        assert.throws(() => dummy.getProjectedRetrievability(1, 1), /must be implemented/);
        assert.throws(() => dummy.getDefaultRequestRetention(), /must be implemented/);
        assert.throws(() => dummy.isHighDifficulty({}), /must be implemented/);
        assert.throws(() => dummy.isGraduated({}), /must be implemented/);
    });

    // 2. Test FsrsScheduler functionality
    runTest('FsrsScheduler creates standard schema', () => {
        const fsrs = new FsrsScheduler();
        const card = fsrs.createCard('Two Sum', 'https://leetcode.com/problems/two-sum/', '', 'Use Hash Map', ['Array']);
        assert.strictEqual(card.problemTitle, 'Two Sum');
        assert.strictEqual(card.tags.length, 1);
        assert.strictEqual(card.stability, 0);
        assert.strictEqual(card.difficulty, 0);
        assert.strictEqual(card.state, 0);
    });

    runTest('FsrsScheduler processes initial review', () => {
        const fsrs = new FsrsScheduler();
        let card = fsrs.createCard('Title', 'URL', '', '');
        // 3 = Good
        card = fsrs.reviewCard(card, 3);
        assert.strictEqual(card.state, 2); // 2 = Review
        assert.ok(card.stability > 0);
        assert.ok(card.difficulty > 0);
        assert.strictEqual(card.reps, 1);
        assert.strictEqual(card.historyLog.length, 2);
    });

    runTest('FsrsScheduler getRetrievability calculation', () => {
        const fsrs = new FsrsScheduler();
        let card = fsrs.createCard('Title', 'URL', '', '');
        const now = Date.now();
        card.lastReview = now;
        card.stability = 10;
        
        // At T=0, retrievability should be exactly 1.0 (100%)
        const retNow = fsrs.getRetrievability(card, now);
        assert.strictEqual(retNow, 1);

        // At T = stability (10 days), retrievability = Math.exp(-0.5) ≈ 0.606
        const ret10Days = fsrs.getRetrievability(card, now + (10 * 24 * 60 * 60 * 1000));
        assert.ok(ret10Days > 0.60 && ret10Days < 0.61);
    });

    runTest('FsrsScheduler isHighDifficulty', () => {
        const fsrs = new FsrsScheduler();
        assert.strictEqual(fsrs.isHighDifficulty({ difficulty: 7 }), true);
        assert.strictEqual(fsrs.isHighDifficulty({ difficulty: 6.9 }), false);
    });

    console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(console.error);
