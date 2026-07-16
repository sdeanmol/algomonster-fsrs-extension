const FsrsOptimizerFast = require('../../features/tracker/scheduler/fsrsOptimizerFast.js').default || require('../../features/tracker/scheduler/fsrsOptimizerFast.js');

describe('FsrsOptimizerFast Performance & Fallback Scenario', () => {
    let fastOptimizer;
    const defaultWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];

    beforeEach(() => {
        fastOptimizer = new FsrsOptimizerFast();
    });

    /**
     * Generates a realistic array of mocked FSRS history logs.
     */
    function generateMockHistory(numRecords) {
        const history = [];
        const baseDate = new Date('2024-01-01').getTime();

        for (let i = 0; i < numRecords; i++) {
            // Randomize the number of reviews per card (between 2 and 10)
            const numReviews = Math.floor(Math.random() * 9) + 2;
            const historyLog = [];
            
            let currentDate = baseDate;
            let lapses = 0;
            
            for (let j = 0; j < numReviews; j++) {
                // Random rating 1-4 (favoring 3)
                let rating = Math.random() > 0.8 ? (Math.random() > 0.5 ? 4 : 1) : 3;
                if (rating === 1) lapses++;

                historyLog.push({
                    rating,
                    date: currentDate
                });

                // Spaced intervals (1 day to 14 days)
                const interval = Math.floor(Math.random() * 14) + 1;
                currentDate += interval * 24 * 60 * 60 * 1000;
            }

            history.push({
                id: `mock_card_${i}`,
                reps: numReviews,
                lapses: lapses,
                historyLog: historyLog
            });
        }
        return history;
    }

    it('should process 2500 mocked records efficiently and output execution time', async () => {
        const numRecords = 2500;
        const mockHistory = generateMockHistory(numRecords);

        expect(mockHistory).toHaveLength(numRecords);

        // Start timing
        const startTime = performance.now();

        // Run the fast heuristic optimizer (Fallback scenario)
        const newWeights = await fastOptimizer.trainWeights(mockHistory, defaultWeights, 0.90);

        // End timing
        const endTime = performance.now();
        const executionTimeMs = (endTime - startTime).toFixed(2);

        // Output to test logs
        console.log(`\n======================================================`);
        console.log(`[PERFORMANCE REPORT] FSRS Fallback Optimizer (JS)`);
        console.log(`Processed Records: ${numRecords}`);
        console.log(`Execution Time: ${executionTimeMs} ms`);
        console.log(`Generated Weights: [${newWeights.join(', ')}]`);
        console.log(`======================================================\n`);

        expect(newWeights).toBeDefined();
        expect(newWeights).toHaveLength(17);
        // Ensure execution time is reasonable (e.g. less than 1000ms for fast JS optimizer)
        expect(endTime - startTime).toBeLessThan(1000); 
    });
});
