import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { UIUtils } from '../../../../../features/common/utils/uiUtils';

describe('UIUtils', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="status-toast" class="toast"></div>
        `;
        delete (chrome.runtime as any).lastError;
    });

    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('shows toast with message and hides after duration', () => {
        jest.useFakeTimers();
        UIUtils.showToast('Test Message', 1000);
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
});

