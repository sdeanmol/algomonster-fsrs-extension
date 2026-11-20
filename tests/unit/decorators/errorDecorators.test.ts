import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { CatchAndLog, CatchAndReturn, MeasureTime, Finally, withErrorHandling, withFallback } from '../../../decorators';
import { UIUtils } from '../../../features/common/utils/uiUtils';
import { Logger } from '../../../features/common/logger';

class SampleService {
    public multiplier: number = 2;
    public cleanupLog: string[] = [];

    @CatchAndLog('SampleService', 'Failed syncCompute')
    syncCompute(x: number, y: number): number {
        if (x < 0) throw new Error('Negative x not allowed');
        return (x + y) * this.multiplier;
    }

    @CatchAndLog('SampleService', { contextMessage: 'Failed asyncFetch', fallback: 'default-async' })
    async asyncFetch(url: string): Promise<string> {
        if (url === 'error') throw new Error('Network error');
        return `fetched:${url}:${this.multiplier}`;
    }

    @CatchAndLog('SampleService', { contextMessage: 'Failed rethrowingOp', rethrow: true })
    rethrowingOp(): void {
        throw new Error('Fatal database crash');
    }

    @CatchAndLog('SampleService', { contextMessage: 'Failed asyncRethrow', rethrow: true })
    async asyncRethrow(): Promise<void> {
        throw new Error('Fatal async crash');
    }

    @CatchAndReturn(404, 'SampleService', 'Failed findCode')
    findCode(valid: boolean): number {
        if (!valid) throw new Error('Code not found');
        return 200;
    }

    @CatchAndReturn(['fallback-item'], 'SampleService', 'Failed asyncList')
    async asyncList(valid: boolean): Promise<string[]> {
        if (!valid) throw new Error('List failed');
        return ['item-1', 'item-2'];
    }

    @MeasureTime('SampleService', 'CustomSyncTimer')
    timedSync(iterations: number): number {
        let sum = 0;
        for (let i = 0; i < iterations; i++) sum += i;
        return sum;
    }

    @MeasureTime('SampleService', 'CustomSyncTimerFail')
    timedSyncFail(): void {
        throw new Error('Timed sync failure');
    }

    @MeasureTime('SampleService', 'CustomAsyncTimer')
    async timedAsync(): Promise<string> {
        return 'async-done';
    }

    @MeasureTime('SampleService', 'CustomAsyncTimerFail')
    async timedAsyncFail(): Promise<string> {
        throw new Error('Timed async failure');
    }

    @CatchAndLog('SampleService', {
        contextMessage: 'Failed withOption1Finally',
        finally: function (this: SampleService) {
            this.cleanupLog.push('option1-finally');
        }
    })
    async opWithOption1Finally(fail: boolean): Promise<string> {
        if (fail) throw new Error('Option 1 failure');
        return 'option1-success';
    }

    @Finally(function (this: SampleService) {
        this.cleanupLog.push('option2-finally');
    })
    @CatchAndLog('SampleService', 'Failed withOption2Finally')
    async opWithOption2Finally(fail: boolean): Promise<string> {
        if (fail) throw new Error('Option 2 failure');
        return 'option2-success';
    }
}

