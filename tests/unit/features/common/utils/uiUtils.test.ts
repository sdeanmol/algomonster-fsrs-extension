import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { UIUtils } from '../../../../../features/common/utils/uiUtils';
import { Toast } from '../../../../../features/common/ui/components/Toast';

describe('UIUtils', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        render(h(Toast, { id: 'status-toast' }), container);
        delete (chrome.runtime as any).lastError;
    });

    afterEach(() => {
        jest.clearAllMocks();
        render(null, container);
        container.remove();
        document.body.innerHTML = '';
    });

    it('shows toast with message and hides after duration', () => {
        jest.useFakeTimers();
        UIUtils.showToast('Test Message', 1000);
        jest.advanceTimersByTime(10);
        const toast = document.getElementById('status-toast')!;
        expect(toast.textContent).toBe('Test Message');
        expect(toast.className).toBe('toast show');

        jest.advanceTimersByTime(1100);
        expect(toast.className).toBe('toast');
        jest.useRealTimers();
    });

    it('UX-008: closeCurrentTab closes tab via chrome.tabs.remove when tab exists', () => {
        const removeMock = jest.fn((tabId: number, cb?: () => void) => {
            if (cb) cb();
        });
        (global.chrome as any).tabs = {
            getCurrent: jest.fn((cb: (tab: any) => void) => cb({ id: 123 })),
            remove: removeMock
        };
        const windowCloseSpy = jest.spyOn(window, 'close').mockImplementation(() => {});

        UIUtils.closeCurrentTab();

        expect(chrome.tabs.getCurrent).toHaveBeenCalled();
        expect(removeMock).toHaveBeenCalledWith(123, expect.any(Function));
        expect(windowCloseSpy).not.toHaveBeenCalled();
    });

    it('UX-008: closeCurrentTab falls back to window.close when getCurrent returns null', () => {
        (global.chrome as any).tabs = {
            getCurrent: jest.fn((cb: (tab: any) => void) => cb(null)),
            remove: jest.fn()
        };
        const windowCloseSpy = jest.spyOn(window, 'close').mockImplementation(() => {});

        UIUtils.closeCurrentTab();

        expect(windowCloseSpy).toHaveBeenCalled();
    });

    it('UX-008: closeCurrentTab falls back to window.close when chrome.tabs is undefined', () => {
        const origTabs = (global.chrome as any).tabs;
        delete (global.chrome as any).tabs;
        const windowCloseSpy = jest.spyOn(window, 'close').mockImplementation(() => {});

        UIUtils.closeCurrentTab();

        expect(windowCloseSpy).toHaveBeenCalled();
        (global.chrome as any).tabs = origTabs;
    });

    it('UX-008: closeCurrentTab falls back to window.close on chrome.runtime.lastError', () => {
        const removeMock = jest.fn((tabId: number, cb?: () => void) => {
            (chrome.runtime as any).lastError = { message: 'Cannot remove tab' };
            if (cb) cb();
        });
        (global.chrome as any).tabs = {
            getCurrent: jest.fn((cb: (tab: any) => void) => cb({ id: 456 })),
            remove: removeMock
        };
        const windowCloseSpy = jest.spyOn(window, 'close').mockImplementation(() => {});

        UIUtils.closeCurrentTab();

        expect(removeMock).toHaveBeenCalledWith(456, expect.any(Function));
        expect(windowCloseSpy).toHaveBeenCalled();
    });

    describe('formatError', () => {
        it('formats Error instance correctly', () => {
            expect(UIUtils.formatError(new Error('Test failure'))).toBe('Test failure');
        });

        it('formats non-Error values as string', () => {
            expect(UIUtils.formatError('string error')).toBe('string error');
            expect(UIUtils.formatError(404)).toBe('404');
            expect(UIUtils.formatError(null)).toBe('null');
        });
    });

    describe('catchError and checkStorageError', () => {
        it('catchError logs error with context message and metadata', () => {
            const loggerSpy = jest.spyOn(require('../../../../../features/common/logger').Logger, 'error').mockImplementation(() => {});
            UIUtils.catchError('TestMod', 'Failed to save', new Error('Disk full'), { cardId: '123' });
            expect(loggerSpy).toHaveBeenCalledWith('TestMod', 'Failed to save: Disk full', expect.objectContaining({ cardId: '123' }));
        });

        it('checkStorageError returns true and logs if chrome.runtime.lastError exists', () => {
            const loggerSpy = jest.spyOn(require('../../../../../features/common/logger').Logger, 'error').mockImplementation(() => {});
            (chrome.runtime as any).lastError = { message: 'Quota exceeded' };
            const hasError = UIUtils.checkStorageError('StorageMod', 'Save failed');
            expect(hasError).toBe(true);
            expect(loggerSpy).toHaveBeenCalledWith('StorageMod', 'Save failed: Quota exceeded', expect.any(Object));
        });

        it('checkStorageError returns false if no chrome.runtime.lastError', () => {
            delete (chrome.runtime as any).lastError;
            const hasError = UIUtils.checkStorageError('StorageMod', 'Save succeeded');
            expect(hasError).toBe(false);
        });
    });

    describe('trySafe and trySafeAsync', () => {
        it('trySafe returns result when successful', () => {
            const result = UIUtils.trySafe(() => 42, 0);
            expect(result).toBe(42);
        });

        it('trySafe returns fallback and logs when function throws', () => {
            const loggerSpy = jest.spyOn(require('../../../../../features/common/logger').Logger, 'error').mockImplementation(() => {});
            const result = UIUtils.trySafe(() => { throw new Error('Boom'); }, 99, 'Mod', 'Calc failed');
            expect(result).toBe(99);
            expect(loggerSpy).toHaveBeenCalledWith('Mod', 'Calc failed: Boom', expect.any(Object));
        });

        it('trySafeAsync returns result on successful resolution', async () => {
            const result = await UIUtils.trySafeAsync(async () => 'hello', 'default');
            expect(result).toBe('hello');
        });

        it('trySafeAsync returns fallback on rejection', async () => {
            const loggerSpy = jest.spyOn(require('../../../../../features/common/logger').Logger, 'error').mockImplementation(() => {});
            const result = await UIUtils.trySafeAsync(async () => { throw new Error('Network error'); }, 'fallback', 'Mod', 'Fetch failed');
            expect(result).toBe('fallback');
            expect(loggerSpy).toHaveBeenCalledWith('Mod', 'Fetch failed: Network error', expect.any(Object));
        });
    });
});

