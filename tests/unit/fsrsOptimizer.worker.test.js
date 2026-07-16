// Mock the self object for Web Worker safely for JSDOM
const mockPostMessage = jest.fn();
Object.defineProperty(global, 'postMessage', { value: mockPostMessage, writable: true });
Object.defineProperty(global.self, 'postMessage', { value: mockPostMessage, writable: true });
Object.defineProperty(global.self, 'addEventListener', { value: jest.fn(), writable: true });

// Mock FsrsOptimizer (WASM) and FsrsOptimizerFast (JS)
jest.mock('../../features/tracker/scheduler/fsrsOptimizer.js', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => {
            return {
                trainWeights: jest.fn()
            };
        })
    };
});

jest.mock('../../features/tracker/scheduler/fsrsOptimizerFast.js', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => {
            return {
                trainWeights: jest.fn()
            };
        })
    };
});

const FsrsOptimizer = require('../../features/tracker/scheduler/fsrsOptimizer.js').default;
const FsrsOptimizerFast = require('../../features/tracker/scheduler/fsrsOptimizerFast.js').default;

// Require the worker script (it will attach to global.self)
require('../../features/tracker/scheduler/fsrsOptimizer.worker.js');

describe('FsrsOptimizer Worker', () => {
    const defaultWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should successfully run WASM optimizer and postMessage result', async () => {
        const mockWasmWeights = [0.1, 0.2, 0.3, 0.4];
        
        // Setup WASM mock to succeed
        FsrsOptimizer.mockImplementation(() => ({
            trainWeights: jest.fn().mockResolvedValue(mockWasmWeights)
        }));

        // Simulate incoming message
        await global.self.onmessage({
            data: {
                action: 'trainWeights',
                payload: {
                    history: [],
                    currentWeights: defaultWeights,
                    targetRetention: 0.90
                }
            }
        });

        // Verify WASM was called
        expect(FsrsOptimizer).toHaveBeenCalled();
        expect(FsrsOptimizerFast).not.toHaveBeenCalled();

        // Verify success message posted
        expect(mockPostMessage).toHaveBeenCalledWith({
            action: 'trainWeightsResult',
            success: true,
            optimizedWeights: mockWasmWeights
        });
    });

    it('should fallback to Fast JS optimizer if WASM throws an error', async () => {
        const mockFastWeights = [0.9, 0.8, 0.7, 0.6];
        
        // Setup WASM mock to FAIL
        FsrsOptimizer.mockImplementation(() => ({
            trainWeights: jest.fn().mockRejectedValue(new Error('WASM Initialization Failed'))
        }));

        // Setup Fast mock to SUCCEED
        FsrsOptimizerFast.mockImplementation(() => ({
            trainWeights: jest.fn().mockResolvedValue(mockFastWeights)
        }));

        // Suppress console.warn for the test
        const originalWarn = console.warn;
        console.warn = jest.fn();

        // Simulate incoming message
        await global.self.onmessage({
            data: {
                action: 'trainWeights',
                payload: {
                    history: [],
                    currentWeights: defaultWeights,
                    targetRetention: 0.90
                }
            }
        });

        // Restore console.warn
        console.warn = originalWarn;

        // Verify both were called (WASM failed, Fast took over)
        expect(FsrsOptimizer).toHaveBeenCalled();
        expect(FsrsOptimizerFast).toHaveBeenCalled();

        // Verify success message posted with FAST weights
        expect(mockPostMessage).toHaveBeenCalledWith({
            action: 'trainWeightsResult',
            success: true,
            optimizedWeights: mockFastWeights
        });
    });

    it('should bubble up error if even the fallback fails', async () => {
        // Setup both to FAIL
        FsrsOptimizer.mockImplementation(() => ({
            trainWeights: jest.fn().mockRejectedValue(new Error('WASM Panic'))
        }));

        FsrsOptimizerFast.mockImplementation(() => ({
            trainWeights: jest.fn().mockRejectedValue(new Error('Fast JS Crashed'))
        }));

        const originalWarn = console.warn;
        console.warn = jest.fn();

        // Simulate incoming message
        await global.self.onmessage({
            data: {
                action: 'trainWeights',
                payload: { history: [], currentWeights: defaultWeights, targetRetention: 0.90 }
            }
        });

        console.warn = originalWarn;

        // Verify error message posted
        expect(global.self.postMessage).toHaveBeenCalledWith({
            action: 'trainWeightsResult',
            success: false,
            error: 'Fast JS Crashed'
        });
    });
});