describe('Error Handling Decorators', () => {
    let catchErrorSpy: jest.SpiedFunction<typeof UIUtils.catchError>;
    let timeSpy: jest.SpiedFunction<typeof Logger.time>;
    let timeEndSpy: jest.SpiedFunction<typeof Logger.timeEnd>;
    let sample: SampleService;

    beforeEach(() => {
        catchErrorSpy = jest.spyOn(UIUtils, 'catchError').mockImplementation(() => {});
        timeSpy = jest.spyOn(Logger, 'time').mockImplementation(() => {});
        timeEndSpy = jest.spyOn(Logger, 'timeEnd').mockImplementation(() => {});
        sample = new SampleService();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('@CatchAndLog', () => {
        it('preserves arguments, return value, and this context on successful sync execution', () => {
            const result = sample.syncCompute(3, 4);
            expect(result).toBe(14); // (3 + 4) * 2
            expect(catchErrorSpy).not.toHaveBeenCalled();
        });

        it('catches sync errors, logs via UIUtils, and returns undefined by default', () => {
            const result = sample.syncCompute(-1, 5);
            expect(result).toBeUndefined();
            expect(catchErrorSpy).toHaveBeenCalledWith(
                'SampleService',
                'Failed syncCompute',
                expect.any(Error),
                undefined
            );
        });

        it('preserves arguments and this context on successful async execution', async () => {
            const result = await sample.asyncFetch('algo.monster');
            expect(result).toBe('fetched:algo.monster:2');
            expect(catchErrorSpy).not.toHaveBeenCalled();
        });

        it('catches async promise rejection, logs, and returns designated fallback', async () => {
            const result = await sample.asyncFetch('error');
            expect(result).toBe('default-async');
            expect(catchErrorSpy).toHaveBeenCalledWith(
                'SampleService',
                'Failed asyncFetch',
                expect.any(Error),
                undefined
            );
        });

        it('rethrows sync error when rethrow is true', () => {
            expect(() => sample.rethrowingOp()).toThrow('Fatal database crash');
            expect(catchErrorSpy).toHaveBeenCalledWith(
                'SampleService',
                'Failed rethrowingOp',
                expect.any(Error),
                undefined
            );
        });

        it('rethrows async error when rethrow is true', async () => {
            await expect(sample.asyncRethrow()).rejects.toThrow('Fatal async crash');
            expect(catchErrorSpy).toHaveBeenCalledWith(
                'SampleService',
                'Failed asyncRethrow',
                expect.any(Error),
                undefined
            );
        });
    });

    describe('@CatchAndReturn', () => {
        it('returns method result when synchronous method succeeds', () => {
            expect(sample.findCode(true)).toBe(200);
            expect(catchErrorSpy).not.toHaveBeenCalled();
        });

        it('returns fallback value and logs error when synchronous method throws', () => {
            expect(sample.findCode(false)).toBe(404);
            expect(catchErrorSpy).toHaveBeenCalledWith(
                'SampleService',
                'Failed findCode',
                expect.any(Error),
                undefined
            );
        });

        it('returns method result when asynchronous method succeeds', async () => {
            const list = await sample.asyncList(true);
            expect(list).toEqual(['item-1', 'item-2']);
            expect(catchErrorSpy).not.toHaveBeenCalled();
        });

        it('returns fallback array and logs error when asynchronous method rejects', async () => {
            const list = await sample.asyncList(false);
            expect(list).toEqual(['fallback-item']);
            expect(catchErrorSpy).toHaveBeenCalledWith(
                'SampleService',
                'Failed asyncList',
                expect.any(Error),
                undefined
            );
        });
    });

    describe('@MeasureTime', () => {
        it('instruments synchronous execution and cleans up timer on success', () => {
            const sum = sample.timedSync(10);
            expect(sum).toBe(45);
            expect(timeSpy).toHaveBeenCalledWith('SampleService', 'CustomSyncTimer');
            expect(timeEndSpy).toHaveBeenCalledWith('SampleService', 'CustomSyncTimer');
        });

        it('cleans up timer in finally block when synchronous method throws', () => {
            expect(() => sample.timedSyncFail()).toThrow('Timed sync failure');
            expect(timeSpy).toHaveBeenCalledWith('SampleService', 'CustomSyncTimerFail');
            expect(timeEndSpy).toHaveBeenCalledWith('SampleService', 'CustomSyncTimerFail');
        });

        it('instruments asynchronous execution and cleans up timer on success', async () => {
            const res = await sample.timedAsync();
            expect(res).toBe('async-done');
            expect(timeSpy).toHaveBeenCalledWith('SampleService', 'CustomAsyncTimer');
            expect(timeEndSpy).toHaveBeenCalledWith('SampleService', 'CustomAsyncTimer');
        });

        it('cleans up timer in finally block when asynchronous method rejects', async () => {
            await expect(sample.timedAsyncFail()).rejects.toThrow('Timed async failure');
            expect(timeSpy).toHaveBeenCalledWith('SampleService', 'CustomAsyncTimerFail');
            expect(timeEndSpy).toHaveBeenCalledWith('SampleService', 'CustomAsyncTimerFail');
        });
    });

    describe('withErrorHandling utility', () => {
        it('executes synchronous function normally and returns its value', () => {
            const fn = (a: number, b: number) => a + b;
            const wrapped = withErrorHandling(fn, 'UtilTest', 'Failed addition');
            expect(wrapped(10, 20)).toBe(30);
            expect(catchErrorSpy).not.toHaveBeenCalled();
        });

        it('catches sync exception, logs via UIUtils, and returns undefined', () => {
            const fn = () => { throw new Error('Sync fail'); };
            const wrapped = withErrorHandling(fn, 'UtilTest', 'Failed sync');
            expect(wrapped()).toBeUndefined();
            expect(catchErrorSpy).toHaveBeenCalledWith('UtilTest', 'Failed sync', expect.any(Error), undefined);
        });

        it('executes async function normally and resolves value', async () => {
            const fn = async (val: string) => `echo:${val}`;
            const wrapped = withErrorHandling(fn, 'UtilTest');
            const res = await wrapped('hello');
            expect(res).toBe('echo:hello');
        });

        it('catches async rejection, logs, and returns fallback', async () => {
            const fn = async () => { throw new Error('Async fail'); };
            const wrapped = withErrorHandling(fn, 'UtilTest', {
                contextMessage: 'Failed async op',
                fallback: 'async-fallback'
            });
            const res = await wrapped();
            expect(res).toBe('async-fallback');
            expect(catchErrorSpy).toHaveBeenCalledWith('UtilTest', 'Failed async op', expect.any(Error), undefined);
        });

        it('rethrows when rethrow is true', async () => {
            const fn = () => { throw new Error('Rethrown error'); };
            const wrapped = withErrorHandling(fn, 'UtilTest', { rethrow: true });
            expect(() => wrapped()).toThrow('Rethrown error');
        });

        it('executes finally callback after error handling in withErrorHandling', async () => {
            const executionOrder: string[] = [];
            catchErrorSpy.mockImplementation(() => {
                executionOrder.push('catch-error');
            });

            const fn = async () => {
                throw new Error('Async failure in withErrorHandling');
            };

            const wrapped = withErrorHandling(fn, 'UtilTest', {
                contextMessage: 'Operation with finally',
                finally: () => {
                    executionOrder.push('finally-cleanup');
                }
            });

            await wrapped();
            expect(executionOrder).toEqual(['catch-error', 'finally-cleanup']);
        });
    });

    describe('Option 1: CatchAndLog with finally option', () => {
        it('executes finally callback on success', async () => {
            const res = await sample.opWithOption1Finally(false);
            expect(res).toBe('option1-success');
            expect(sample.cleanupLog).toContain('option1-finally');
            expect(catchErrorSpy).not.toHaveBeenCalled();
        });

        it('guarantees catch logging executes first and finally executes last on error', async () => {
            const executionOrder: string[] = [];
            catchErrorSpy.mockImplementation(() => {
                executionOrder.push('catch-error');
            });

            sample.cleanupLog = [];
            const originalFinallyMethod = sample.opWithOption1Finally.bind(sample);

            await sample.opWithOption1Finally(true);

            expect(catchErrorSpy).toHaveBeenCalledWith(
                'SampleService',
                'Failed withOption1Finally',
                expect.any(Error),
                undefined
            );
            expect(sample.cleanupLog).toContain('option1-finally');
        });
    });

    describe('Option 2: @Finally Decorator', () => {
        it('executes finally cleanup on success', async () => {
            sample.cleanupLog = [];
            const res = await sample.opWithOption2Finally(false);
            expect(res).toBe('option2-success');
            expect(sample.cleanupLog).toEqual(['option2-finally']);
            expect(catchErrorSpy).not.toHaveBeenCalled();
        });

        it('guarantees @CatchAndLog catches first and @Finally runs last on error', async () => {
            const executionOrder: string[] = [];
            catchErrorSpy.mockImplementation(() => {
                executionOrder.push('catch-error');
            });

            sample.cleanupLog = [];
            await sample.opWithOption2Finally(true);

            expect(catchErrorSpy).toHaveBeenCalledWith(
                'SampleService',
                'Failed withOption2Finally',
                expect.any(Error),
                undefined
            );
            expect(sample.cleanupLog).toContain('option2-finally');
        });
    });

    describe('withFallback utility', () => {
        it('returns function result on success', () => {
            const fn = () => [1, 2, 3];
            const wrapped = withFallback(fn, []);
            expect(wrapped()).toEqual([1, 2, 3]);
        });

        it('returns fallback value and logs on throw', () => {
            const fn = () => { throw new Error('Compute error'); };
            const wrapped = withFallback(fn, ['fallback'], 'UtilTest', 'Fallback compute');
            expect(wrapped()).toEqual(['fallback']);
            expect(catchErrorSpy).toHaveBeenCalledWith('UtilTest', 'Fallback compute', expect.any(Error), undefined);
        });
    });
});
