jest.mock('@open-spaced-repetition/binding/dynamic-wasi', () => {
    const mockBinding = {
        computeParameters: jest.fn(),
        FSRSBindingReview: class {
            constructor(rating, delta_t) {
                this.rating = rating;
                this.delta_t = delta_t;
            }
        },
        FSRSBindingItem: class {
            constructor(reviews) {
                this.reviews = reviews;
            }
        }
    };
    global.__mockBinding = mockBinding;
    return {
        initOptimizer: jest.fn().mockResolvedValue(mockBinding)
    };
});

const fs = require('fs');
const path = require('path');
const optimizerCode = fs.readFileSync(path.resolve(__dirname, '../../features/tracker/scheduler/fsrsOptimizer.js'), 'utf8');
const safeCode = optimizerCode
    .replace(/import\.meta\.url/g, "'http://localhost'")
    .replace(/import \{ initOptimizer \} from '@open-spaced-repetition\/binding\/dynamic-wasi';/g, "const { initOptimizer } = require('@open-spaced-repetition/binding/dynamic-wasi');")
    .replace(/import \{ Rating \} from 'ts-fsrs';/g, "const { Rating } = require('ts-fsrs');")
    .replace(/export default FsrsOptimizer;/g, "module.exports = FsrsOptimizer;");

const mockModule = { exports: {} };
(function(module, exports, require) {
    eval(safeCode);
})(mockModule, mockModule.exports, require);

const FsrsOptimizer = mockModule.exports.default || mockModule.exports;

describe('FsrsOptimizer (WASM)', () => {
    let optimizer;

    beforeAll(() => {
        optimizer = new FsrsOptimizer();
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        const { initOptimizer } = require('@open-spaced-repetition/binding/dynamic-wasi');
        initOptimizer.mockResolvedValue(global.__mockBinding);
        global.__mockBinding.computeParameters.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]);
    });

    describe('trainWeights', () => {
        const defaultWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];

        it('should return current weights if history is empty', async () => {
            const newWeights = await optimizer.trainWeights([], defaultWeights, 0.90);
            expect(newWeights).toEqual(defaultWeights);
        });

        it('should return current weights if no valid delta_t > 0 is found in history', async () => {
            const history = [
                { id: '1', historyLog: [ { rating: 3, date: 1000 } ] } // single review, delta_t = 0
            ];
            const newWeights = await optimizer.trainWeights(history, defaultWeights, 0.90);
            
            expect(newWeights).toEqual(defaultWeights);
            expect(global.__mockBinding.computeParameters).not.toHaveBeenCalled();
        });

        it('should call WASM computeParameters with mapped logs when valid intervals exist', async () => {
            const history = [
                {
                    id: '1',
                    historyLog: [
                        { rating: 1, date: new Date('2024-01-01').getTime() },
                        { rating: 3, date: new Date('2024-01-05').getTime() } // 4 days later
                    ]
                }
            ];

            const newWeights = await optimizer.trainWeights(history, defaultWeights, 0.90);

            expect(global.__mockBinding.computeParameters).toHaveBeenCalled();
            
            // Check args passed to computeParameters
            const callArgs = global.__mockBinding.computeParameters.mock.calls[0];
            const trainSet = callArgs[0];
            const options = callArgs[1];
            
            expect(trainSet).toHaveLength(1);
            expect(trainSet[0].reviews).toHaveLength(2);
            expect(trainSet[0].reviews[0].delta_t).toBe(0);
            expect(trainSet[0].reviews[0].rating).toBe(1);
            expect(trainSet[0].reviews[1].delta_t).toBe(4); // 4 days delta
            expect(trainSet[0].reviews[1].rating).toBe(3);
            
            expect(options.timeout).toBe(60000);
            expect(newWeights).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7]);
        });

        it('should cap the trainSet to MAX_TRAINING_CARDS', async () => {
            const history = [];
            for(let i=0; i<3000; i++) {
                history.push({
                    id: `card_${i}`,
                    historyLog: [
                        { rating: 1, date: 1000000 },
                        { rating: 3, date: 1000000 + (1000 * 60 * 60 * 24) } // 1 day later
                    ]
                });
            }

            await optimizer.trainWeights(history, defaultWeights, 0.90);
            
            const callArgs = global.__mockBinding.computeParameters.mock.calls[0];
            const trainSet = callArgs[0];
            
            expect(trainSet).toHaveLength(2500); // Should be capped
        });

        it('should bubble up errors from WASM computeParameters when training fails', async () => {
            global.__mockBinding.computeParameters.mockRejectedValueOnce(new Error('WASM Panic: Invalid Dataset'));
            
            const history = [
                {
                    id: '1',
                    historyLog: [
                        { rating: 1, date: 1000000 },
                        { rating: 3, date: 1000000 + (1000 * 60 * 60 * 24) }
                    ]
                }
            ];

            await expect(optimizer.trainWeights(history, defaultWeights, 0.90)).rejects.toThrow('WASM Panic: Invalid Dataset');
        });
    });
});
