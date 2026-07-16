const FsrsOptimizerFast = require('../../features/tracker/scheduler/fsrsOptimizerFast.js').default || require('../../features/tracker/scheduler/fsrsOptimizerFast.js');

describe('FsrsOptimizerFast', () => {
    let optimizer;

    beforeEach(() => {
        optimizer = new FsrsOptimizerFast();
    });

    describe('computeEligibility', () => {
        it('should return ineligible if no history is provided', () => {
            const result = optimizer.computeEligibility(null, 1000);
            expect(result.eligible).toBe(false);
            expect(result.count).toBe(0);
        });

        it('should correctly count reviews excluding creation events', () => {
            const history = [
                { id: '1', historyLog: [1000, 2000, 3000] }, // 2 reviews
                { id: '2', historyLog: [1000, 2000] },       // 1 review
                { id: '3', historyLog: [1000] }              // 0 reviews (only creation)
            ];

            const result = optimizer.computeEligibility(history, 5);
            expect(result.count).toBe(3);
            expect(result.uniqueCards).toBe(2);
            expect(result.eligible).toBe(false);
            
            const result2 = optimizer.computeEligibility(history, 3);
            expect(result2.eligible).toBe(true);
        });
    });

    describe('trainWeights', () => {
        const defaultWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];

        it('should return original weights if no reviews exist', async () => {
            const history = [
                { reps: 0, lapses: 0 }
            ];
            
            const newWeights = await optimizer.trainWeights(history, defaultWeights);
            expect(newWeights).toEqual(defaultWeights);
        });

        it('should increase initial stabilities if empirical retention is higher than 90%', async () => {
            // Perfect retention: 10 reps, 0 lapses (1.0 empirical retention)
            const history = [
                { reps: 10, lapses: 0 }
            ];
            
            const newWeights = await optimizer.trainWeights(history, defaultWeights);
            
            // Should be higher than default
            expect(newWeights[0]).toBeGreaterThan(defaultWeights[0]);
            expect(newWeights[1]).toBeGreaterThan(defaultWeights[1]);
            expect(newWeights[2]).toBeGreaterThan(defaultWeights[2]);
            expect(newWeights[3]).toBeGreaterThan(defaultWeights[3]);
        });

        it('should decrease initial stabilities if empirical retention is lower than 90%', async () => {
            // Poor retention: 10 reps, 5 lapses (0.5 empirical retention)
            const history = [
                { reps: 10, lapses: 5 }
            ];
            
            const newWeights = await optimizer.trainWeights(history, defaultWeights);
            
            // Should be lower than default
            expect(newWeights[0]).toBeLessThan(defaultWeights[0]);
            expect(newWeights[1]).toBeLessThan(defaultWeights[1]);
        });
    });
});
